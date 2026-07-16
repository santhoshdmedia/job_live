/**
 * InTimeCaptureModal.jsx
 *
 * Camera + location capture used when staff click "In Time" in the navbar.
 * Both a selfie photo AND the device location are required before the
 * attendance session (in-time) is recorded — mirrors the capture UX that
 * used to live on the login screen, just triggered later, on demand.
 *
 * Props:
 *   open        {boolean}
 *   onClose     {Function}                            — cancel, nothing recorded
 *   onConfirm   {(selfieUrl|null, coords) => Promise|void} — selfieUrl is null
 *                                                           when the user skips
 *   canSkip     {boolean}                             — super admin / is_Special:
 *                                                       photo is optional; they
 *                                                       can still take one if
 *                                                       they want
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Button, message } from "antd";
import {
  CameraOutlined,
  EnvironmentOutlined,
  ReloadOutlined,
  FastForwardOutlined,
} from "@ant-design/icons";
import { uploadImage } from "../api";

const InTimeCaptureModal = ({ open, onClose, onConfirm, canSkip = false }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // step: "camera" | "preview" | "uploading"
  const [step, setStep] = useState("camera");
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [camError, setCamError] = useState(false);
  const [location, setLocation] = useState(null);
  const [locStatus, setLocStatus] = useState("idle"); // idle|fetching|ok|denied|error
  const [submitting, setSubmitting] = useState(false);
  const [skipping, setSkipping] = useState(false);

  const stopCam = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

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
      (err) => setLocStatus(err?.code === 1 ? "denied" : "error"),
      { timeout: 10000, enableHighAccuracy: true },
    );
  }, []);

  useEffect(() => {
    if (!open) {
      stopCam();
      return;
    }
    setStep("camera");
    setCapturedBlob(null);
    setPreviewUrl("");
    setCamError(false);
    setLocation(null);
    setLocStatus("idle");
    setSubmitting(false);
    setSkipping(false);

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        setCamError(true);
      }
    })();

    fetchLocation();

    return () => stopCam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setCamError(true);
    }
  };

  const locationReady = locStatus === "ok" && !!location;

  // ── Submit with photo ─────────────────────────────────────────────────────
  const submit = async () => {
    if (!capturedBlob || !locationReady) return;
    setStep("uploading");
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("image", capturedBlob, "in-time-selfie.jpg");
      const res = await uploadImage(formData);
      const url = res?.data?.data?.url || "";
      if (!url) throw new Error("Upload succeeded but no URL was returned.");
      await onConfirm(url, location);
    } catch (err) {
      message.error(
        err?.response?.data?.message ||
          err?.message ||
          "Could not capture in-time. Please try again.",
      );
      setStep("preview");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Skip photo (canSkip users only) — location still required ────────────
  const skipPhoto = async () => {
    if (!locationReady) {
      message.warning("Please wait for your location to be detected first.");
      return;
    }
    setSkipping(true);
    stopCam();
    try {
      // selfieUrl passed as null signals "no photo taken"
      await onConfirm(null, location);
    } catch (err) {
      message.error(
        err?.response?.data?.message ||
          err?.message ||
          "Could not record in-time. Please try again.",
      );
    } finally {
      setSkipping(false);
    }
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

  const busy = submitting || skipping;

  return (
    <Modal
      open={open}
      onCancel={busy ? undefined : onClose}
      footer={null}
      title={
        <span>
          Capture In Time
          {canSkip && (
            <span
              style={{
                marginLeft: 8,
                fontSize: 11,
                fontWeight: 500,
                color: "#7C3AED",
                background: "#F5F3FF",
                border: "1px solid #DDD6FE",
                borderRadius: 20,
                padding: "2px 8px",
                verticalAlign: "middle",
              }}
            >
              Photo optional
            </span>
          )}
        </span>
      }
      centered
      width={440}
      closable={!busy}
      maskClosable={!busy}
    >
      <div style={{ textAlign: "center" }}>
        {step !== "preview" ? (
          <>
            {camError ? (
              <div
                style={{ padding: "24px 8px", color: "#DC2626", fontSize: 13 }}
              >
                Camera access was denied or is unavailable. Please allow camera
                permission and try again.
              </div>
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: "100%",
                  borderRadius: 10,
                  background: "#000",
                  transform: "scaleX(-1)",
                }}
              />
            )}
            <canvas ref={canvasRef} style={{ display: "none" }} />

            <div
              style={{
                marginTop: 14,
                display: "flex",
                gap: 8,
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              <Button
                type="primary"
                icon={<CameraOutlined />}
                onClick={capture}
                disabled={camError || busy}
                style={{ borderRadius: 8 }}
              >
                Take Photo
              </Button>

              {/* Skip button — only for super admin / is_Special */}
              {canSkip && (
                <Button
                  icon={<FastForwardOutlined />}
                  onClick={skipPhoto}
                  loading={skipping}
                  disabled={!locationReady || busy}
                  title="Skip photo and record in-time with location only"
                  style={{
                    borderRadius: 8,
                    borderColor: "#DDD6FE",
                    color: "#7C3AED",
                    background: "#F5F3FF",
                    fontWeight: 600,
                  }}
                >
                  Skip Photo
                </Button>
              )}
            </div>
          </>
        ) : (
          <>
            <img
              src={previewUrl}
              alt="in-time preview"
              style={{
                width: "100%",
                borderRadius: 10,
                transform: "scaleX(-1)",
              }}
            />
            <div
              style={{
                marginTop: 12,
                display: "flex",
                gap: 8,
                justifyContent: "center",
              }}
            >
              <Button
                icon={<ReloadOutlined />}
                onClick={retake}
                disabled={busy}
              >
                Retake
              </Button>
              <Button
                type="primary"
                onClick={submit}
                loading={submitting}
                disabled={!locationReady || busy}
                style={{ borderRadius: 8 }}
              >
                Confirm In Time
              </Button>
            </div>
          </>
        )}

        {/* Location status pill */}
        <div
          style={{
            marginTop: 14,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
            padding: "5px 10px",
            borderRadius: 20,
            background: locationReady ? "#F0FDF4" : "#FFF7ED",
            border: `1px solid ${locationReady ? "#86EFAC" : "#FED7AA"}`,
            color: locationReady ? "#15803D" : "#C2410C",
          }}
        >
          <EnvironmentOutlined />
          {locLabel}
          {(locStatus === "denied" || locStatus === "error") && (
            <button
              onClick={fetchLocation}
              style={{
                marginLeft: 4,
                border: "none",
                background: "transparent",
                color: "inherit",
                textDecoration: "underline",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              Retry
            </button>
          )}
        </div>

        <p style={{ fontSize: 11, color: "#94A3B8", marginTop: 10 }}>
          {canSkip
            ? "Your location is required. A selfie is optional — take one or skip."
            : "A photo and your current location are required to record your in-time."}
        </p>
      </div>
    </Modal>
  );
};

export default InTimeCaptureModal;