import { Button, Checkbox, Form, Input, Modal } from "antd";
import { EmailValidation, PasswordValidation } from "../helper/formvalidation";
import { useEffect, useRef, useState, useCallback } from "react";
import { login } from "../api";
import axios from "axios";
import _, { toLower } from "lodash";
import {
  admintoken,
  ERROR_NOTIFICATION,
  SUCCESS_NOTIFICATION,
} from "../helper/notification_helper";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { isLoginSuccess } from "../redux/slices/authSlice";
import { IMAGE_HELPER } from "../helper/imagehelper";

// ─── Roles that are allowed to bypass the selfie check-in ────────────────────
const BYPASS_ROLES = ["super_admin", "super admin", "admin"];

// ─── Staff monitor API ────────────────────────────────────────────────────────
const staffHttp = axios.create({
  baseURL: "https://api.dmedia.in/api/staff-monitor",
  timeout: 8000,
  headers: { "Content-Type": "application/json" },
});

const recordInTime = async (staffId, token, selfieUrl = "", coords = null) => {
  try {
    await staffHttp.post(
      "/session/login",
      {
        staffId,
        selfie_url: selfieUrl,
        ...(coords && {
          latitude:  coords.latitude,
          longitude: coords.longitude,
          accuracy:  coords.accuracy,
        }),
      },
      { headers: { Authorization: `Bearer ${token}` } },
    );
  } catch (err) {
    console.warn("[recordInTime] Could not record in-time:", err?.message);
  }
};

// ─── Upload selfie blob to image upload endpoint ──────────────────────────────
const uploadSelfie = async (blob, token) => {
  try {
    const formData = new FormData();
    formData.append("image", blob, "selfie.jpg");
    const res = await axios.post("https://api.dmedia.in/api/upload-image", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
        Authorization: `Bearer ${token}`,
      },
    });
    return _.get(res, "data.data.url", "");
  } catch (err) {
    console.warn("[uploadSelfie] Upload failed:", err?.message);
    return "";
  }
};

// ─── Selfie + Location Modal ──────────────────────────────────────────────────
/**
 * Props:
 *   open          {boolean}
 *   onComplete    {(selfieUrl: string, coords: object|null) => void}
 *   onSkip        {() => void}   — only rendered when canSkip = true
 *   canSkip       {boolean}      — true only for super_admin / admin roles
 */
