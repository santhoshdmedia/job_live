import { useEffect, useState, useCallback, useRef } from "react";
import { uploadImage } from "../api";
import {
  Button, Modal, Input, Spin, Empty, Tooltip, Divider,
  message, Popconfirm, Table, Space, Select, DatePicker,
  InputNumber, Drawer, Tag, Avatar, Alert,
} from "antd";
import {
  ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined,
  PlayCircleOutlined, EyeOutlined, UserOutlined, PhoneOutlined,
  ReloadOutlined, PauseCircleOutlined, TeamOutlined, DeleteOutlined,
  EnvironmentOutlined, CameraOutlined, PlusOutlined, CompassOutlined,
  RocketOutlined, FileTextOutlined, FieldTimeOutlined, UploadOutlined,
  AimOutlined, StarOutlined, SearchOutlined, ShoppingCartOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";

dayjs.extend(duration);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const pad     = (n) => String(n).padStart(2, "0");
const fmtSecs = (s) => {
  s = Math.max(0, Math.floor(s));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
};
const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem("authToken")}` });
const jsonHeader = () => ({ ...authHeader(), "Content-Type": "application/json" });
const profile = () => {
  try { return JSON.parse(localStorage.getItem("userprofile") || "{}"); }
  catch { return {}; }
};

const BASE       = "https://api.dmedia.in/api/site-visits";
const ADMIN_API  = "https://api.dmedia.in/api/admin/get_admin";
const JOBS_API   = "https://api.dmedia.in/api/jobs";

const toSqFt = (w, h, unit) => {
  const wn = parseFloat(w) || 0, hn = parseFloat(h) || 0;
  if (!wn || !hn) return 0;
  if (unit === "ft")   return wn * hn;
  if (unit === "inch") return (wn / 12) * (hn / 12);
  if (unit === "cm")   return (wn / 30.48) * (hn / 30.48);
  if (unit === "m")    return wn * hn * 10.764;
  return wn * hn;
};

const UNIT_OPTIONS = [
  { value: "ft",   label: "ft"   },
  { value: "inch", label: "inch" },
  { value: "cm",   label: "cm"   },
  { value: "m",    label: "m"    },
];

const SITE_TYPES = [
  "Outdoor Signage", "Indoor Signage", "Hoarding / Billboard",
  "Vehicle Wrap", "Event Branding", "Retail Branding",
  "Office Branding", "Exhibition / Stall", "Other",
];

const STATUS_CFG = {
  scheduled:   { label: "Scheduled",   color: "#f59e0b", bg: "#fffbeb", border: "#fcd34d" },
  in_progress: { label: "In Progress", color: "#3b82f6", bg: "#eff6ff", border: "#93c5fd" },
  on_hold:     { label: "On Hold",     color: "#f97316", bg: "#fff7ed", border: "#fdba74" },
  completed:   { label: "Completed",   color: "#16a34a", bg: "#f0fdf4", border: "#86efac" },
  converted:   { label: "Converted",   color: "#7c3aed", bg: "#f5f3ff", border: "#c4b5fd" },
  cancelled:   { label: "Cancelled",   color: "#6b7280", bg: "#f9fafb", border: "#d1d5db" },
};

// ─── Photo limits ────────────────────────────────────────────────────────────
const MAX_COMPRESSED_BYTES = 500 * 1024;   // 500 KB hard cap per photo
const MAX_DIMENSION        = 2400;          // px — longest side before scaling
const MAX_PHOTOS_PER_VISIT = 50;           // reasonable upper bound

// ─────────────────────────────────────────────────────────────────────────────
// Image compression  (returns max 500 KB JPEG)
// ─────────────────────────────────────────────────────────────────────────────
const compressImage = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("FileReader failed"));
    reader.onload  = (evt) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Image load failed"));
      img.onload  = () => {
        // Scale down if wider/taller than MAX_DIMENSION
        const scale = img.width > MAX_DIMENSION || img.height > MAX_DIMENSION
          ? MAX_DIMENSION / Math.max(img.width, img.height) : 1;
        const canvas = document.createElement("canvas");
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);

        // Iteratively reduce quality until blob fits within 500 KB
        const tryQ = (quality) => {
          canvas.toBlob((blob) => {
            if (!blob) { reject(new Error("canvas.toBlob failed")); return; }
            if (blob.size <= MAX_COMPRESSED_BYTES || quality <= 0.1) {
              resolve({
                file: new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }),
                previewUrl: URL.createObjectURL(blob),
                compressedSizeKB: Math.round(blob.size / 1024),
              });
            } else {
              tryQ(Math.max(quality - 0.1, 0.1));
            }
          }, "image/jpeg", quality);
        };
        tryQ(0.85);
      };
      img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
  });

// ─────────────────────────────────────────────────────────────────────────────
// GPS
// ─────────────────────────────────────────────────────────────────────────────
const getGPS = () =>
  new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  });

const uploadFileToServer = async (file) => {
  const formData = new FormData();
  formData.append("image", file, file.name);
  const result = await uploadImage(formData);
  const url = result?.data?.data?.url || result?.data?.url || "";
  if (!url) throw new Error("Upload succeeded but no URL returned");
  return url;
};

// ─────────────────────────────────────────────────────────────────────────────
// Breakpoint
// ─────────────────────────────────────────────────────────────────────────────
const useBreakpoint = () => {
  const get = () => { const w = window.innerWidth; return w < 480 ? "xs" : w < 768 ? "sm" : w < 1024 ? "md" : "lg"; };
  const [bp, setBp] = useState(get);
  useEffect(() => {
    const fn = () => setBp(get());
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return { isMobile: bp === "xs" || bp === "sm", isTablet: bp === "md" };
};

// ─────────────────────────────────────────────────────────────────────────────
// Reusable atoms
// ─────────────────────────────────────────────────────────────────────────────
const SectionHeader = ({ icon, title }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, marginTop: 14 }}>
    <span style={{ color: "#0369a1", fontSize: 14 }}>{icon}</span>
    <span style={{ fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.06em" }}>{title}</span>
    <div style={{ flex: 1, height: 1, background: "#e5e7eb", marginLeft: 6 }} />
  </div>
);

const FormField = ({ label, required, children }) => (
  <div>
    <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
      {label}{required && <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>}
    </label>
    {children}
  </div>
);

const StatusBadge = ({ status }) => {
  const s = STATUS_CFG[status] || STATUS_CFG.scheduled;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px",
      borderRadius: 20, background: s.bg, border: `1px solid ${s.border}`, color: s.color,
      fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.color }} />
      {s.label}
    </span>
  );
};

// ── Reverse geocode cache ─────────────────────────────────────────────────
const geoCache = {};

const reverseGeocode = async (lat, lng) => {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (geoCache[key]) return geoCache[key];
  try {
    const res  = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=16`,
      { headers: { "Accept-Language": "en" } }
    );
    const data = await res.json();
    const a    = data.address || {};
    const area = a.neighbourhood || a.suburb || a.village || a.town || a.city_district || a.county || "";
    const city = a.city || a.town || a.state_district || a.state || "";
    const label = [area, city].filter(Boolean).join(", ")
      || data.display_name?.split(",").slice(0, 2).join(", ")
      || key;
    geoCache[key] = label;
    return label;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
};

// ── GPSTag — shows reverse-geocoded area name, links to Google Maps ────────
const GPSTag = ({ gps }) => {
  const [label, setLabel] = useState(null);

  useEffect(() => {
    if (!gps?.lat) return;
    let cancelled = false;
    reverseGeocode(gps.lat, gps.lng).then((name) => { if (!cancelled) setLabel(name); });
    return () => { cancelled = true; };
  }, [gps?.lat, gps?.lng]);

  if (!gps?.lat) return null;

  return (
    <a
      href={`https://maps.google.com/?q=${gps.lat},${gps.lng}`}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10,
        color: "#0369a1", fontWeight: 600, background: "#eff6ff",
        padding: "2px 8px", borderRadius: 6, border: "1px solid #bae6fd",
        textDecoration: "none", maxWidth: "100%",
      }}
    >
      <AimOutlined style={{ flexShrink: 0 }} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label ?? `${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}`}
      </span>
    </a>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Photo Upload Field
