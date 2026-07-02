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

// Session-only key used to hold the token WHILE the selfie/location gate is
// in progress. It is intentionally never written to persistent auth storage
// (admintoken) until the selfie has uploaded AND location is confirmed (or
// the role is exempt) — this is what stops a page refresh mid-flow from
// silently logging someone in. If the tab is refreshed before that happens,
// this key is simply cleared and the person is dropped back on the login
// form.
const PENDING_AUTH_KEY = "pending_selfie_auth";

// Roles that are allowed to skip the selfie + location capture entirely.
// NOTE: this is a client-side convenience only — if "skip attendance
// capture" is meant to be an actual security/business rule, it should also
// be enforced on the /session/login backend so a tampered role can't bypass
// tracking.
const SELFIE_SKIP_ROLES = ["super admin", "admin", "designing head"];

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
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
        }),
      },
      { headers: { Authorization: `Bearer ${token}` } },
    );
  } catch (err) {
    console.warn("[recordInTime] Could not record in-time:", err?.message);
    // Don't throw — session record failure shouldn't block login
  }
};

// ─── Upload selfie blob to image upload endpoint ──────────────────────────────
/**
 * Returns { url: string, error: string|null }
 * Never throws — errors are returned so the UI can show a retry.
 */
const uploadSelfie = async (blob, token) => {
  try {
    const formData = new FormData();
    formData.append("image", blob, "selfie.jpg");
    const res = await axios.post(
      "https://api.dmedia.in/api/upload_images",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`,
        },
        timeout: 15000,
      },
    );
    const url = _.get(res, "data.data.url", "");
    if (!url) return { url: "", error: "Upload succeeded but no URL was returned." };
    return { url, error: null };
  } catch (err) {
    const msg =
      err?.response?.data?.message ||
      err?.message ||
      "Selfie upload failed. Please try again.";
    return { url: "", error: msg };
  }
};

// ─── Selfie + Location Modal ──────────────────────────────────────────────────
/**
 * Props:
 *   open          {boolean}
 *   token         {string}   — auth token to use for the upload call
 *   allowSkip     {boolean}  — if true, shows a "Skip" action that bypasses
 *                              both selfie capture and location and completes
 *                              immediately with empty selfieUrl / null coords
 *   onComplete    {(selfieUrl: string, coords: object|null) => void}
 *
 * For non-exempt roles, both the selfie photo AND the device location are
 * mandatory. onComplete only fires once a selfie has been uploaded
 * successfully AND a location fix has been obtained — OR the role is
 * exempt and the skip action was used. The caller is responsible for NOT
 * persisting real auth (admintoken) until onComplete fires, so a refresh
 * mid-flow doesn't grant access.
 */
const SelfieModal = ({ open, token, allowSkip, onComplete }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // step: "camera" | "preview" | "uploading" | "upload_error"
  const [step, setStep] = useState("camera");
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [location, setLocation] = useState(null);
  const [locStatus, setLocStatus] = useState("idle"); // "idle"|"fetching"|"ok"|"denied"|"error"
  const [camError, setCamError] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  // ── Location fetch — reusable so it can be triggered on open AND via
  //    the manual refresh button when the first attempt fails ───────────
  const fetchLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocStatus("error");
      return;
    }
    setLocStatus("fetching");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setLocStatus("ok");
      },
      (err) => {
        // err.code: 1 = denied, 2 = position unavailable, 3 = timeout
        setLocStatus(err?.code === 1 ? "denied" : "error");
      },
      { timeout: 10000, enableHighAccuracy: true },
    );
  }, []);

  const stopCam = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // ── Reset & start camera when modal opens ───────────────────────────────
  useEffect(() => {
    if (!open) return;

    setStep("camera");
    setCapturedBlob(null);
    setPreviewUrl("");
    setLocation(null);
    setLocStatus("idle");
    setCamError(false);
    setUploadError("");
    setRetryCount(0);

    // Exempt roles don't need the camera or location at all — skip the
    // hardware setup entirely.
    if (allowSkip) return;

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
    fetchLocation();

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [open, allowSkip, fetchLocation]);

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 640;
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
    setUploadError("");
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

  const locationReady = locStatus === "ok" && !!location;

  /**
   * Core submit — requires BOTH a captured selfie and a valid location fix.
   * Uploads selfie, calls onComplete on success, or sets upload_error step
   * on failure (so user can retry). Login never proceeds without both
   * (unless the role is exempt — see handleSkip).
   */
  const submit = async () => {
    if (!capturedBlob || !locationReady) return; // guarded — button is disabled anyway

    setStep("uploading");
    setUploadError("");

    const { url, error } = await uploadSelfie(capturedBlob, token || "");

    if (error) {
      // Upload failed — show error screen with retry option
      setUploadError(error);
      setStep("upload_error");
      setRetryCount((c) => c + 1);
      return;
    }

    // ✅ Upload succeeded and location is ok — record session then navigate
    await onComplete(url, location);
  };

  /**
   * Exempt-role bypass — no selfie, no location, completes immediately.
   * Only rendered/reachable when allowSkip is true.
   */
  const handleSkip = () => {
    stopCam();
    onComplete("", null);
  };

  const handleRetry = () => {
    setStep("preview"); // go back to preview so they can re-submit
    setUploadError("");
  };

  const handleRetakeAfterError = () => {
    retake();
    setUploadError("");
  };

  const locLabel = {
    idle: "Waiting…",
    fetching: "Getting location…",
    ok: location
      ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
      : "Located",
    denied: "Location permission denied",
    error: "Location unavailable",
  }[locStatus];

  const locColor =
    locStatus === "ok"
      ? "#86efac"
      : locStatus === "denied" || locStatus === "error"
      ? "#fca5a5"
      : "#fde68a";

  const showLocationRefresh = locStatus !== "ok" && locStatus !== "fetching";

  return (
    <Modal
      open={open}
      footer={null}
      closable={false}
      centered
      width={420}
      styles={{
        body: { padding: 0 },
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
          {step === "upload_error" ? "⚠️" : "📷"}
        </div>
        <div>
          <p className="text-white font-bold text-base leading-tight">
            {step === "upload_error" ? "Upload Failed" : "Attendance Check-In"}
          </p>
          <p className="text-white/70 text-xs">
            {step === "upload_error"
              ? "Your selfie could not be uploaded — please retry"
              : allowSkip
              ? "Selfie and location are recommended, but optional for your role"
              : "Selfie and location are both required to sign in"}
          </p>
        </div>
      </div>

      <div className="p-5 bg-white flex flex-col gap-4">

        {/* ── Mandatory / optional badge ──────────────────────────────── */}
        {step !== "upload_error" && (
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
              allowSkip
                ? "bg-indigo-50 border-indigo-200"
                : "bg-amber-50 border-amber-200"
            }`}
          >
            <span className={`text-base ${allowSkip ? "text-indigo-500" : "text-amber-500"}`}>
              {allowSkip ? "ℹ️" : "🔒"}
            </span>
            <p className={`text-xs font-medium ${allowSkip ? "text-indigo-700" : "text-amber-700"}`}>
              {allowSkip
                ? "Your role allows you to skip selfie and location check-in."
                : "Selfie capture and location access are mandatory. You cannot sign in without both."}
            </p>
          </div>
        )}

        {/* ── Upload error screen ───────────────────────────────────────── */}
        {step === "upload_error" && (
          <div className="flex flex-col gap-4">
            {/* Preview of the captured selfie */}
            {previewUrl && (
              <div
                className="relative rounded-2xl overflow-hidden bg-gray-900 border-2 border-red-200"
                style={{ aspectRatio: "4/3" }}
              >
                <img
                  src={previewUrl}
                  alt="selfie preview"
                  className="w-full h-full object-cover scale-x-[-1] opacity-60"
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40">
                  <span className="text-4xl">❌</span>
                  <p className="text-white text-sm font-semibold text-center px-4">
                    Upload Failed
                  </p>
                </div>
              </div>
            )}

            {/* Error detail box */}
            <div className="flex flex-col gap-1 px-4 py-3 rounded-xl bg-red-50 border border-red-200">
              <p className="text-sm font-semibold text-red-600">
                Could not upload selfie
              </p>
              <p className="text-xs text-red-500 leading-relaxed">
                {uploadError}
              </p>
              {retryCount > 1 && (
                <p className="text-[11px] text-red-400 mt-1">
                  Attempt {retryCount} failed. Check your internet connection and try again.
                </p>
              )}
            </div>

            {/* Retry / Retake options */}
            <div className="flex gap-3">
              <button
                onClick={handleRetakeAfterError}
                className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                📷 Retake
              </button>
              <button
                onClick={handleRetry}
                disabled={!locationReady}
                className="flex-[2] h-11 rounded-xl text-white text-sm font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "linear-gradient(135deg, #7c6ef7, #9b8df9)" }}
              >
                🔄 Retry Upload
              </button>
            </div>

            {/* Location gate — even on the error screen, location is required
                for non-exempt roles */}
            {!locationReady && !allowSkip && (
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-orange-50 border border-orange-200">
                <p className="text-xs text-orange-700">
                  Location is still required before you can continue.
                </p>
                <button
                  onClick={fetchLocation}
                  disabled={locStatus === "fetching"}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-white border border-orange-300 text-orange-600 text-xs font-semibold hover:bg-orange-100 transition-colors disabled:opacity-50"
                >
                  {locStatus === "fetching" ? "Locating…" : "🔄 Get Location"}
                </button>
              </div>
            )}

            {/* Skip option is still available to exempt roles even after an
                upload failure */}
            {allowSkip && (
              <button
                onClick={handleSkip}
                className="w-full text-center text-xs text-gray-400 hover:text-gray-600 underline"
              >
                Skip selfie & location and continue
              </button>
            )}
          </div>
        )}

        {/* ── Camera / Preview area (hidden during upload_error) ────────── */}
        {step !== "upload_error" && (
          <>
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
                    Please allow camera access and refresh the page to continue.
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
                  <p className="text-white text-sm font-medium">Uploading selfie…</p>
                  <p className="text-white/60 text-xs">Please wait, do not close this window</p>
                </div>
              )}

              {/* Location pill overlay — with a refresh action when not ok */}
              {step !== "uploading" && (
                <div className="absolute bottom-3 left-3 right-3">
                  <div
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
                    style={{
                      background: "rgba(0,0,0,0.55)",
                      backdropFilter: "blur(6px)",
                      color: locColor,
                    }}
                  >
                    <span>
                      {locStatus === "fetching"
                        ? "⏳"
                        : locStatus === "ok"
                        ? "📍"
                        : locStatus === "denied" || locStatus === "error"
                        ? "⚠️"
                        : "⏳"}
                    </span>
                    <span className="truncate flex-1">{locLabel}</span>
                    {showLocationRefresh && (
                      <button
                        onClick={fetchLocation}
                        className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors"
                      >
                        🔄 <span className="hidden xs:inline">Retry</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Hidden canvas for capture */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Inline hint when location isn't ready yet — helps explain why
                the confirm button is disabled (non-exempt roles only) */}
            {step === "preview" && !locationReady && !allowSkip && (
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-orange-50 border border-orange-200">
                <p className="text-xs text-orange-700">
                  {locStatus === "fetching"
                    ? "Getting your location…"
                    : "Location is required. Please allow location access and try again."}
                </p>
                {locStatus !== "fetching" && (
                  <button
                    onClick={fetchLocation}
                    className="shrink-0 px-3 py-1.5 rounded-lg bg-white border border-orange-300 text-orange-600 text-xs font-semibold hover:bg-orange-100 transition-colors"
                  >
                    🔄 Get Location
                  </button>
                )}
              </div>
            )}

            {/* ── Action buttons ──────────────────────────────────────── */}
            <div className="flex gap-3">
              {step === "camera" && !camError && (
                <button
                  onClick={capture}
                  className="flex-1 h-11 rounded-xl text-white text-sm font-semibold transition-all active:scale-95"
                  style={{ background: "linear-gradient(135deg, #7c6ef7, #9b8df9)" }}
                >
                  📸&nbsp; Capture
                </button>
              )}

              {step === "camera" && camError && !allowSkip && (
                <div className="flex-1 h-11 rounded-xl flex items-center justify-center bg-red-50 border border-red-200">
                  <span className="text-xs text-red-500 font-medium text-center px-2">
                    Enable camera to continue
                  </span>
                </div>
              )}

              {step === "camera" && camError && allowSkip && (
                <button
                  onClick={handleSkip}
                  className="flex-1 h-11 rounded-xl text-white text-sm font-semibold transition-all active:scale-95"
                  style={{ background: "linear-gradient(135deg, #7c6ef7, #9b8df9)" }}
                >
                  Continue without selfie
                </button>
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
                    disabled={!locationReady}
                    title={!locationReady ? "Waiting for location…" : undefined}
                    className="flex-[2] h-11 rounded-xl text-white text-sm font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: "linear-gradient(135deg, #7c6ef7, #9b8df9)" }}
                  >
                    {locationReady ? "✓  Confirm & Check In" : "Waiting for location…"}
                  </button>
                </>
              )}
            </div>

            {/* Skip action — only ever shown for exempt roles, on any step
                except the uploading spinner */}
            {allowSkip && step !== "uploading" && (
              <button
                onClick={handleSkip}
                className="w-full text-center text-xs text-gray-400 hover:text-gray-600 underline"
              >
                Skip selfie & location and continue
              </button>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};

// ─── Main Login Component ─────────────────────────────────────────────────────
const Login = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [loading, setLoading] = useState(false);
  const [selfieOpen, setSelfieOpen] = useState(false);
  const [pendingAuth, setPendingAuth] = useState(null); // { userData, token, staffId, role }

  const onFinish = async (values) => {
    try {
      setLoading(true);
      const validEmail = toLower(values.email);
      const result = await login({ email: validEmail, password: values.password });

      const userData = _.get(result, "data.data", {});
      if (_.isEmpty(userData)) {
        setLoading(false);
        return ERROR_NOTIFICATION("Invalid credentials");
      }

      const token = _.get(userData, "token", "");
      const staffId = _.get(userData, "_id", "");
      // Adjust the source key here if the role lives under a different
      // field name in your API response (e.g. "designation", "userType").
      const role = toLower(_.get(userData, "role", ""));
      // Some individual users are flagged as exempt regardless of role
      // (e.g. a specific "designing team" member who is also is_Special).
      const isSpecial = _.get(userData, "is_Special", false) === true;

      // IMPORTANT: do NOT persist real auth (admintoken / redux / userprofile)
      // yet. Credentials are correct, but sign-in isn't complete until the
      // selfie + location gate passes (or the role is exempt and skip is
      // used). We stash just enough in sessionStorage to survive an
      // accidental refresh while the modal is open — if the user refreshes
      // before finishing the gate, this pending record is discarded (see the
      // mount effect below) and they land back on the plain login form
      // instead of being auto-logged-in.
      sessionStorage.setItem(
        PENDING_AUTH_KEY,
        JSON.stringify({ userData, token, staffId, role, isSpecial }),
      );

      SUCCESS_NOTIFICATION(result);
      setLoading(false);

      // Show selfie + location modal — navigation and the real login are
      // blocked until BOTH the selfie upload succeeds AND a location fix has
      // been obtained, unless the role is in SELFIE_SKIP_ROLES or the user
      // is individually flagged is_Special, in which case a skip action is
      // offered.
      setPendingAuth({ userData, token, staffId, role, isSpecial });
      setSelfieOpen(true);
    } catch (err) {
      console.error(err);
      ERROR_NOTIFICATION(err);
      setLoading(false);
    }
  };

  /**
   * Navigate to dashboard — only called AFTER selfie upload + location
   * have both succeeded, or the gate was skipped for an exempt role.
   */
  const finishLogin = useCallback(() => {
    setSelfieOpen(false);
    setPendingAuth(null);
    setTimeout(() => {
      navigate("/dashboard");
      form.resetFields();
    }, 300);
  }, [navigate, form]);

  /**
   * Called by SelfieModal either when upload has succeeded AND location is
   * ok, or when an exempt role used the skip action (selfieUrl === "" and
   * coords === null in that case). This is the ONLY place real auth gets
   * persisted — login is not considered complete until this fires.
   */
  const handleSelfieComplete = useCallback(
    async (selfieUrl, coords) => {
      if (!pendingAuth) return;

      // Now that the gate has passed (or was skipped), persist the real
      // session.
      dispatch(isLoginSuccess(pendingAuth.userData));
      localStorage.setItem(admintoken, pendingAuth.token);
      localStorage.setItem("userprofile", JSON.stringify(pendingAuth.userData));
      sessionStorage.removeItem(PENDING_AUTH_KEY);

      // Record the session (fire-and-forget — failure won't block navigation)
      if (pendingAuth.staffId) {
        await recordInTime(
          pendingAuth.staffId,
          pendingAuth.token,
          selfieUrl,
          coords,
        );
      }
      // Navigate only after upload + location are confirmed (or skipped)
      finishLogin();
    },
    [pendingAuth, finishLogin, dispatch],
  );

  // On mount:
  //  - If real auth already exists (admintoken), the user is genuinely
  //    logged in → send them to the dashboard.
  //  - If a pending (not-yet-completed) selfie/location auth record is
  //    sitting in sessionStorage — meaning the tab was refreshed while the
  //    selfie modal was open — discard it. Real auth was never written, so
  //    the user simply stays on the plain login form and must sign in again.
  useEffect(() => {
    if (localStorage.getItem(admintoken)) {
      navigate("/dashboard");
      return;
    }
    if (sessionStorage.getItem(PENDING_AUTH_KEY)) {
      sessionStorage.removeItem(PENDING_AUTH_KEY);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const allowSkip =
    SELFIE_SKIP_ROLES.includes(toLower(pendingAuth?.role || "")) ||
    pendingAuth?.isSpecial === true;

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
                <span className="text-sm font-semibold lg:text-gray-700 text-white">
                  Email
                </span>
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
                <span className="text-sm font-semibold lg:text-gray-700 text-white">
                  Password
                </span>
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
        token={pendingAuth?.token}
        allowSkip={allowSkip}
        onComplete={handleSelfieComplete}
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