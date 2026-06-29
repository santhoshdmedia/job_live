/**
 * StaffMonitorCard.jsx
 *
 * A single card on the Staff Monitor dashboard list.
 * Shows:
 *   - Online / offline status dot
 *   - Staff name + role
 *   - Today's active time
 *   - Latest check-in selfie thumbnail
 *   - Check-in location displayed as human-readable formatted_address
 *     (resolved server-side via Nominatim reverse-geocoding) with a
 *     Google Maps deep-link fallback.
 *   - Active job count badge
 *   - Task logs count
 *
 * Props:
 *   staff        {Object}   — one item from getMonitorList response
 *   onClick      {Function} — open detail drawer
 */

import { Avatar, Tag, Tooltip } from "antd";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

// ─── Helpers ──────────────────────────────────────────────────────────────────
const secsToHHMM = (total = 0) => {
  const s = Math.max(0, Math.floor(total));
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  return `${h}h ${m}m`;
};

const mapsUrl = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`;

// ─── Selfie + Location block ──────────────────────────────────────────────────
/**
 * Renders the selfie thumbnail + location line.
 *
 * Location display priority:
 *   1. location.formatted_address  — set by server-side reverse geocoding
 *   2. "Lat, Lng"                  — raw coords as fallback
 *   3. "Location not captured"     — when no coords at all
 *
 * The entire location line is a Google Maps link when coords are available.
 */
const SelfieBlock = ({ latestSelfie }) => {
  if (!latestSelfie) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 border border-dashed border-gray-200">
        <span className="text-gray-300 text-xl">📷</span>
        <p className="text-xs text-gray-400 leading-tight">No check-in selfie yet</p>
      </div>
    );
  }

  const { selfie_url, location, login_at } = latestSelfie;

  const hasCoords =
    location?.latitude != null && location?.longitude != null;

  // Use pre-resolved address when available, fall back to raw coords
  const addressLine = hasCoords
    ? location.formatted_address ||
      `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
    : null;

  // place_name: e.g. "Chennai" — shown as a compact secondary label
  const placeName = location?.place_name || "";

  // Accuracy badge: only show when ≤ 500 m (noisier values aren't useful)
  const showAccuracy =
    hasCoords && location.accuracy != null && location.accuracy <= 500;

  const loginTime = login_at ? dayjs(login_at).format("hh:mm A") : "";

  return (
    <div className="flex gap-3 items-start px-3 py-2.5 rounded-xl bg-indigo-50/60 border border-indigo-100">
      {/* ── Selfie thumbnail ──────────────────────────────────────────────── */}
      {selfie_url ? (
        <Tooltip title={`Check-in at ${loginTime}`} placement="top">
          <img
            src={selfie_url}
            alt="check-in selfie"
            onClick={() => window.open(selfie_url, "_blank")}
            className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border-2 border-indigo-200 shadow-sm cursor-pointer"
            style={{ transform: "scaleX(-1)" }} /* mirror to match capture */
          />
        </Tooltip>
      ) : (
        <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0 border-2 border-indigo-200">
          <span className="text-indigo-300 text-xl">👤</span>
        </div>
      )}

      {/* ── Location info ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1 min-w-0">
        {/* Header row: "Check-in · HH:MM AM" + optional city badge */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-[11px] font-semibold text-indigo-500 uppercase tracking-wide leading-none">
            Check-in · {loginTime}
          </p>
          {placeName && (
            <span className="text-[10px] bg-indigo-100 text-indigo-600 rounded-full px-1.5 py-0.5 leading-none font-medium">
              {placeName}
            </span>
          )}
        </div>

        {/* Address line */}
        {addressLine ? (
          <a
            href={hasCoords ? mapsUrl(location.latitude, location.longitude) : "#"}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => !hasCoords && e.preventDefault()}
            className="flex items-start gap-1 group"
          >
            <span className="text-sm mt-px flex-shrink-0">📍</span>
            <span className="text-xs text-gray-600 group-hover:text-indigo-600 transition-colors leading-tight line-clamp-2">
              {addressLine}
            </span>
          </a>
        ) : (
          <div className="flex items-center gap-1">
            <span className="text-sm">⚠️</span>
            <span className="text-xs text-gray-400">Location not captured</span>
          </div>
        )}

        {/* Accuracy badge */}
        {showAccuracy && (
          <p className="text-[10px] text-gray-400 leading-none">
            ± {Math.round(location.accuracy)} m accuracy
          </p>
        )}
      </div>
    </div>
  );
};

