import { message, Skeleton, Upload, Modal, Button } from "antd";
import { uploadImage } from "../api";
import _ from "lodash";
import { ICON_HELPER } from "./iconhelper";
import { useState, useRef, useEffect } from "react";
import { CameraOutlined } from "@ant-design/icons";

// ─── Camera Capture Modal ─────────────────────────────────────────────────────
const CameraCaptureModal = ({ open, onClose, onCapture }) => {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream]     = useState(null);
  const [captured, setCaptured] = useState(null);

  useEffect(() => {
    if (open) {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: "environment" } })
        .then((s) => {
          setStream(s);
          if (videoRef.current) videoRef.current.srcObject = s;
        })
        .catch((err) => message.error("Camera access denied: " + err.message));
    } else {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      setStream(null);
      setCaptured(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const takePhoto = () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setCaptured(canvas.toDataURL("image/jpeg"));
  };

  // Convert data-URL → File so we can pass it to the same uploadImage API
  const dataUrlToFile = (dataUrl, filename = `capture_${Date.now()}.jpg`) => {
    const [header, base64] = dataUrl.split(",");
    const mime  = header.match(/:(.*?);/)[1];
    const bytes = atob(base64);
    const arr   = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new File([arr], filename, { type: mime });
  };

  const confirmCapture = () => {
    if (captured) {
      onCapture(dataUrlToFile(captured));
      onClose();
    }
  };

  return (
    <Modal open={open} onCancel={onClose} footer={null} width={500} title="Capture Photo">
      <div style={{ textAlign: "center" }}>
        {!captured ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              style={{ width: "100%", borderRadius: 8, background: "#000" }}
            />
            <canvas ref={canvasRef} style={{ display: "none" }} />
            <Button
              type="primary"
              icon={<CameraOutlined />}
              onClick={takePhoto}
              style={{ marginTop: 12 }}
            >
              Take Photo
            </Button>
          </>
        ) : (
          <>
            <img src={captured} alt="preview" style={{ width: "100%", borderRadius: 8 }} />
            <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "center" }}>
              <Button onClick={() => setCaptured(null)}>Retake</Button>
              <Button type="primary" onClick={confirmCapture}>Use This</Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

// ─── CapUploadHelper ─────────────────────────────────────────────────────────────
/**
 * Props (unchanged from original, plus `showCamera`):
 *  - setImagePath   : setter for uploaded URL(s)
 *  - image_path     : current value
 *  - multiple       : allow multiple images
 *  - max            : max file count (default 1)
 *  - field_key      : optional numeric key for keyed uploads
 *  - blog           : flag for blog-style single upload
 *  - current_key    : key used when blog=true
 *  - handleChange   : handler used when blog=true
 *  - showCamera     : (boolean, default false) show "Capture Photo" button
 */
const CapUploadHelper = (props) => {
  const {
    setImagePath,
    image_path,
    multiple,
    max,
    field_key,
    blog,
    current_key,
    handleChange,
    showCamera = false,
  } = props;

  const [loading, setCameraOpen_loading] = useState(false);
  const [cameraOpen, setCameraOpen]      = useState(false);

  // ── Shared upload logic (File → AWS via uploadImage API) ───────────────────
  const uploadFile = async (file) => {
    setCameraOpen_loading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const result      = await uploadImage(formData);
      const uploadedUrl = _.get(result, "data.data.url", "");

      if (blog) {
        return handleChange(current_key, uploadedUrl);
      }

      if (uploadedUrl) {
        if (Number(field_key)) {
          setImagePath([
            ...image_path,
            { key: image_path?.length + 1, path: uploadedUrl, field_key },
          ]);
        } else {
          multiple
            ? setImagePath([
                ...image_path,
                { key: image_path?.length + 1, path: uploadedUrl },
              ])
            : setImagePath(uploadedUrl);
        }
      }
      message.success("Image uploaded successfully!");
    } catch (err) {
      console.log(err);
      message.error("Failed to upload image. Please try again.");
    } finally {
      setCameraOpen_loading(false);
    }
  };

  // ── Ant Design Upload props ────────────────────────────────────────────────
  const imageValidation = {
    beforeUpload: (file) => {
      setCameraOpen_loading(true);
      const isImage = ["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.type);
      if (!isImage) {
        message.warning(`${file.name} is not supported`);
        setCameraOpen_loading(false);
      }
      return isImage || Upload.LIST_IGNORE;
    },
    onChange: async (info) => {
      if (_.get(info, "file.status", "") === "uploading") {
        await uploadFile(info.file.originFileObj);
      }
    },
  };

  // ── Camera capture handler ─────────────────────────────────────────────────
  const handleCameraCapture = async (file) => {
    await uploadFile(file);
  };

  return (
    <>
      <Skeleton loading={loading} active>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
          <Upload.Dragger
            {...imageValidation}
            maxCount={max || 1}
            showUploadList={false}
            style={{ width: 100, background: "white", height: 100 }}
          >
            <div className={`!w-full !h-[60px] !center_div ${blog && "!w-[100px] !h-[100px]"}`}>
              <ICON_HELPER.UPLOAD_ICON />
            </div>
          </Upload.Dragger>

          {showCamera && (
            <Button
              icon={<CameraOutlined />}
              size="small"
              onClick={() => setCameraOpen(true)}
              style={{ width: 100 }}
            >
              Camera
            </Button>
          )}
        </div>
      </Skeleton>

      {showCamera && (
        <CameraCaptureModal
          open={cameraOpen}
          onClose={() => setCameraOpen(false)}
          onCapture={handleCameraCapture}
        />
      )}
    </>
  );
};

export default CapUploadHelper;