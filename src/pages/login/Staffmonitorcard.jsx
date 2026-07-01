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
 *   - 🆕 Refresh location button when location is missing/unavailable
 *
 * Props:
 *   staff        {Object}   — one item from getMonitorList response
 *   onClick      {Function} — open detail drawer
 *   onRefreshLocation {Function} — (staffId) => Promise<void>  (optional)
 *                  called when admin clicks the refresh location button
 */

import { useState, useCallback } from "react";
import { Avatar, Tag, Tooltip, message } from "antd";
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

const mapsUrl = (lat, lng) =>
  `https://www.google.com/maps?q=${lat},${lng}`;

// ─── Refresh Location Button ──────────────────────────────────────────────────
/**
 * Standalone animated refresh button used inside the selfie / location block.
 * Calls onRefresh() and manages its own loading/success/error state.
 */
const RefreshLocationButton = ({ onRefresh, compact = false }) => {
  const [state, setState] = useState("idle"); // "idle" | "loading" | "success" | "error"

  const handleClick = useCallback(
    async (e) => {
      e.stopPropagation(); // don't bubble to card's onClick (drawer open)
      if (state === "loading") return;

      setState("loading");
      try {
        await onRefresh?.();
        setState("success");
        message.success("Location refreshed successfully!");
        // Reset to idle after 2.5 s so the button stays usable
        setTimeout(() => setState("idle"), 2500);
      } catch (err) {
        setState("error");
        message.error(err?.message || "Could not refresh location. Try again.");
        setTimeout(() => setState("idle"), 3000);
      }
    },
    [onRefresh, state]
  );

  // ── Visual config per state ──────────────────────────────────────────────
  const cfg = {
    idle: {
      bg: "bg-orange-50 border-orange-200 hover:bg-orange-100 hover:border-orange-300",
      text: "text-orange-600",
      icon: "🔄",
      label: compact ? "Refresh" : "Refresh Location",
      spin: false,
    },
    loading: {
      bg: "bg-orange-100 border-orange-300",
      text: "text-orange-500",
      icon: "⟳",
      label: compact ? "Getting…" : "Getting location…",
      spin: true,
    },
    success: {
      bg: "bg-green-50 border-green-200",
      text: "text-green-600",
      icon: "✓",
      label: compact ? "Updated!" : "Location updated!",
      spin: false,
    },
    error: {
      bg: "bg-red-50 border-red-200",
      text: "text-red-500",
      icon: "✗",
      label: compact ? "Failed" : "Refresh failed",
      spin: false,
    },
  }[state];

  return (
    <button
      onClick={handleClick}
      disabled={state === "loading"}
      className={`
        inline-flex items-center gap-1 px-2 py-1 rounded-lg border
        text-[11px] font-semibold transition-all duration-200
        select-none focus:outline-none
        ${cfg.bg} ${cfg.text}
        ${state === "loading" ? "cursor-wait" : "cursor-pointer active:scale-95"}
      `}
      title="Re-fetch this staff member's current location"
    >
      <span
        className={`text-xs leading-none ${cfg.spin ? "animate-spin inline-block" : ""}`}
        style={cfg.spin ? { display: "inline-block" } : {}}
      >
        {cfg.icon}
      </span>
      {cfg.label}
    </button>
  );
};

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
 *
 * When location is missing or shows "Location not available" the refresh
 * button appears so the admin can re-trigger location capture.
 */