// ─── Main Card ────────────────────────────────────────────────────────────────
const StaffMonitorCard = ({ staff, onClick }) => {
  const {
    name,
    email,
    role,
    profileImg,
    isOnline,
    todaySeconds,
    taskLogsToday,
    currentLoginAt,
    lastActivity,
    jobStats,
    latestSelfie,
  } = staff;

  const roleColor = {
    super_admin: "purple",
    "super admin": "purple",
    admin:       "blue",
    designer:    "cyan",
    production:  "orange",
    delivery:    "green",
  }[role] || "default";

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all duration-200 cursor-pointer overflow-hidden"
    >
      {/* ── Online status bar ─────────────────────────────────────────────── */}
      <div
        className="h-1 w-full"
        style={{
          background: isOnline
            ? "linear-gradient(90deg, #7c6ef7, #9b8df9)"
            : "#e5e7eb",
        }}
      />

      <div className="p-4 flex flex-col gap-3">
        {/* ── Staff identity ───────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <Avatar
              src={profileImg || undefined}
              size={44}
              className="!bg-indigo-100 !text-indigo-600 font-bold text-base"
            >
              {!profileImg && name?.[0]?.toUpperCase()}
            </Avatar>
            <span
              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                isOnline ? "bg-green-400" : "bg-gray-300"
              }`}
            />
          </div>

          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-800 text-sm leading-tight truncate">
              {name}
            </p>
            <p className="text-xs text-gray-400 truncate">{email}</p>
          </div>

          <Tag
            color={roleColor}
            className="!text-xs !rounded-full capitalize flex-shrink-0"
          >
            {role?.replace(/_/g, " ")}
          </Tag>
        </div>

        {/* ── Selfie + location ────────────────────────────────────────────── */}
        <SelfieBlock latestSelfie={latestSelfie} />

        {/* ── Stats row ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-2">
          <StatPill
            icon="⏱"
            label="Today"
            value={secsToHHMM(todaySeconds)}
            highlight={isOnline}
          />
          <StatPill
            icon="💼"
            label="Active jobs"
            value={jobStats?.activeJobs ?? 0}
            highlight={(jobStats?.activeJobs ?? 0) > 0}
          />
          <StatPill
            icon="📝"
            label="Task logs"
            value={taskLogsToday ?? 0}
          />
        </div>

        {/* ── Footer: last activity ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between pt-1 border-t border-gray-50">
          <span className="text-[11px] text-gray-400">
            {isOnline && currentLoginAt
              ? `Online since ${dayjs(currentLoginAt).format("hh:mm A")}`
              : lastActivity
              ? `Last seen ${dayjs(lastActivity).fromNow()}`
              : "No activity today"}
          </span>
          <span className="text-[11px] text-indigo-400 font-medium hover:text-indigo-600">
            View details →
          </span>
        </div>
      </div>
    </div>
  );
};

// ─── Small stat pill ──────────────────────────────────────────────────────────
const StatPill = ({ icon, label, value, highlight = false }) => (
  <div
    className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl ${
      highlight
        ? "bg-indigo-50 border border-indigo-100"
        : "bg-gray-50 border border-gray-100"
    }`}
  >
    <span className="text-base leading-none">{icon}</span>
    <p
      className={`text-sm font-bold mt-0.5 ${
        highlight ? "text-indigo-600" : "text-gray-700"
      }`}
    >
      {value}
    </p>
    <p className="text-[10px] text-gray-400 leading-none">{label}</p>
  </div>
);

export default StaffMonitorCard;