const SelfieModal = ({ open, onComplete, onSkip, canSkip }) => {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [step, setStep]                 = useState("camera"); // "camera" | "preview" | "uploading"
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [previewUrl, setPreviewUrl]     = useState("");
  const [location, setLocation]         = useState(null);
  const [locStatus, setLocStatus]       = useState("idle"); // "idle"|"fetching"|"ok"|"denied"
  const [camError, setCamError]         = useState(false);

  // Start webcam when modal opens
  useEffect(() => {
    if (!open) return;
    setStep("camera");
    setCapturedBlob(null);
    setPreviewUrl("");
    setLocation(null);
    setLocStatus("idle");
    setCamError(false);

    const startCam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        setCamError(true);
      }
    };
    startCam();

    // Fetch location immediately
    setLocStatus("fetching");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          latitude:  pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy:  pos.coords.accuracy,
        });
        setLocStatus("ok");
      },
      () => setLocStatus("denied"),
      { timeout: 10000 },
    );

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [open]);

  const stopCam = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const capture = () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        setCapturedBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        setStep("preview");
        stopCam();
      },
      "image/jpeg",
      0.85,
    );
  };

  const retake = async () => {
    setStep("camera");
    setCapturedBlob(null);
    setPreviewUrl("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setCamError(true);
    }
  };

  const submit = async () => {
    setStep("uploading");
    const token     = localStorage.getItem(admintoken) || "";
    const selfieUrl = capturedBlob ? await uploadSelfie(capturedBlob, token) : "";
    onComplete(selfieUrl, location);
  };

  const locLabel = {
    idle:     "Waiting…",
    fetching: "Getting location…",
    ok:       location
      ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
      : "Located",
    denied:   "Location not available",
  }[locStatus];

  // When camera fails and the user cannot skip, we still let them
  // "Continue without selfie" so they aren't hard-blocked — location is
  // still captured. Only the selfie image is missing.
  const cameraDeniedCanProceed = camError;

  return (
    <Modal
      open={open}
      footer={null}
      closable={false}
      centered
      width={420}
      styles={{
        body:    { padding: 0 },
        content: { borderRadius: 20, overflow: "hidden" },
      }}
      maskClosable={false}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div
        className="px-6 py-4 flex items-center gap-3"
        style={{ background: "linear-gradient(135deg, #7c6ef7 0%, #9b8df9 100%)" }}
      >
        <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white text-lg">
          📷
        </div>
        <div>
          <p className="text-white font-bold text-base leading-tight">Attendance Check-In</p>
          <p className="text-white/70 text-xs">
            {canSkip
              ? "Selfie is recommended — you may skip as admin"
              : "Selfie is required to complete sign-in"}
          </p>
        </div>
      </div>

      <div className="p-5 bg-white flex flex-col gap-4">
        {/* ── Mandatory badge (for non-admin staff) ────────────────────── */}
        {!canSkip && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200">
            <span className="text-amber-500 text-base">🔒</span>
            <p className="text-xs text-amber-700 font-medium">
              Selfie capture is mandatory for your role. Please take a photo to continue.
            </p>
          </div>
        )}

        {/* ── Camera / Preview area ─────────────────────────────────────── */}
        <div
          className="relative rounded-2xl overflow-hidden bg-gray-900"
          style={{ aspectRatio: "4/3" }}
        >
          {step === "camera" && !camError && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
          )}

          {step === "camera" && camError && (
            <div className="w-full h-full flex flex-col items-center justify-center text-white/60 gap-2">
              <span className="text-4xl">🚫</span>
              <p className="text-sm text-center px-4">
                Camera access denied.
                <br />
                {canSkip
                  ? "You can skip since you're an admin."
                  : "Please allow camera access and refresh the page."}
              </p>
            </div>
          )}

          {(step === "preview" || step === "uploading") && previewUrl && (
            <img
              src={previewUrl}
              alt="selfie preview"
              className="w-full h-full object-cover scale-x-[-1]"
            />
          )}

          {step === "uploading" && (
            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-3">
              <span className="inline-block h-8 w-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <p className="text-white text-sm font-medium">Saving check-in…</p>
            </div>
          )}

          {/* Location pill overlay */}
          {step !== "uploading" && (
            <div className="absolute bottom-3 left-3 right-3">
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{
                  background:    "rgba(0,0,0,0.55)",
                  backdropFilter: "blur(6px)",
                  color:
                    locStatus === "ok"
                      ? "#86efac"
                      : locStatus === "denied"
                      ? "#fca5a5"
                      : "#fde68a",
                }}
              >
                <span>
                  {locStatus === "fetching"
                    ? "⏳"
                    : locStatus === "ok"
                    ? "📍"
                    : locStatus === "denied"
                    ? "⚠️"
                    : "⏳"}
                </span>
                <span className="truncate">{locLabel}</span>
              </div>
            </div>
          )}
        </div>

        {/* Hidden canvas for capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* ── Action buttons ────────────────────────────────────────────── */}
        <div className="flex gap-3">
          {step === "camera" && (
            <>
              {/* Skip — only rendered for super_admin / admin */}
              {canSkip && (
                <button
                  onClick={onSkip}
                  className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Skip
                </button>
              )}

              {/* Camera is available → Capture */}
              {!camError && (
                <button
                  onClick={capture}
                  className="flex-[2] h-11 rounded-xl text-white text-sm font-semibold transition-all active:scale-95"
                  style={{ background: "linear-gradient(135deg, #7c6ef7, #9b8df9)" }}
                >
                  📸&nbsp; Capture
                </button>
              )}

              {/* Camera failed — admin can continue, staff is gated */}
              {camError && canSkip && (
                <button
                  onClick={onSkip}
                  className="flex-[2] h-11 rounded-xl text-white text-sm font-semibold transition-all active:scale-95"
                  style={{ background: "linear-gradient(135deg, #7c6ef7, #9b8df9)" }}
                >
                  Continue without selfie
                </button>
              )}

              {/* Camera failed & non-admin: encourage enabling camera */}
              {camError && !canSkip && (
                <div className="flex-[2] h-11 rounded-xl flex items-center justify-center bg-red-50 border border-red-200">
                  <span className="text-xs text-red-500 font-medium text-center px-2">
                    Enable camera to continue
                  </span>
                </div>
              )}
            </>
          )}

          {step === "preview" && (
            <>
              <button
                onClick={retake}
                className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Retake
              </button>
              <button
                onClick={submit}
                className="flex-[2] h-11 rounded-xl text-white text-sm font-semibold transition-all active:scale-95"
                style={{ background: "linear-gradient(135deg, #7c6ef7, #9b8df9)" }}
              >
                ✓&nbsp; Confirm & Check In
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};

// ─── Main Login Component ─────────────────────────────────────────────────────
const Login = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [loading, setLoading]         = useState(false);
  const [selfieOpen, setSelfieOpen]   = useState(false);
  const [pendingAuth, setPendingAuth] = useState(null); // { userData, token, staffId, canSkip }

  const onFinish = async (values) => {
    try {
      setLoading(true);
      const validEmail = toLower(values.email);
      const result     = await login({ email: validEmail, password: values.password });

      const userData = _.get(result, "data.data", {});
      if (_.isEmpty(userData)) {
        setLoading(false);
        return ERROR_NOTIFICATION("Invalid credentials");
      }

      const token   = _.get(userData, "token", "");
      const staffId = _.get(userData, "_id", "");
      const role    = _.get(userData, "role", "");

      // Determine if this role can bypass selfie
      const canSkip = BYPASS_ROLES.includes(role?.toLowerCase?.() ?? role);

      // Persist auth immediately
      dispatch(isLoginSuccess(userData));
      localStorage.setItem(admintoken, token);
      localStorage.setItem("userprofile", JSON.stringify(userData));

      SUCCESS_NOTIFICATION(result);
      setLoading(false);

      // Show selfie modal — skip button visible only for admins
      setPendingAuth({ userData, token, staffId, canSkip });
      setSelfieOpen(true);
    } catch (err) {
      console.error(err);
      ERROR_NOTIFICATION(err);
      setLoading(false);
    }
  };

  const finishLogin = useCallback(() => {
    setSelfieOpen(false);
    setPendingAuth(null);
    setTimeout(() => {
      navigate("/dashboard");
      form.resetFields();
    }, 300);
  }, [navigate, form]);

  /** Called when the user confirms their selfie (and optionally location). */
  const handleSelfieComplete = useCallback(
    async (selfieUrl, coords) => {
      if (pendingAuth?.staffId) {
        await recordInTime(pendingAuth.staffId, pendingAuth.token, selfieUrl, coords);
      }
      finishLogin();
    },
    [pendingAuth, finishLogin],
  );

  /**
   * Called only by super_admin / admin who pressed Skip.
   * We still record the session (without selfie/location) so the session
   * history stays consistent.
   */
  const handleSelfieSkip = useCallback(async () => {
    if (pendingAuth?.staffId) {
      await recordInTime(pendingAuth.staffId, pendingAuth.token, "", null);
    }
    finishLogin();
  }, [pendingAuth, finishLogin]);

  // Already logged in → redirect
  useEffect(() => {
    if (localStorage.getItem(admintoken)) navigate("/dashboard");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex overflow-hidden bg-white font-sans">
      {/* ── LEFT PANEL ──────────────────────────────────────────────────────── */}
      <div className="lg:w-[46%] hidden lg:block h-screen border-[40px] border-white">
        <div
          className="hidden lg:flex flex-col h-full justify-between p-10 relative overflow-hidden rounded-2xl"
          style={{
            background: "linear-gradient(145deg, #7c6ef7 0%, #9b8df9 50%, #b3a6fb 100%)",
          }}
        >
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")",
              backgroundSize: "200px 200px",
            }}
          />
          <div className="relative z-10">
            <p className="text-white font-light tracking-wide text-3xl">
              <strong className="text-4xl font-bold">Simplify</strong> <br /> customer relationships with
            </p>
            <h1 className="text-white text-5xl font-extrabold leading-tight mt-1 drop-shadow-sm">
              Job Sheet.
            </h1>
            <p className="text-white/60 text-sm mt-3 tracking-widest uppercase">
              Track · Assign · Deliver
            </p>
          </div>
          <div className="relative z-10 flex items-end justify-center flex-1 mt-8">
            <img
              src={IMAGE_HELPER.LOGIN_IMAGE}
              alt="Job Sheet 3D illustration"
              className="w-full object-contain drop-shadow-2xl animate-[float_4s_ease-in-out_infinite]"
            />
          </div>
          <div className="absolute -top-16 -left-16 w-56 h-56 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
        </div>
      </div>

      {/* ── RIGHT PANEL ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 sm:px-12 py-2 bg-white relative">
        <div
          className="absolute inset-0 lg:hidden block pointer-events-none"
          style={{
            background: "linear-gradient(145deg, #7c6ef7 0%, #9b8df9 50%, #b3a6fb 100%)",
          }}
        />

        {/* Mobile logo */}
        <div className="lg:hidden lg:mb-8 mb-0 relative bottom-5 left-20 gap-2 z-20">
          <img src={IMAGE_HELPER.WhiteLogo} alt="D Media" className="h-10 object-contain" />
        </div>

        {/* Desktop logo */}
        <div className="hidden lg:mb-8 mb-0 lg:flex flex-col items-center gap-2 z-20">
          <img src={IMAGE_HELPER.Dlogo} alt="D Media" className="h-14 object-contain" />
        </div>

        <div className="lg:hidden block mt-0 text-center">
          <h1 className="!text-white text-[32px] font-extrabold leading-tight mt-2 drop-shadow-sm">
            Job Sheet.
          </h1>
          <p className="!text-white text-[16px] font-thin leading-tight drop-shadow-sm p-1">
            Track · Assign · Deliver
          </p>
        </div>

        <div className="text-center lg:mb-8 mb-0">
          <h2 className="hidden lg:block text-3xl font-bold lg:text-gray-900 text-white tracking-tight">
            Sign in to Continue
          </h2>
        </div>

        <div className="w-full max-w-sm">
          <Form
            form={form}
            name="login"
            layout="vertical"
            onFinish={onFinish}
            requiredMark={false}
            className="space-y-1"
          >
            <Form.Item
              name="email"
              label={
                <span className="text-sm font-semibold lg:text-gray-700 text-white">Email</span>
              }
              rules={[EmailValidation("Enter Email")]}
            >
              <Input
                placeholder="Enter your Email here"
                disabled={loading}
                className="!h-12 !rounded-xl !bg-gray-100 !border-0 !text-gray-700 placeholder:text-gray-400 focus:!ring-2 focus:!ring-indigo-400"
              />
            </Form.Item>

            <Form.Item
              name="password"
              label={
                <span className="text-sm font-semibold lg:text-gray-700 text-white">Password</span>
              }
              rules={[PasswordValidation("Enter Password")]}
            >
              <Input.Password
                placeholder="Enter your Password here"
                disabled={loading}
                className="!h-12 !rounded-xl !bg-gray-100 !border-0 !text-gray-700 placeholder:text-gray-400 focus:!ring-2 focus:!ring-indigo-400"
              />
            </Form.Item>

            <Form.Item name="remember" valuePropName="checked" className="!mb-2">
              <Checkbox disabled={loading} className="lg:text-gray-500 !text-white text-sm">
                Remember me
              </Checkbox>
            </Form.Item>

            <Form.Item className="!mt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl font-semibold text-white text-base transition-all duration-200 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: "#6364f0" }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Signing In…
                  </span>
                ) : (
                  "Login"
                )}
              </button>
            </Form.Item>
          </Form>
        </div>

        <div className="lg:hidden block">
          <img
            src={IMAGE_HELPER.LOGIN_IMAGE}
            alt="Job Sheet 3D illustration"
            className="w-full object-contain drop-shadow-xl lg:mt-10 mt-0"
          />
        </div>
      </div>

      {/* ── Selfie Modal ─────────────────────────────────────────────────────── */}
      <SelfieModal
        open={selfieOpen}
        onComplete={handleSelfieComplete}
        onSkip={handleSelfieSkip}
        canSkip={pendingAuth?.canSkip ?? false}
      />

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-14px); }
        }
      `}</style>
    </div>
  );
};

export default Login;