// • Photos stored as an array (each element = { id, file, previewUrl, ... })
// • Every photo is compressed to ≤ 500 KB before preview / upload
// • Camera photos automatically receive GPS coordinates
// ─────────────────────────────────────────────────────────────────────────────
const PhotoUploadField = ({ photos, setPhotos }) => {
  const fileRef   = useRef(null);
  const camRef    = useRef(null);
  const [busy, setBusy] = useState(false);

  const process = async (files, fromCamera = false) => {
    const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) return;

    // Enforce per-visit cap
    const remaining = MAX_PHOTOS_PER_VISIT - photos.length;
    if (remaining <= 0) {
      message.warning(`Maximum ${MAX_PHOTOS_PER_VISIT} photos per visit reached.`);
      return;
    }
    const toProcess = imgs.slice(0, remaining);
    if (toProcess.length < imgs.length) {
      message.warning(`Only ${remaining} more photo(s) allowed. The rest were skipped.`);
    }

    setBusy(true);
    const gps = fromCamera ? await getGPS() : null;

    for (const file of toProcess) {
      const id = `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      try {
        const { file: compressed, previewUrl, compressedSizeKB } = await compressImage(file);
        // Store as array element
        setPhotos((prev) => [
          ...prev,
          { id, file: compressed, previewUrl, name: file.name, compressedSizeKB, gps },
        ]);
      } catch {
        // Fallback: add uncompressed (warn user)
        message.warning(`Could not compress ${file.name}; added as-is.`);
        setPhotos((prev) => [
          ...prev,
          {
            id,
            file,
            previewUrl: URL.createObjectURL(file),
            name: file.name,
            compressedSizeKB: Math.round(file.size / 1024),
            gps,
          },
        ]);
      }
    }
    setBusy(false);
  };

  const remove = (id) => {
    setPhotos((prev) => {
      const item = prev.find((x) => x.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((x) => x.id !== id);
    });
  };

  return (
    <div>
      <input ref={fileRef} type="file" multiple accept="image/*" style={{ display: "none" }}
        onChange={(e) => { process(e.target.files, false); e.target.value = ""; }} />
      <input ref={camRef}  type="file" accept="image/*" capture="environment" style={{ display: "none" }}
        onChange={(e) => { process(e.target.files, true); e.target.value = ""; }} />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8, alignItems: "center" }}>
        <Button size="small" icon={<UploadOutlined />} loading={busy}
          onClick={() => fileRef.current?.click()}
          style={{ borderRadius: 6, fontSize: 12 }}>
          {busy ? "Processing…" : photos.length ? "Add More" : "Upload Photos"}
        </Button>
        {!busy && (
          <Button size="small" icon={<CameraOutlined />}
            onClick={() => camRef.current?.click()}
            style={{ borderRadius: 6, fontSize: 12 }}>
            Camera
          </Button>
        )}
        {photos.length > 0 && (
          <span style={{ fontSize: 11, color: "#6b7280" }}>
            {photos.length}/{MAX_PHOTOS_PER_VISIT} photo{photos.length !== 1 ? "s" : ""} · all ≤ 500 KB
          </span>
        )}
      </div>

      {/* Photo grid — array of thumbnails */}
      {photos.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 8 }}>
          {photos.map((photo) => (
            <div key={photo.id} style={{ borderRadius: 8, border: "1px solid #e5e7eb", overflow: "hidden" }}>
              <div style={{ position: "relative", aspectRatio: "1" }}>
                <img src={photo.previewUrl} alt={photo.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <button onClick={() => remove(photo.id)}
                  style={{ position: "absolute", top: 3, right: 3, width: 18, height: 18,
                    borderRadius: "50%", background: "rgba(239,68,68,0.9)", border: "none",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <CloseCircleOutlined style={{ color: "#fff", fontSize: 10 }} />
                </button>
                <div style={{ position: "absolute", bottom: 3, left: 3,
                  background: photo.compressedSizeKB > 490 ? "rgba(239,68,68,0.8)" : "rgba(0,0,0,0.55)",
                  borderRadius: 3, padding: "1px 4px", fontSize: 9, color: "#fff" }}>
                  {photo.compressedSizeKB}KB
                </div>
              </div>
              {photo.gps?.lat && (
                <div style={{ padding: "3px 4px", background: "#f0f9ff", borderTop: "1px solid #e5e7eb" }}>
                  <GPSTag gps={photo.gps} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// User Selector
// ─────────────────────────────────────────────────────────────────────────────
const UserSelector = ({ value, onChange, placeholder = "Search staff…", excludeIds = [] }) => {
  const [users,   setUsers]   = useState([]);
  const [search,  setSearch]  = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const res  = await fetch(ADMIN_API, { headers: authHeader() });
        const data = await res.json();
        const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
        setUsers(list);
      } catch { /* silent */ }
      finally { setLoading(false); }
    };
    fetchUsers();
  }, []);

  const filtered = users.filter((u) => {
    if (excludeIds.includes(String(u._id))) return false;
    const term = search.toLowerCase();
    return !term || (u.name || "").toLowerCase().includes(term) || (u.email || "").toLowerCase().includes(term);
  });

  return (
    <Select
      showSearch value={value || undefined} placeholder={placeholder}
      loading={loading} filterOption={false} onSearch={setSearch}
      onChange={onChange} style={{ width: "100%" }} allowClear
      onClear={() => onChange(null)}
    >
      {filtered.map((u) => (
        <Select.Option key={u._id} value={u._id}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Avatar size={20} style={{ background: "#0369a1", fontSize: 10 }}>
              {(u.name || "?")[0].toUpperCase()}
            </Avatar>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.2 }}>{u.name || "—"}</div>
              {u.email && <div style={{ fontSize: 10, color: "#9ca3af" }}>{u.email}</div>}
            </div>
          </div>
        </Select.Option>
      ))}
    </Select>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Measurements Panel
// ─────────────────────────────────────────────────────────────────────────────
const EMPTY_MEAS = { label: "", width: "", height: "", unit: "ft", sq_ft: 0, notes: "" };

const MeasurementsPanel = ({ measurements, onChange }) => {
  const add    = () => onChange([...measurements, { ...EMPTY_MEAS }]);
  const remove = (i) => onChange(measurements.filter((_, idx) => idx !== i));
  const set    = (i, field, val) => {
    const updated = measurements.map((m, idx) => {
      if (idx !== i) return m;
      const next = { ...m, [field]: val };
      if (["width","height","unit"].includes(field) && !next.sq_ft_manual) {
        next.sq_ft = parseFloat(toSqFt(next.width, next.height, next.unit).toFixed(4));
      }
      return next;
    });
    onChange(updated);
  };

  return (
    <div>
      {measurements.map((m, i) => (
        <div key={i} style={{ background: "#f9fafb", border: "1px solid #e5e7eb",
          borderRadius: 10, padding: 12, marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#374151",
              background: "#e0f2fe", padding: "2px 10px", borderRadius: 20 }}>
              Measurement {i + 1}
            </span>
            <Popconfirm title="Remove?" onConfirm={() => remove(i)} okText="Yes" cancelText="No">
              <Button size="small" danger type="text" icon={<DeleteOutlined />} />
            </Popconfirm>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
            <FormField label="Label / Area">
              <Input size="small" placeholder="e.g. Main Wall" value={m.label}
                onChange={(e) => set(i, "label", e.target.value)} style={{ borderRadius: 6 }} />
            </FormField>
            <FormField label="Width">
              <Input size="small" type="number" placeholder="0" value={m.width}
                onChange={(e) => set(i, "width", e.target.value)} style={{ borderRadius: 6 }} />
            </FormField>
            <FormField label="Height">
              <Input size="small" type="number" placeholder="0" value={m.height}
                onChange={(e) => set(i, "height", e.target.value)} style={{ borderRadius: 6 }} />
            </FormField>
            <FormField label="Unit">
              <Select size="small" value={m.unit} style={{ width: "100%" }}
                onChange={(v) => set(i, "unit", v)}>
                {UNIT_OPTIONS.map((u) => (
                  <Select.Option key={u.value} value={u.value}>{u.label}</Select.Option>
                ))}
              </Select>
            </FormField>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
            <FormField label="Sq. Ft (auto)">
              <InputNumber size="small" min={0} step={0.01} value={m.sq_ft || 0}
                style={{ width: "100%", borderRadius: 6, background: "#ecfdf5" }}
                onChange={(val) => {
                  const updated = measurements.map((x, idx) =>
                    idx === i ? { ...x, sq_ft: parseFloat(val) || 0, sq_ft_manual: true } : x
                  );
                  onChange(updated);
                }} />
            </FormField>
            <FormField label="Notes">
              <Input size="small" placeholder="Specific notes…" value={m.notes}
                onChange={(e) => set(i, "notes", e.target.value)} style={{ borderRadius: 6 }} />
            </FormField>
          </div>

          {m.sq_ft > 0 && (
            <div style={{ marginTop: 6, fontSize: 11, color: "#059669", fontWeight: 600 }}>
              = {m.sq_ft.toFixed(2)} sq.ft
              {m.width && m.height && (
                <span style={{ color: "#9ca3af", fontWeight: 400 }}> ({m.width} × {m.height} {m.unit})</span>
              )}
            </div>
          )}
        </div>
      ))}

      <Button icon={<PlusOutlined />} onClick={add} block
        style={{ borderStyle: "dashed", borderRadius: 8, color: "#6b7280", height: 36, marginTop: 4 }}>
        Add Measurement
      </Button>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Invite Members Panel
// ─────────────────────────────────────────────────────────────────────────────
const InviteMembersPanel = ({ visitId, members, onMembersChange }) => {
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [allUsers, setAllUsers]   = useState([]);
  const [inviting, setInviting]   = useState(false);
  const [removing, setRemoving]   = useState(null);

  useEffect(() => {
    fetch(ADMIN_API, { headers: authHeader() })
      .then((r) => r.json())
      .then((d) => setAllUsers(Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const handleInvite = async () => {
    if (!selectedUserId) return;
    const user = allUsers.find((u) => String(u._id) === String(selectedUserId));
    if (!user) return;
    setInviting(true);
    try {
      const res  = await fetch(`${BASE}/${visitId}/members`, {
        method: "POST", headers: jsonHeader(),
        body: JSON.stringify({ user_id: user._id, name: user.name, email: user.email || "", phone: user.phone || "" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);
      onMembersChange(data.data.team_members || []);
      setSelectedUserId(null);
      message.success(`${user.name} invited!`);
    } catch (e) { message.error(e.message); }
    finally { setInviting(false); }
  };

  const handleRemove = async (memberId) => {
    setRemoving(memberId);
    try {
      const res  = await fetch(`${BASE}/${visitId}/members/${memberId}`, { method: "DELETE", headers: jsonHeader() });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);
      onMembersChange(data.data.team_members || []);
      message.success("Member removed");
    } catch (e) { message.error(e.message); }
    finally { setRemoving(null); }
  };

  const existingIds = members.map((m) => String(m.user_id));

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <UserSelector
            value={selectedUserId}
            onChange={setSelectedUserId}
            placeholder="Search & invite staff…"
            excludeIds={existingIds}
          />
        </div>
        <Button type="primary" icon={<PlusOutlined />} loading={inviting}
          disabled={!selectedUserId} onClick={handleInvite}
          style={{ background: "#0369a1", border: "none", borderRadius: 8 }}>
          Invite
        </Button>
      </div>

      {members.length === 0 && (
        <div style={{ textAlign: "center", padding: "16px 0", color: "#9ca3af", fontSize: 12 }}>
          No team members yet. Invite someone above.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {members.map((m) => (
          <div key={m._id} style={{ display: "flex", alignItems: "center", gap: 10,
            background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 12px" }}>
            <Avatar style={{ background: "#7c3aed", fontSize: 12, flexShrink: 0 }}>
              {(m.name || "?")[0].toUpperCase()}
            </Avatar>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>{m.name}</div>
              {m.email && <div style={{ fontSize: 11, color: "#9ca3af" }}>{m.email}</div>}
            </div>
            <Tag color="blue" style={{ fontSize: 10 }}>{m.role || "Field Staff"}</Tag>
            <Popconfirm title="Remove this member?" onConfirm={() => handleRemove(m._id)} okText="Yes" cancelText="No">
              <Button size="small" danger type="text" icon={<DeleteOutlined />} loading={removing === m._id} />
            </Popconfirm>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Convert to Job Sheet Modal
// Creates a job pre-filled with site visit data.
// Passes site_visit_id so the backend can link the job back to the visit.
// ─────────────────────────────────────────────────────────────────────────────
const ConvertToJobModal = ({ open, onClose, visit, userId, userName, onSuccess }) => {
  const [converting, setConverting] = useState(false);
  const [error,      setError]      = useState("");
  const [jobNotes,   setJobNotes]   = useState("");
  const [validUntil, setValidUntil] = useState(() => dayjs().add(30, "day"));

  useEffect(() => {
    if (open) {
      setError("");
      setJobNotes(visit?.notes || "");
      setValidUntil(dayjs().add(30, "day"));
    }
  }, [open, visit]);

  if (!visit) return null;

  // Build cart items from measurements (one product line per measurement)
  const buildCartItems = () => {
    const meas = visit.measurements || [];
    if (!meas.length) return [];
    return meas.map((m, idx) => ({
      item_id:       `sv_item_${idx + 1}`,
      item_category: "product",
      product_name:  m.label || `Item ${idx + 1}`,
      variation:     visit.site_type || "",
      width:         m.width  || "",
      height:        m.height || "",
      size_unit:     m.unit   || "ft",
      sq_ft:         m.sq_ft  || 0,
      quantity:      1,
      quantity_type: "pcs",
      price:         0,
      gst_percentage: 0,
      gst_amount:    0,
      line_base:     0,
      line_total:    0,
      notes:         m.notes  || "",
      design_status: "pending",
      design_files:  [],
      designers:     [],
    }));
  };

  const handleConvert = async () => {
    setConverting(true);
    setError("");
    try {
      const cartItems = buildCartItems();
      const today     = new Date();

      const payload = {
        // Customer info pre-filled from visit
        customer_name:  visit.customer_name  || "",
        customer_phone: visit.customer_phone || "",
        company_name:   visit.company_name   || "",

        // Delivery address from site address
        delivery_address: {
          street:  [visit.address_line1, visit.address_line2].filter(Boolean).join(", "),
          city:    visit.city    || "",
          state:   visit.state   || "",
          pincode: visit.pincode || "",
          country: visit.country || "India",
        },

        cart_items: cartItems,

        // Financials — zero until admin fills in pricing
        subtotal:            0,
        discount_percentage: 0,
        discount_amount:     0,
        taxable_amount:      0,
        tax_amount:          0,
        delivery_charges:    0,
        free_delivery:       false,
        total_amount:        0,
        payment_amount:      0,
        balance_amount:      0,

        valid_until: validUntil.toISOString(),
        estimated_delivery_date: visit.estimated_delivery_date || null,
        order_date: today.toISOString(),

        notes: jobNotes,
        job_status: "draft",

        // ── Key: link back to site visit ──────────────────────────────────
        site_visit_id:   visit._id,
        site_visit_no:   visit.visit_no,
        site_visit_photos: visit.photos || [],

        created_by:          userName,
        created_by_admin_id: userId,
      };

      const res  = await fetch(JOBS_API, {
        method: "POST",
        headers: jsonHeader(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to create job");

      // Mark the site visit as converted (using existing /convert endpoint)
      await fetch(`${BASE}/${visit._id}/convert`, {
        method: "PATCH",
        headers: jsonHeader(),
        body: JSON.stringify({ job_id: data.data?._id || data.job?._id }),
      });

      message.success(`Job ${data.job?.job_no || data.data?.job_no} created from site visit ${visit.visit_no}!`);
      onSuccess();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setConverting(false);
    }
  };

  const meas = visit.measurements || [];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ShoppingCartOutlined style={{ color: "#7c3aed" }} />
          <span style={{ fontWeight: 700 }}>Convert to Job Sheet</span>
          <Tag color="purple" style={{ fontSize: 10 }}>{visit.visit_no}</Tag>
        </div>
      }
      width="min(96vw, 560px)"
      styles={{ body: { maxHeight: "80vh", overflowY: "auto", padding: 20 } }}
      destroyOnClose
    >
      <Spin spinning={converting}>
        {error && (
          <div style={{ marginBottom: 12, padding: "10px 14px", background: "#fef2f2",
            border: "1px solid #fca5a5", borderRadius: 8, color: "#b91c1c", fontSize: 13 }}>
            ⚠ {error}
          </div>
        )}

        {/* Summary card */}
        <div style={{ background: "linear-gradient(135deg,#f5f3ff,#eff6ff)", border: "1px solid #c4b5fd",
          borderRadius: 12, padding: "12px 14px", marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: "#5b21b6", marginBottom: 4 }}>
            {visit.customer_name}
            {visit.company_name && <span style={{ fontWeight: 400, color: "#7c3aed", fontSize: 12 }}> · {visit.company_name}</span>}
          </div>
          <div style={{ fontSize: 12, color: "#374151" }}>
            <PhoneOutlined style={{ marginRight: 4, color: "#7c3aed" }} />{visit.customer_phone}
          </div>
          {visit.address_line1 && (
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
              <EnvironmentOutlined style={{ marginRight: 4 }} />
              {[visit.address_line1, visit.city, visit.state].filter(Boolean).join(", ")}
            </div>
          )}
        </div>

        {/* Measurements preview — these become job cart items */}
        {meas.length > 0 ? (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase",
              marginBottom: 8 }}>
              Measurements → Job Items ({meas.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {meas.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between",
                  background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8,
                  padding: "8px 12px", fontSize: 12 }}>
                  <span style={{ fontWeight: 600, color: "#374151" }}>{m.label || `Item ${i + 1}`}</span>
                  <span style={{ color: "#0369a1", fontWeight: 700 }}>
                    {m.sq_ft > 0
                      ? `${m.sq_ft.toFixed(2)} sq.ft (${m.width}×${m.height} ${m.unit})`
                      : `${m.width || "—"} × ${m.height || "—"} ${m.unit}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <Alert type="info" showIcon style={{ marginBottom: 16, borderRadius: 8 }}
            message={<span style={{ fontSize: 12 }}>No measurements recorded. Job will be created with an empty cart — add items after creation.</span>} />
        )}

        {/* Valid until */}
        <div style={{ marginBottom: 12 }}>
          <FormField label="Quotation Valid Until" required>
            <DatePicker
              value={validUntil}
              format="DD MMM YYYY"
              disabledDate={(c) => c && c < dayjs().startOf("day")}
              onChange={(v) => setValidUntil(v)}
              style={{ width: "100%", borderRadius: 8 }}
              needConfirm
            />
          </FormField>
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 20 }}>
          <FormField label="Job Notes">
            <Input.TextArea
              rows={3}
              placeholder="Add any notes for the job sheet…"
              value={jobNotes}
              onChange={(e) => setJobNotes(e.target.value)}
              style={{ borderRadius: 8, resize: "vertical" }}
            />
          </FormField>
        </div>

        <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 8,
          padding: "8px 12px", fontSize: 12, color: "#92400e", marginBottom: 16 }}>
          <strong>Note:</strong> Pricing is set to ₹0. Open the job sheet after creation to add product rates and finalize the quotation.
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Button onClick={onClose} style={{ borderRadius: 8, height: 40 }}>Cancel</Button>
          <Button type="primary" loading={converting} onClick={handleConvert}
            icon={<ShoppingCartOutlined />}
            style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)", border: "none",
              borderRadius: 8, height: 40, fontWeight: 700, minWidth: 180 }}>
            {converting ? "Creating Job…" : "Create Job Sheet"}
          </Button>
        </div>
      </Spin>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// NEW SITE VISIT MODAL
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_FORM = {
  customer_name: "", customer_phone: "", company_name: "",
  address_line1: "", address_line2: "", city: "", state: "", pincode: "", country: "India",
  site_type: "", visit_purpose: "", notes: "",
  visit_date: null, estimated_delivery_date: null,
  assigned_to_id: null,
};