const SelfieBlock = ({ latestSelfie, onRefreshLocation, staffId }) => {
  // ── No selfie at all ──────────────────────────────────────────────────────
  if (!latestSelfie) {
    return (
      <div className="flex flex-col gap-2 px-3 py-2.5 rounded-xl bg-gray-50 border border-dashed border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-gray-300 text-xl">📷</span>
          <p className="text-xs text-gray-400 leading-tight">
            No check-in selfie yet
          </p>
        </div>
        {/* Even without a selfie, offer a refresh if onRefreshLocation exists */}
        {onRefreshLocation && (
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-gray-400">
              Location not available
            </span>
            <RefreshLocationButton
              compact
              onRefresh={() => onRefreshLocation(staffId)}
            />
          </div>
        )}
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

  // Determine whether the location is genuinely missing/unavailable so we
  // know when to surface the refresh button.
  const locationMissing =
    !hasCoords ||
    !addressLine ||
    /not\s+(available|captured|found)/i.test(addressLine);

  // place_name: e.g. "Chennai" — shown as a compact secondary label
  const placeName = location?.place_name || "";

  // Accuracy badge: only show when ≤ 500 m (noisier values aren't useful)
  const showAccuracy =
    hasCoords && location.accuracy != null && location.accuracy <= 500;

  const loginTime = login_at ? dayjs(login_at).format("hh:mm A") : "";

  return (
    <div
      className={`flex gap-3 items-start px-3 py-2.5 rounded-xl border ${
        locationMissing
          ? "bg-orange-50/60 border-orange-100"
          : "bg-indigo-50/60 border-indigo-100"
      }`}
    >
      {/* ── Selfie thumbnail ──────────────────────────────────────────────── */}
      {selfie_url ? (
        <Tooltip title={`Check-in at ${loginTime}`} placement="top">
          <img
            src={selfie_url}
            alt="check-in selfie"
            onClick={(e) => {
              e.stopPropagation();
              window.open(selfie_url, "_blank");
            }}
            className={`w-12 h-12 rounded-xl object-cover flex-shrink-0 shadow-sm cursor-pointer border-2 ${
              locationMissing ? "border-orange-200" : "border-indigo-200"
            }`}
            style={{ transform: "scaleX(-1)" }} /* mirror to match capture */
          />
        </Tooltip>
      ) : (
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 border-2 ${
            locationMissing
              ? "bg-orange-100 border-orange-200"
              : "bg-indigo-100 border-indigo-200"
          }`}
        >
          <span
            className={`text-xl ${
              locationMissing ? "text-orange-300" : "text-indigo-300"
            }`}
          >
            👤
          </span>
        </div>
      )}

      {/* ── Location info ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        {/* Header row: "Check-in · HH:MM AM" + optional city badge */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <p
            className={`text-[11px] font-semibold uppercase tracking-wide leading-none ${
              locationMissing ? "text-orange-500" : "text-indigo-500"
            }`}
          >
            Check-in · {loginTime}
          </p>
          {placeName && (
            <span
              className={`text-[10px] rounded-full px-1.5 py-0.5 leading-none font-medium ${
                locationMissing
                  ? "bg-orange-100 text-orange-600"
                  : "bg-indigo-100 text-indigo-600"
              }`}
            >
              {placeName}
            </span>
          )}
        </div>

        {/* Address line — or "not available" notice with refresh */}
        {!locationMissing && addressLine ? (
          <a
            href={hasCoords ? mapsUrl(location.latitude, location.longitude) : "#"}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              e.stopPropagation();
              if (!hasCoords) e.preventDefault();
            }}
            className="flex items-start gap-1 group"
          >
            <span className="text-sm mt-px flex-shrink-0">📍</span>
            <span className="text-xs text-gray-600 group-hover:text-indigo-600 transition-colors leading-tight line-clamp-2">
              {addressLine}
            </span>
          </a>
        ) : (
          /* ── Location missing / unavailable ─────────────────────────── */
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-sm flex-shrink-0">📍</span>
              <span className="text-xs text-orange-500 font-medium leading-tight">
                Location not available
              </span>
            </div>

            {/* Refresh button — stops propagation so it doesn't open drawer */}
            {onRefreshLocation && (
              <RefreshLocationButton
                compact={false}
                onRefresh={() => onRefreshLocation(staffId)}
              />
            )}
          </div>
        )}

        {/* ── If location IS available, still show refresh as a subtle option */}
        {!locationMissing && onRefreshLocation && (
          <div className="flex items-center gap-1.5 mt-0.5">
            <a
              href={mapsUrl(location.latitude, location.longitude)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-[10px] text-indigo-400 hover:text-indigo-600 underline underline-offset-2 transition-colors"
            >
              Open in Maps
            </a>
            <span className="text-gray-300 text-[10px]">·</span>
            <RefreshLocationButton
              compact
              onRefresh={() => onRefreshLocation(staffId)}
            />
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
const StaffMonitorCard = ({ staff, onClick, onRefreshLocation }) => {
  const {
    _id,
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
    super_admin:   "purple",
    "super admin": "purple",
    admin:         "blue",
    designer:      "cyan",
    production:    "orange",
    delivery:      "green",
  }[role] || "default";

  // Determine if location is genuinely missing so we can add a visual cue
  // on the card-level footer too.
  const locationMissing =
    !latestSelfie?.location?.latitude ||
    !latestSelfie?.location?.longitude ||
    /not\s+(available|captured|found)/i.test(
      latestSelfie?.location?.formatted_address || ""
    );

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden ${
        locationMissing && latestSelfie
          ? "border-orange-100 hover:border-orange-300"
          : "border-gray-100 hover:border-indigo-200"
      }`}
    >
      {/* ── Online / location-missing status bar ──────────────────────────── */}
      <div
        className="h-1 w-full"
        style={{
          background: isOnline
            ? locationMissing && latestSelfie
              ? "linear-gradient(90deg, #fb923c, #fbbf24)" // orange = online but location missing
              : "linear-gradient(90deg, #7c6ef7, #9b8df9)" // purple = online + location ok
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

          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <Tag
              color={roleColor}
              className="!text-xs !rounded-full capitalize !m-0"
            >
              {role?.replace(/_/g, " ")}
            </Tag>
            {/* Tiny "location missing" badge visible at a glance */}
            {locationMissing && latestSelfie && (
              <span className="text-[10px] bg-orange-100 text-orange-600 border border-orange-200 rounded-full px-1.5 py-0.5 font-semibold leading-none">
                📍 No location
              </span>
            )}
          </div>
        </div>

        {/* ── Selfie + location ────────────────────────────────────────────── */}
        <SelfieBlock
          latestSelfie={latestSelfie}
          onRefreshLocation={onRefreshLocation}
          staffId={_id}
        />

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

        {/* ── Footer: last activity + optional location-refresh hint ─────────── */}
        <div className="flex items-center justify-between pt-1 border-t border-gray-50 gap-2 flex-wrap">
          <span className="text-[11px] text-gray-400">
            {isOnline && currentLoginAt
              ? `Online since ${dayjs(currentLoginAt).format("hh:mm A")}`
              : lastActivity
              ? `Last seen ${dayjs(lastActivity).fromNow()}`
              : "No activity today"}
          </span>

          {/* Right side: "View details" or "location missing" refresh shortcut */}
          {locationMissing && latestSelfie && onRefreshLocation ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                // Visually let the RefreshLocationButton inside SelfieBlock
                // handle its own state; here we just show the hint.
              }}
              className="text-[11px] text-orange-500 font-medium hover:text-orange-700 transition-colors"
              title="Location missing — use Refresh Location button above"
            >
              ⚠ Location missing
            </button>
          ) : (
            <span className="text-[11px] text-indigo-400 font-medium hover:text-indigo-600">
              View details →
            </span>
          )}
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