const NewSiteVisitModal = ({ open, onClose, onSuccess, userId, userName }) => {
  const { isMobile } = useBreakpoint();
  const [form,       setForm]       = useState({ ...DEFAULT_FORM });
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");
  const [allUsers,   setAllUsers]   = useState([]);

  useEffect(() => {
    if (open) {
      setForm({ ...DEFAULT_FORM, visit_date: dayjs() });
      setError("");
      fetch(ADMIN_API, { headers: authHeader() })
        .then((r) => r.json())
        .then((d) => setAllUsers(Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : []))
        .catch(() => {});
    }
  }, [open]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const c2  = isMobile ? "1fr" : "1fr 1fr";

  const handleSubmit = async () => {
    setSubmitting(true); setError("");
    try {
      if (!form.customer_name.trim())  throw new Error("Customer name is required");
      if (!form.customer_phone.trim()) throw new Error("Phone is required");
      if (!form.address_line1.trim())  throw new Error("Address line 1 is required");

      let assigned_to = {};
      if (form.assigned_to_id) {
        const u = allUsers.find((x) => String(x._id) === String(form.assigned_to_id));
        if (u) assigned_to = { user_id: u._id, name: u.name };
      }

      const payload = {
        customer_name:  form.customer_name.trim(),
        customer_phone: form.customer_phone.trim(),
        company_name:   form.company_name.trim(),
        address_line1:  form.address_line1.trim(),
        address_line2:  form.address_line2.trim(),
        city: form.city, state: form.state, pincode: form.pincode, country: form.country,
        site_type: form.site_type, visit_purpose: form.visit_purpose, notes: form.notes,
        visit_date: (form.visit_date || dayjs()).toISOString(),
        estimated_delivery_date: form.estimated_delivery_date?.toISOString() || null,
        assigned_to,
        created_by_id:   userId,
        created_by_name: userName,
      };

      const res  = await fetch(BASE, { method: "POST", headers: jsonHeader(), body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to create");

      message.success(`Site visit ${data.data?.visit_no} created!`);
      onSuccess();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const modalWidth = isMobile ? "100vw" : "min(96vw, 720px)";

  return (
    <Modal open={open} onCancel={onClose} footer={null}
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <EnvironmentOutlined style={{ color: "#0369a1" }} />
          <span style={{ fontWeight: 700 }}>New Site Visit</span>
        </div>
      }
      width={modalWidth}
      style={isMobile ? { top: 0, margin: 0, maxWidth: "100vw" } : {}}
      styles={{ body: { maxHeight: "85vh", overflowY: "auto", padding: isMobile ? 12 : 20 } }}
      destroyOnClose>
      <Spin spinning={submitting}>
        {error && (
          <div style={{ marginBottom: 12, padding: "10px 14px", background: "#fef2f2",
            border: "1px solid #fca5a5", borderRadius: 8, color: "#b91c1c", fontSize: 13 }}>
            ⚠ {error}
          </div>
        )}

        <SectionHeader icon={<UserOutlined />} title="Customer" />
        <div style={{ display: "grid", gridTemplateColumns: c2, gap: 10, marginBottom: 10 }}>
          <FormField label="Customer Name" required>
            <Input prefix={<UserOutlined style={{ color: "#9ca3af" }} />} placeholder="Full name"
              value={form.customer_name} onChange={(e) => set("customer_name", e.target.value)} style={{ borderRadius: 8 }} />
          </FormField>
          <FormField label="Phone" required>
            <Input prefix={<PhoneOutlined style={{ color: "#9ca3af" }} />} placeholder="Mobile number"
              value={form.customer_phone} maxLength={15}
              onChange={(e) => set("customer_phone", e.target.value)} style={{ borderRadius: 8 }} />
          </FormField>
        </div>
        <div style={{ marginBottom: 10 }}>
          <FormField label="Company Name">
            <Input placeholder="Business / Company" value={form.company_name}
              onChange={(e) => set("company_name", e.target.value)} style={{ borderRadius: 8 }} />
          </FormField>
        </div>

        <SectionHeader icon={<EnvironmentOutlined />} title="Site Address" />
        <div style={{ display: "grid", gridTemplateColumns: c2, gap: 10, marginBottom: 10 }}>
          <FormField label="Address Line 1" required>
            <Input placeholder="Building / Street" value={form.address_line1}
              onChange={(e) => set("address_line1", e.target.value)} style={{ borderRadius: 8 }} />
          </FormField>
          <FormField label="Address Line 2">
            <Input placeholder="Area / Landmark" value={form.address_line2}
              onChange={(e) => set("address_line2", e.target.value)} style={{ borderRadius: 8 }} />
          </FormField>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 10, marginBottom: 10 }}>
          {[["city","City"],["state","State"],["pincode","Pincode"],["country","Country"]].map(([k,l]) => (
            <FormField key={k} label={l}>
              <Input placeholder={l} value={form[k]} onChange={(e) => set(k, e.target.value)} style={{ borderRadius: 8 }} />
            </FormField>
          ))}
        </div>

        <SectionHeader icon={<ClockCircleOutlined />} title="Visit Details" />
        <div style={{ display: "grid", gridTemplateColumns: c2, gap: 10, marginBottom: 10 }}>
          <FormField label="Site Type">
            <Select placeholder="Select type" value={form.site_type || undefined}
              onChange={(v) => set("site_type", v)} style={{ width: "100%" }} allowClear>
              {SITE_TYPES.map((t) => <Select.Option key={t} value={t}>{t}</Select.Option>)}
            </Select>
          </FormField>
          <FormField label="Visit Purpose">
            <Input placeholder="Measurement, survey, demo…" value={form.visit_purpose}
              onChange={(e) => set("visit_purpose", e.target.value)} style={{ borderRadius: 8 }} />
          </FormField>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: c2, gap: 10, marginBottom: 10 }}>
          <FormField label="Visit Date">
            <DatePicker showTime={{ format: "hh:mm A", use12Hours: true }}
              format="DD MMM YYYY  hh:mm A" value={form.visit_date}
              onChange={(v) => set("visit_date", v)}
              style={{ width: "100%", borderRadius: 8 }} needConfirm
              getPopupContainer={(t) => t.parentElement} />
          </FormField>
          
        </div>

        <SectionHeader icon={<TeamOutlined />} title="Assign To" />
        <div style={{ marginBottom: 10 }}>
          <FormField label="Assign Field Staff">
            <UserSelector
              value={form.assigned_to_id}
              onChange={(v) => set("assigned_to_id", v)}
              placeholder="Select staff member to assign…"
            />
          </FormField>
        </div>

        <SectionHeader icon={<FileTextOutlined />} title="Notes" />
        <div style={{ marginBottom: 16 }}>
          <Input.TextArea rows={3} placeholder="Special instructions, observations…"
            value={form.notes} onChange={(e) => set("notes", e.target.value)}
            style={{ borderRadius: 8, resize: "vertical" }} />
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Button onClick={onClose} style={{ borderRadius: 8, height: 40 }}>Cancel</Button>
          <Button type="primary" onClick={handleSubmit} loading={submitting}
            style={{ background: "#0369a1", border: "none", borderRadius: 8, height: 40, fontWeight: 700, minWidth: 140 }}>
            Create Site Visit
          </Button>
        </div>
      </Spin>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// WORKSPACE DRAWER  (opened per visit)
// ─────────────────────────────────────────────────────────────────────────────
const WorkspaceDrawer = ({
  open, onClose, visit, isLive, liveTimerSecs,
  onStartSession, onCloseSession, onRefresh,
  userId, userName,
}) => {
  const [tab,            setTab]          = useState("sheet");
  const [measurements,   setMeasurements] = useState([]);
  const [observations,   setObservations] = useState("");
  const [recommendation, setRecommend]    = useState("");
  // newPhotos is always an ARRAY of { id, file, previewUrl, name, compressedSizeKB, gps }
  const [newPhotos,      setNewPhotos]    = useState([]);
  const [saving,         setSaving]       = useState(false);
  const [actionModal,    setActionModal]  = useState(null);
  const [actionNotes,    setActionNotes]  = useState("");
  const [actioning,      setActioning]    = useState(false);
  const [members,        setMembers]      = useState([]);
  // Convert to Job Sheet modal
  const [jobModal,       setJobModal]     = useState(false);

  useEffect(() => {
    if (open && visit) {
      setMeasurements(visit.measurements?.length ? visit.measurements.map((m) => ({ ...m })) : []);
      setObservations(visit.observations || "");
      setRecommend(visit.recommendation || "");
      setNewPhotos([]);   // reset to empty array
      setMembers(visit.team_members || []);
      setTab("sheet");
      setJobModal(false);
    }
  }, [open, visit?._id]);

  if (!visit) return null;

  const statusFromVisit = () => {
    if (visit.converted_to_job) return "converted";
    if (isLive) return "in_progress";
    if (visit.status) return visit.status;
    return "scheduled";
  };

  const fullAddress = [visit.address_line1, visit.address_line2, visit.city, visit.state, visit.pincode]
    .filter(Boolean).join(", ");

  const handleAction = async () => {
    setActioning(true);
    try {
      if (actionModal === "start") {
        await onStartSession(visit._id, actionNotes);
      } else {
        await onCloseSession(visit._id, actionModal === "pause" ? "paused" : "completed", actionNotes);
      }
      setActionModal(null);
      setActionNotes("");
    } catch (e) { message.error(e.message); }
    finally { setActioning(false); }
  };

  const handleSaveSheet = async () => {
    setSaving(true);
    try {
      // 1. Upload new photos array — each photo compressed to ≤ 500 KB already
      const uploadedPhotos = [];
      for (const p of newPhotos) {
        try {
          const url = await uploadFileToServer(p.file);
          uploadedPhotos.push({ url, caption: "", gps: p.gps || null });
        } catch { message.warning(`Could not upload ${p.name}`); }
      }

      // 2. Persist photo array to server
      if (uploadedPhotos.length) {
        await fetch(`${BASE}/${visit._id}/photos`, {
          method: "POST", headers: jsonHeader(),
          body: JSON.stringify({ photos: uploadedPhotos }),
        });
      }

      // 3. Save measurements array
      await fetch(`${BASE}/${visit._id}/measurements`, {
        method: "PUT", headers: jsonHeader(),
        body: JSON.stringify({ measurements }),
      });

      // 4. Save observations / recommendation
      await fetch(`${BASE}/${visit._id}/sheet`, {
        method: "PATCH", headers: jsonHeader(),
        body: JSON.stringify({ observations, recommendation }),
      });

      message.success("Sheet saved!");
      setNewPhotos([]);
      onRefresh();
    } catch (e) { message.error(e.message); }
    finally { setSaving(false); }
  };

  const TABS = [
    { key: "sheet",   label: "📋 Sheet"  },
    { key: "photos",  label: "📷 Photos" },
    { key: "members", label: "👥 Team"   },
  ];

  // Whether "Convert to Job Sheet" should be available
  const canConvert = !visit.converted_to_job
    && (visit.status === "completed" || visit.total_duration_seconds > 0);

  return (
    <>
      <Drawer open={open} onClose={onClose} width={640}
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8,
              background: isLive
                ? "linear-gradient(135deg,#16a34a,#22c55e)"
                : "linear-gradient(135deg,#0369a1,#0ea5e9)",
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <EnvironmentOutlined style={{ color: "#fff", fontSize: 14 }} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: "#111827" }}>
                {visit.visit_no}
                {isLive && (
                  <span style={{ marginLeft: 8, fontSize: 9, fontWeight: 700,
                    background: "#dcfce7", color: "#16a34a", padding: "2px 8px",
                    borderRadius: 8, border: "1px solid #86efac" }}>
                    ● LIVE
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>{visit.customer_name}</div>
            </div>
          </div>
        }
        styles={{ body: { padding: "0", overflowY: "auto" } }}>

        {/* ── Info Card ── */}
        <div style={{ padding: "14px 20px",
          background: "linear-gradient(135deg,#f0f9ff,#f0fdf4)",
          borderBottom: "1px solid #e5e7eb" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: "#111827" }}>{visit.customer_name}</div>
              {visit.company_name && <div style={{ fontSize: 12, color: "#6b7280" }}>{visit.company_name}</div>}
              {visit.customer_phone && (
                <div style={{ fontSize: 12, color: "#374151", marginTop: 2 }}>
                  <PhoneOutlined style={{ marginRight: 4, color: "#0369a1" }} />{visit.customer_phone}
                </div>
              )}
            </div>
            <StatusBadge status={statusFromVisit()} />
          </div>
          {fullAddress && (
            <div style={{ fontSize: 12, color: "#374151", display: "flex", alignItems: "flex-start", gap: 5, marginTop: 4 }}>
              <EnvironmentOutlined style={{ color: "#d97706", marginTop: 1, flexShrink: 0 }} />
              <span>{fullAddress}</span>
            </div>
          )}
          {visit.assigned_to?.name && (
            <div style={{ marginTop: 6, fontSize: 12, color: "#7c3aed" }}>
              <TeamOutlined style={{ marginRight: 4 }} />
              <strong>Assigned to:</strong> {visit.assigned_to.name}
            </div>
          )}
          {visit.site_type    && <Tag color="cyan" style={{ marginTop: 6, fontSize: 10 }}>{visit.site_type}</Tag>}
          {visit.visit_purpose && <Tag color="gold" style={{ marginTop: 6, fontSize: 10 }}>{visit.visit_purpose}</Tag>}
        </div>

        {/* ── Timer ── */}
        <div style={{ padding: "14px 20px",
          background: isLive ? "#f0fdf4" : "#f9fafb",
          borderBottom: "2px solid " + (isLive ? "#16a34a" : "#e5e7eb") }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700,
              color: isLive ? "#15803d" : "#6b7280",
              textTransform: "uppercase", letterSpacing: "0.06em" }}>
              <FieldTimeOutlined style={{ marginRight: 4 }} />Time on Site
            </span>
            {isLive && (
              <span style={{ fontSize: 10, background: "#dcfce7", color: "#16a34a",
                padding: "2px 8px", borderRadius: 8, fontWeight: 700 }}>● LIVE</span>
            )}
          </div>
          <div style={{ fontFamily: "monospace", fontSize: 36, fontWeight: 800,
            color: isLive ? "#166534" : "#9ca3af", letterSpacing: "-0.02em", lineHeight: 1 }}>
            {fmtSecs(liveTimerSecs)}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            {!isLive && !visit.converted_to_job && (
              <Button type="primary" icon={<PlayCircleOutlined />}
                onClick={() => { setActionModal("start"); setActionNotes(""); }}
                style={{ flex: 1, height: 36, background: "#16a34a", border: "none", borderRadius: 8, fontWeight: 700 }}>
                {visit.status === "scheduled" ? "Start Visit" : "Resume Visit"}
              </Button>
            )}
            {isLive && (
              <>
                <Button icon={<PauseCircleOutlined />} danger
                  onClick={() => { setActionModal("pause"); setActionNotes(""); }}
                  style={{ flex: 1, height: 36, borderRadius: 8, fontWeight: 700 }}>
                  Pause
                </Button>
                <Button icon={<CheckCircleOutlined />}
                  onClick={() => { setActionModal("done"); setActionNotes(""); }}
                  style={{ flex: 1, height: 36, background: "#0369a1", border: "none",
                    color: "#fff", borderRadius: 8, fontWeight: 700 }}>
                  Mark Done
                </Button>
              </>
            )}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb", background: "#fff" }}>
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ flex: 1, padding: "10px 0", border: "none", background: "none", cursor: "pointer",
                borderBottom: tab === t.key ? "2px solid #0369a1" : "2px solid transparent",
                color: tab === t.key ? "#0369a1" : "#6b7280",
                fontWeight: tab === t.key ? 700 : 500, fontSize: 13 }}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ padding: "16px 20px" }}>

          {/* ─── SHEET TAB ─────────────────────────────────────────────── */}
          {tab === "sheet" && (
            <div>
              <SectionHeader icon={<EyeOutlined />} title="Measurements" />
              <MeasurementsPanel measurements={measurements} onChange={setMeasurements} />

              <SectionHeader icon={<FileTextOutlined />} title="Observations" />
              <Input.TextArea rows={3}
                placeholder="Site conditions, existing signage, challenges…"
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                style={{ borderRadius: 8, marginBottom: 12, fontSize: 12 }} />

              <SectionHeader icon={<StarOutlined />} title="Recommendation" />
              <Input.TextArea rows={2}
                placeholder="Recommended materials, approach, timeline…"
                value={recommendation}
                onChange={(e) => setRecommend(e.target.value)}
                style={{ borderRadius: 8, marginBottom: 16, fontSize: 12 }} />

              {visit.notes && (
                <Alert type="info" showIcon
                  message={<span style={{ fontSize: 12 }}><strong>Visit Notes:</strong> {visit.notes}</span>}
                  style={{ borderRadius: 8, marginBottom: 12 }} />
              )}

              <Button type="primary" loading={saving} onClick={handleSaveSheet} block
                style={{ height: 42,
                  background: "linear-gradient(135deg,#0369a1,#0ea5e9)",
                  border: "none", borderRadius: 10, fontWeight: 700, fontSize: 13 }}>
                {saving ? "Saving…" : "Save Sheet"}
              </Button>

              {/* ── Convert to Job Sheet ───────────────────────────────── */}
              {canConvert && (
                <div style={{ marginTop: 14, background: "linear-gradient(135deg,#f5f3ff,#eff6ff)",
                  border: "2px solid #c4b5fd", borderRadius: 14, padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <ShoppingCartOutlined style={{ color: "#7c3aed", fontSize: 18 }} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>Convert to Job Sheet</div>
                      <div style={{ fontSize: 11, color: "#7c3aed" }}>
                        Create a job order pre-filled with measurements &amp; customer info
                      </div>
                    </div>
                  </div>
                  <Button
                    type="primary"
                    icon={<ShoppingCartOutlined />}
                    block
                    onClick={() => setJobModal(true)}
                    style={{ height: 40,
                      background: "linear-gradient(135deg,#7c3aed,#6d28d9)",
                      border: "none", borderRadius: 10, fontWeight: 700 }}>
                    Convert to Job Sheet
                  </Button>
                </div>
              )}

              {/* Legacy "Convert to Production Job" rocket button is replaced above.
                  Keep it only when the visit was already converted. */}
              {visit.converted_to_job && (
                <Alert type="success" showIcon icon={<ShoppingCartOutlined />}
                  message={
                    <span>
                      Already converted to a job sheet.
                      {visit.job_id && (
                        <span style={{ marginLeft: 6, fontSize: 11, color: "#7c3aed", fontWeight: 600 }}>
                          Job ID: {String(visit.job_id).slice(-6)}
                        </span>
                      )}
                    </span>
                  }
                  style={{ borderRadius: 10, marginTop: 12 }} />
              )}
            </div>
          )}

          {/* ─── PHOTOS TAB ──────────────────────────────────────────── */}
          {tab === "photos" && (
            <div>
              {/* Existing server-persisted photos (array) */}
              {visit.photos?.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280",
                    textTransform: "uppercase", marginBottom: 8 }}>
                    Saved Photos ({visit.photos.length})
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 8 }}>
                    {visit.photos.map((ph) => (
                      <div key={ph._id} style={{ borderRadius: 8, border: "2px solid #bae6fd", overflow: "hidden" }}>
                        <a href={ph.url} target="_blank" rel="noopener noreferrer">
                          <div style={{ aspectRatio: "1", overflow: "hidden" }}>
                            <img src={ph.url} alt="site"
                              style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          </div>
                        </a>
                        {ph.gps?.lat && (
                          <div style={{ padding: "3px 4px", background: "#f0f9ff", borderTop: "1px solid #bae6fd" }}>
                            <GPSTag gps={ph.gps} />
                          </div>
                        )}
                        {ph.caption && (
                          <div style={{ padding: "3px 6px", fontSize: 10, color: "#374151" }}>{ph.caption}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 8, fontSize: 11, color: "#6b7280" }}>
                📍 Photos taken via <strong>Camera</strong> will auto-attach GPS coordinates.{" "}
                All photos are compressed to <strong>≤ 500 KB</strong> before upload.
              </div>

              {/* PhotoUploadField manages an array of pending photos */}
              <PhotoUploadField photos={newPhotos} setPhotos={setNewPhotos} />

              {newPhotos.length > 0 && (
                <Button type="primary" loading={saving} onClick={handleSaveSheet}
                  style={{ marginTop: 12, height: 40, background: "#0369a1", border: "none",
                    borderRadius: 8, fontWeight: 700, width: "100%" }}>
                  Upload {newPhotos.length} Photo{newPhotos.length > 1 ? "s" : ""}
                </Button>
              )}
            </div>
          )}

          {/* ─── MEMBERS TAB ─────────────────────────────────────────── */}
          {tab === "members" && (
            <div>
              <div style={{ marginBottom: 10, padding: "8px 12px", background: "#f0f9ff",
                borderRadius: 8, fontSize: 12, color: "#0369a1" }}>
                Invite additional field staff to join this site visit.
              </div>
              <InviteMembersPanel
                visitId={visit._id}
                members={members}
                onMembersChange={setMembers}
              />
            </div>
          )}
        </div>
      </Drawer>

      {/* ── Session Action Modal ── */}
      <Modal open={!!actionModal} onCancel={() => !actioning && setActionModal(null)} width={400}
        title={
          <span style={{ fontWeight: 700 }}>
            {actionModal === "start" && "Start / Resume Visit"}
            {actionModal === "pause" && "Pause Visit"}
            {actionModal === "done"  && "Mark Visit as Completed"}
          </span>
        }
        footer={[
          <Button key="c" onClick={() => setActionModal(null)} disabled={actioning}>Cancel</Button>,
          <Button key="ok" type="primary" loading={actioning} onClick={handleAction}
            style={{
              background: actionModal === "pause" ? "#f97316"
                : actionModal === "done" ? "#16a34a" : "#0369a1",
              border: "none",
            }}>
            Confirm
          </Button>,
        ]}
        destroyOnClose>
        <Input.TextArea rows={3}
          placeholder={
            actionModal === "start" ? "Notes on starting this visit…"
            : actionModal === "pause" ? "Reason for pause…"
            : "Summary of visit, next steps…"
          }
          value={actionNotes}
          onChange={(e) => setActionNotes(e.target.value)}
          style={{ borderRadius: 8, marginTop: 12 }} />
      </Modal>

      {/* ── Convert to Job Sheet Modal ── */}
      <ConvertToJobModal
        open={jobModal}
        onClose={() => setJobModal(false)}
        visit={visit}
        userId={userId}
        userName={userName}
        onSuccess={() => { onRefresh(); onClose(); }}
      />
    </>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// MAIN — SiteVisitDashboard
// ═════════════════════════════════════════════════════════════════════════════
const SiteVisitDashboard = () => {
  const user         = profile();
  const userId       = user._id;
  const userName     = user.name || user.fullName || user.username || "Agent";
  const isSuperAdmin = user.role === "super admin";

  const [visits,       setVisits]       = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [timerState,   setTimerState]   = useState({});
  const [tickNow,      setTickNow]      = useState(Date.now());
  const [activeFilter, setActiveFilter] = useState("all");

  const [newModal,    setNewModal]    = useState(false);
  const [drawerVisit, setDrawerVisit] = useState(null);

  useEffect(() => {
    const t = setInterval(() => setTickNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const getLiveSecs = useCallback((id) => {
    const ts = timerState[id];
    if (!ts) return 0;
    const closed = ts.closedSecs || 0;
    if (!ts.startedAt) return closed;
    return closed + Math.max(0, Math.floor((tickNow - new Date(ts.startedAt).getTime()) / 1000));
  }, [timerState, tickNow]);

  // ── Load ────────────────────────────────────────────────────────────────
  const loadVisits = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const url = isSuperAdmin ? BASE : `${BASE}/user/${userId}`;
      const res  = await fetch(url, { headers: authHeader() });
      const data = await res.json();
      const list = isSuperAdmin
        ? (Array.isArray(data?.data?.visits) ? data.data.visits : [])
        : (Array.isArray(data?.data) ? data.data : []);

      setVisits(list);

      const next = {};
      list.forEach((v) => {
        const isLive   = !!v.current_session_start;
        const existing = timerState[v._id];
        next[v._id] = {
          closedSecs: v.total_duration_seconds || 0,
          startedAt:  isLive ? (existing?.startedAt || new Date(v.current_session_start)) : null,
        };
      });
      setTimerState(next);
    } catch (e) {
      message.error("Failed to load: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [userId, isSuperAdmin]);

  useEffect(() => { loadVisits(); }, [loadVisits]);

  // ── Session handlers ─────────────────────────────────────────────────────
  const handleStartSession = async (visitId, notes) => {
    const res  = await fetch(`${BASE}/${visitId}/session/start`, {
      method: "POST", headers: jsonHeader(),
      body: JSON.stringify({ by_user_id: userId, by_name: userName, notes }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || "Failed");
    const now = new Date();
    setTimerState((p) => ({ ...p, [visitId]: { closedSecs: p[visitId]?.closedSecs || 0, startedAt: now } }));
    setVisits((p) => p.map((v) => v._id === visitId ? { ...v, status: "in_progress", current_session_start: now } : v));
    setDrawerVisit((p) => p?._id === visitId ? { ...p, status: "in_progress", current_session_start: now } : p);
    message.success("Visit started!");
  };

  const handleCloseSession = async (visitId, action, notes) => {
    const res  = await fetch(`${BASE}/${visitId}/session/close`, {
      method: "POST", headers: jsonHeader(),
      body: JSON.stringify({ action, by_user_id: userId, by_name: userName, notes }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || "Failed");
    setTimerState((p) => {
      const ts      = p[visitId] || {};
      const elapsed = ts.startedAt
        ? Math.max(0, Math.floor((Date.now() - new Date(ts.startedAt).getTime()) / 1000))
        : 0;
      return { ...p, [visitId]: { closedSecs: (ts.closedSecs || 0) + elapsed, startedAt: null } };
    });
    const newStatus = action === "completed" ? "completed" : "on_hold";
    setVisits((p) => p.map((v) => v._id === visitId ? { ...v, status: newStatus, current_session_start: null } : v));
    setDrawerVisit((p) => p?._id === visitId ? { ...p, status: newStatus, current_session_start: null } : p);
    message.success(action === "completed" ? "Visit completed!" : "Visit paused!");
  };

  // ── Filters ──────────────────────────────────────────────────────────────
  const counts = {
    all:         visits.length,
    scheduled:   visits.filter((v) => v.status === "scheduled").length,
    in_progress: visits.filter((v) => v.status === "in_progress").length,
    on_hold:     visits.filter((v) => v.status === "on_hold").length,
    completed:   visits.filter((v) => v.status === "completed").length,
    converted:   visits.filter((v) => v.status === "converted").length,
  };

  const filtered = activeFilter === "all" ? visits : visits.filter((v) => v.status === activeFilter);

  const summaryItems = [
    { key: "all",         label: "All",       color: "#0369a1", bg: "#f0f9ff" },
    { key: "scheduled",   label: "Scheduled", color: "#f59e0b", bg: "#fffbeb" },
    { key: "in_progress", label: "Live",      color: "#16a34a", bg: "#f0fdf4" },
    { key: "on_hold",     label: "On Hold",   color: "#f97316", bg: "#fff7ed" },
    { key: "completed",   label: "Completed", color: "#0ea5e9", bg: "#f0f9ff" },
    { key: "converted",   label: "Converted", color: "#7c3aed", bg: "#f5f3ff" },
  ];

  // ── Table columns ─────────────────────────────────────────────────────────
  const columns = [
    {
      title: "#", key: "sno", width: 50,
      render: (_, __, i) => <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 700 }}>{i + 1}</span>,
    },
    {
      title: "Visit No", dataIndex: "visit_no", width: 140,
      render: (val, v) => {
        const live = !!v.current_session_start;
        return (
          <div>
            <span style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 13,
              color: v.converted_to_job ? "#7c3aed" : live ? "#16a34a" : "#0369a1" }}>
              {val}
            </span>
            {live && (
              <div style={{ marginTop: 3 }}>
                <span style={{ fontSize: 9, fontWeight: 700, background: "#dcfce7", color: "#16a34a",
                  padding: "1px 6px", borderRadius: 8, border: "1px solid #86efac" }}>● LIVE</span>
              </div>
            )}
            {v.converted_to_job && (
              <div style={{ marginTop: 3 }}>
                <span style={{ fontSize: 9, fontWeight: 700, background: "#f5f3ff", color: "#7c3aed",
                  padding: "1px 6px", borderRadius: 8, border: "1px solid #c4b5fd" }}>
                  <ShoppingCartOutlined style={{ marginRight: 2 }} />JOB
                </span>
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: "Customer", width: 180,
      render: (_, v) => (
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>{v.customer_name || "—"}</div>
          {v.company_name   && <div style={{ fontSize: 11, color: "#6b7280" }}>{v.company_name}</div>}
          {v.customer_phone && (
            <div style={{ fontSize: 11, color: "#6b7280" }}>
              <PhoneOutlined style={{ marginRight: 3 }} />{v.customer_phone}
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Site Address", width: 200,
      render: (_, v) => {
        const addr = [v.address_line1, v.city, v.state].filter(Boolean).join(", ");
        return (
          <div>
            {addr
              ? <div style={{ fontSize: 12, color: "#374151", display: "flex", alignItems: "flex-start", gap: 4 }}>
                  <EnvironmentOutlined style={{ color: "#d97706", marginTop: 1, flexShrink: 0, fontSize: 11 }} />
                  <span style={{ lineHeight: 1.4 }}>{addr}</span>
                </div>
              : <span style={{ color: "#9ca3af", fontSize: 12 }}>—</span>
            }
            {v.site_type && <Tag color="gold" style={{ marginTop: 4, fontSize: 10 }}>{v.site_type}</Tag>}
          </div>
        );
      },
    },
    {
      title: "Assigned To", width: 150,
      render: (_, v) => {
        const main = v.assigned_to?.name;
        const team = v.team_members || [];
        return (
          <div>
            {main
              ? <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Avatar size={22} style={{ background: "#0369a1", fontSize: 10 }}>
                    {main[0].toUpperCase()}
                  </Avatar>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>{main}</span>
                </div>
              : <span style={{ color: "#9ca3af", fontSize: 12 }}>Unassigned</span>
            }
            {team.length > 0 && (
              <div style={{ marginTop: 4, display: "flex", gap: 3, flexWrap: "wrap" }}>
                {team.slice(0, 3).map((m) => (
                  <Avatar key={m._id} size={18} style={{ background: "#7c3aed", fontSize: 9 }} title={m.name}>
                    {m.name[0].toUpperCase()}
                  </Avatar>
                ))}
                {team.length > 3 && <span style={{ fontSize: 10, color: "#9ca3af" }}>+{team.length - 3}</span>}
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: "Status", width: 115,
      render: (_, v) => <StatusBadge status={v.status || "scheduled"} />,
    },
    {
      title: "Time on Site", width: 120,
      render: (_, v) => {
        const secs = getLiveSecs(v._id);
        const live = !!v.current_session_start;
        return (
          <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13,
            color: live ? "#16a34a" : secs ? "#374151" : "#d1d5db" }}>
            {fmtSecs(secs)}
          </div>
        );
      },
    },
    {
      title: "Visit Date", width: 110,
      render: (_, v) => {
        const d = v.visit_date ? dayjs(v.visit_date) : null;
        if (!d) return <span style={{ color: "#9ca3af", fontSize: 12 }}>—</span>;
        const today = d.isSame(dayjs(), "day");
        return (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: today ? "#16a34a" : "#374151" }}>
              {today && "📅 "}{d.format("DD MMM YYYY")}
            </div>
            <div style={{ fontSize: 10, color: "#9ca3af" }}>{d.format("h:mm A")}</div>
          </div>
        );
      },
    },
    {
      title: "Photos", width: 70, align: "center",
      render: (_, v) => {
        // photos is an array on the server
        const cnt = Array.isArray(v.photos) ? v.photos.length : 0;
        return cnt > 0
          ? <Tag color="blue" style={{ fontSize: 11, fontWeight: 700 }}>{cnt}</Tag>
          : <span style={{ color: "#d1d5db", fontSize: 12 }}>—</span>;
      },
    },
    {
      title: "Actions", width: 200, fixed: "right",
      render: (_, v) => {
        const live = !!v.current_session_start;
        const canConvertRow = !v.converted_to_job
          && (v.status === "completed" || v.total_duration_seconds > 0);
        return (
          <Space size={4} wrap>
            <Tooltip title="Open workspace">
              <Button size="small" icon={<EyeOutlined />}
                onClick={() => setDrawerVisit(v)}
                style={{ height: 28, fontSize: 11, borderRadius: 6,
                  color: "#0369a1", borderColor: "#bae6fd", background: "#f0f9ff" }}>
                Open
              </Button>
            </Tooltip>
            {!live && v.status !== "converted" && (
              <Tooltip title="Start visit">
                <Button size="small" type="primary" icon={<PlayCircleOutlined />}
                  onClick={async () => {
                    try { await handleStartSession(v._id, ""); }
                    catch (e) { message.error(e.message); }
                  }}
                  style={{ height: 28, fontSize: 11, borderRadius: 6, background: "#16a34a", border: "none" }}>
                  {v.status === "on_hold" ? "Resume" : "Start"}
                </Button>
              </Tooltip>
            )}
            {live && (
              <Tooltip title="Pause">
                <Button size="small" danger icon={<PauseCircleOutlined />}
                  onClick={async () => {
                    try { await handleCloseSession(v._id, "paused", ""); }
                    catch (e) { message.error(e.message); }
                  }}
                  style={{ height: 28, fontSize: 11, borderRadius: 6 }}>
                  Pause
                </Button>
              </Tooltip>
            )}
            {/* Quick Convert to Job Sheet button in table row */}
            {canConvertRow && (
              <Tooltip title="Convert to Job Sheet">
                <Button size="small" icon={<ShoppingCartOutlined />}
                  onClick={() => setDrawerVisit(v)}
                  style={{ height: 28, fontSize: 11, borderRadius: 6,
                    color: "#7c3aed", borderColor: "#c4b5fd", background: "#f5f3ff" }}>
                  Job
                </Button>
              </Tooltip>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ padding: 16,
      background: "linear-gradient(160deg,#f0f9ff 0%,#f8fafc 50%,#f0fdf4 100%)",
      minHeight: "100vh" }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes slideIn { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
        .sv-table .ant-table-thead > tr > th {
          background: #f8fafc !important; font-size: 11px !important;
          font-weight: 700 !important; color: #6b7280 !important;
          text-transform: uppercase; letter-spacing: 0.05em;
          border-bottom: 2px solid #e5e7eb !important; padding: 10px 12px !important;
        }
        .sv-table .ant-table-tbody > tr > td {
          padding: 10px 12px !important; border-bottom: 1px solid #f3f4f6 !important;
          vertical-align: top;
        }
        .sv-table .ant-table-tbody > tr:hover > td { background: #f0f9ff !important; }
        .sv-table .ant-table-tbody > tr.live-row > td { background: #f0fdf4 !important; }
        .sv-table .ant-table-tbody > tr { animation: slideIn 0.22s ease forwards; }
      `}</style>

      {/* ── Header ── */}
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb",
        padding: "14px 18px", marginBottom: 16,
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        display: "flex", justifyContent: "space-between",
        alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12,
            background: "linear-gradient(135deg,#0369a1,#0ea5e9)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 12px #0ea5e940" }}>
            <CompassOutlined style={{ color: "#fff", fontSize: 20 }} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#0c4a6e" }}>
              Site Visit Dashboard
            </h2>
            <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
              {isSuperAdmin ? "All visits" : <><strong style={{ color: "#0369a1" }}>{userName}</strong> · My visits</>}
              {" · "}{visits.length} record{visits.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Tooltip title="Refresh">
            <Button icon={<ReloadOutlined spin={loading} />} onClick={loadVisits} style={{ borderRadius: 8 }} />
          </Tooltip>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setNewModal(true)}
            style={{ height: 38,
              background: "linear-gradient(135deg,#0369a1,#0ea5e9)",
              border: "none", borderRadius: 8, fontWeight: 700 }}>
            New Site Visit
          </Button>
        </div>
      </div>

      {/* ── Summary Strip ── */}
      <div style={{ display: "grid",
        gridTemplateColumns: `repeat(${summaryItems.length}, minmax(0,1fr))`,
        gap: 10, marginBottom: 16 }}>
        {summaryItems.map(({ key, label, color, bg }) => {
          const isActive = activeFilter === key;
          return (
            <div key={key}
              onClick={() => setActiveFilter(isActive ? "all" : key)}
              style={{ background: isActive ? bg : "#fff", borderRadius: 10, padding: "10px 12px",
                border: `${isActive ? "2px" : "1px"} solid ${isActive ? color : "#e5e7eb"}`,
                cursor: "pointer", transition: "all 0.18s",
                boxShadow: isActive ? `0 0 0 3px ${color}22` : "none",
                transform: isActive ? "translateY(-2px)" : "none" }}>
              {isActive && (
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: color,
                  marginBottom: 4, animation: "pulse 1.5s infinite" }} />
              )}
              <div style={{ fontSize: 20, fontWeight: 900, color, lineHeight: 1 }}>{counts[key] ?? 0}</div>
              <div style={{ fontSize: 10, color: isActive ? color : "#6b7280", fontWeight: 600, marginTop: 3 }}>{label}</div>
            </div>
          );
        })}
      </div>

      {/* ── Table ── */}
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb",
        overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
        <Spin spinning={loading}>
          <Table
            className="sv-table"
            dataSource={filtered}
            columns={columns}
            rowKey="_id"
            scroll={{ x: 1300 }}
            pagination={{ pageSize: 20, showSizeChanger: true,
              showTotal: (t) => `${t} visit${t !== 1 ? "s" : ""}`,
              style: { padding: "12px 16px" } }}
            locale={{
              emptyText: (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <div style={{ color: "#9ca3af" }}>
                      <CompassOutlined style={{ fontSize: 32, marginBottom: 8, display: "block" }} />
                      No site visits yet.
                    </div>
                  }
                  style={{ padding: "40px 0" }} />
              ),
            }}
            rowClassName={(v) => v.current_session_start ? "live-row" : ""}
          />
        </Spin>
      </div>

      {/* ── New Visit Modal ── */}
      <NewSiteVisitModal
        open={newModal}
        onClose={() => setNewModal(false)}
        onSuccess={loadVisits}
        userId={userId}
        userName={userName}
      />

      {/* ── Workspace Drawer ── */}
      <WorkspaceDrawer
        open={!!drawerVisit}
        onClose={() => setDrawerVisit(null)}
        visit={drawerVisit}
        isLive={!!drawerVisit?.current_session_start}
        liveTimerSecs={drawerVisit ? getLiveSecs(drawerVisit._id) : 0}
        onStartSession={handleStartSession}
        onCloseSession={handleCloseSession}
        onRefresh={() => { loadVisits(); }}
        userId={userId}
        userName={userName}
      />
    </div>
  );
};

export default SiteVisitDashboard;