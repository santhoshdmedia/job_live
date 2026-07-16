import { useState, useEffect, useRef } from "react";
import { Button, Tooltip, Modal, message, Avatar } from "antd";
import {
  PlusOutlined,
  LogoutOutlined,
  CoffeeOutlined,
  CloseCircleOutlined,
  DownOutlined,
  CameraOutlined,
} from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import React from "react";
import { isLoginSuccess } from "../redux/slices/authSlice";
import { useNavigate } from "react-router-dom";
import CreateJobModal from "./job/Createjobmodal";
import { smApi } from "../api/staffmonitor.api";
import { admintoken } from "../helper/notification_helper";
import InTimeCaptureModal from "./InTimeCaptureModal";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getGreeting(name = "") {
  const hour = new Date().getHours();
  const greet =
    hour < 12
      ? "Good Morning"
      : hour < 17
        ? "Good Afternoon"
        : hour < 21
          ? "Good Evening"
          : "Good Night";
  return name ? `${greet}, ${name.split(" ")[0]}` : greet;
}

function getGreetingIcon() {
  const hour = new Date().getHours();
  if (hour < 12) return "🌤️";
  if (hour < 17) return "☀️";
  if (hour < 21) return "🌆";
  return "🌙";
}

/** Format seconds → "1h 23m" or "45m" or "0m" */
const fmtDur = (s) => {
  s = Math.max(0, Math.floor(s || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

/** Initials for the avatar fallback */
const getInitials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "U";

const STANDARD_WORK_SECS = 10 * 3600;

// ─── Live timer hook ──────────────────────────────────────────────────────────
/**
 * Returns elapsed seconds since `startIso` while `running` is true.
 * Survives refreshes because it always computes from the original ISO timestamp.
 */
function useLiveTimer(startIso, running) {
  const [secs, setSecs] = useState(() => {
    if (!running || !startIso) return 0;
    return Math.max(0, Math.floor((Date.now() - new Date(startIso)) / 1000));
  });

  useEffect(() => {
    if (!running || !startIso) {
      setSecs(0);
      return;
    }
    const tick = () =>
      setSecs(
        Math.max(0, Math.floor((Date.now() - new Date(startIso)) / 1000)),
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [running, startIso]);

  return secs;
}

// Small pill used on the mobile stats strip. Kept in one place so all the
// chips share the same shape/padding instead of drifting apart over time.
function StatChip({ children, tone = "slate" }) {
  const tones = {
    slate: { bg: "#F8FAFC", border: "#E2E8F0", text: "#475569" },
    blue: { bg: "#EFF6FF", border: "#BFDBFE", text: "#2563EB" },
    orange: { bg: "#FFF7ED", border: "#FED7AA", text: "#C2410C" },
  };
  const c = tones[tone];
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums shrink-0"
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.text,
      }}
    >
      {children}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

const TopNavbar = ({ jobs = [], onJobCreated }) => {
  const { user } = useSelector((state) => state.authSlice);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Session
  const [sessionStart, setSessionStart] = useState(null); // ISO string from DB
  const [initialized, setInitialized] = useState(false);

  // Break
  const [onBreak, setOnBreak] = useState(false);
  const [breakType, setBreakType] = useState(null); // "break" | "lunch"
  const [breakStart, setBreakStart] = useState(null); // ISO string from DB
  const [totalBreakSecs, setTotalBreakSecs] = useState(0); // accumulated from DB

  // ── In Time / Out Time (attendance) ─────────────────────────────────────
  // Attendance is separate from the app's auth session. Clicking "In Time"
  // opens the camera, captures a photo + location, and starts the
  // attendance session. Clicking "Out Time" closes that attendance session
  // only — it does NOT sign the user out of the app.
  const [showInTimeModal, setShowInTimeModal] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const autoLogoutHandledRef = useRef(false);

  // UI
  const [loading, setLoading] = useState(false);
  const [showBreakMenu, setShowBreakMenu] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const breakMenuRef = useRef(null);

  // Live timers — both anchored to DB timestamps, so refresh-safe
  const workSecs = useLiveTimer(sessionStart, !!sessionStart && !onBreak);
  const breakLive = useLiveTimer(breakStart, onBreak);

  const isAdmin = [
    "super admin",
    "super_admin",
    "admin",
    "designing head",
  ].includes(user?.role?.toLowerCase?.());

  const is_hari = user.is_Special == true;

  // Super admins and individually-flagged "is_Special" users can skip the
  // photo + location capture when clicking "In Time" — it's optional for
  // them, though they can still choose to take a photo like everyone else.
  const canSkipInTimeCapture =
    user?.role?.toLowerCase?.() === "super admin" || user?.is_Special === true;

  // ── On mount: restore session & break state from server ──────────────────
  useEffect(() => {
    if (!user?._id) return;

    const initSession = async () => {
      try {
        // Try to restore an existing open attendance session (e.g. the
        // page was refreshed after the user already clicked "In Time").
        const res = await smApi.getSession(user._id);
        const { login_at, active_break, break_seconds } = res?.data?.data || {};

        if (login_at) setSessionStart(login_at);
        if (break_seconds) setTotalBreakSecs(break_seconds);

        // Restore mid-break state — timer resumes from original break_start
        if (active_break?.start && active_break?.type) {
          setOnBreak(true);
          setBreakType(active_break.type);
          setBreakStart(active_break.start);
        }
      } catch {
        // No active attendance session — that's fine, it just means the
        // user hasn't clicked "In Time" yet today. We deliberately do NOT
        // auto-start one here; it only starts when they click "In Time"
        // and complete the photo + location capture.
      } finally {
        setInitialized(true);
      }
    };

    initSession();
  }, [user?._id]);

  // ── Poll the server session every 45s while an attendance session is open ──
  // Job: notice if a super admin force-closed our attendance session from
  // the admin dashboard, and mirror that locally instead of pretending
  // we're still clocked in. (There's no more automatic 7 PM cutoff — the
  // only way a session closes without the user clicking "Out Time" is an
  // explicit admin force-logout.)
  useEffect(() => {
    if (!user?._id || !initialized || !sessionStart) return;
    const poll = async () => {
      try {
        await smApi.getSession(user._id);
      } catch {
        // No active attendance session on the server anymore — an admin
        // force-closed it. Mirror that locally (attendance only — the user
        // stays signed into the app).
        if (autoLogoutHandledRef.current) return;
        autoLogoutHandledRef.current = true;
        setSessionStart(null);
        setOnBreak(false);
        setBreakType(null);
        setBreakStart(null);
        setTotalBreakSecs(0);
        message.info(
          'A super admin closed your attendance session. You\'re still logged in — click "In Time" to start a new one.',
        );
        setTimeout(() => {
          autoLogoutHandledRef.current = false;
        }, 2000);
      }
    };
    const id = setInterval(poll, 45000);
    return () => clearInterval(id);
  }, [user?._id, initialized, sessionStart]);

  // ── Close break menu on outside click / Escape ───────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (breakMenuRef.current && !breakMenuRef.current.contains(e.target))
        setShowBreakMenu(false);
    };
    const escHandler = (e) => {
      if (e.key === "Escape") setShowBreakMenu(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", escHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", escHandler);
    };
  }, []);

  // ── Subtle elevation on page scroll (purely cosmetic polish) ─────────────
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ── Break actions ─────────────────────────────────────────────────────────
  const handleStartBreak = async (type) => {
    if (!user?._id) return;
    setLoading(true);
    setShowBreakMenu(false);
    try {
      const res = await smApi.startBreak(user._id, type);
      const breakStartTime =
        res?.data?.data?.break_start ?? new Date().toISOString();
      setOnBreak(true);
      setBreakType(type);
      setBreakStart(breakStartTime); // use server timestamp for accuracy
      message.info(
        type === "lunch" ? "🍽️ Lunch break started" : "☕ Break started",
      );
    } catch (err) {
      message.error(err?.response?.data?.message || "Failed to start break");
    } finally {
      setLoading(false);
    }
  };

  const handleEndBreak = async () => {
    if (!user?._id) return;
    setLoading(true);
    try {
      const res = await smApi.endBreak(user._id);
      const data = res?.data?.data || {};
      const elapsed = data.break_seconds ?? breakLive;

      setTotalBreakSecs((prev) => prev + elapsed);
      setOnBreak(false);
      setBreakType(null);
      setBreakStart(null);
      message.success(`Back to work! Break was ${fmtDur(elapsed)}`);
    } catch (err) {
      message.error(err?.response?.data?.message || "Failed to end break");
    } finally {
      setLoading(false);
    }
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const handleLogout = () => {
    Modal.confirm({
      title: "Log out?",
      icon: <LogoutOutlined style={{ color: "#dc2626" }} />,
      content: sessionStart
        ? `Your session will be closed. Working time today: ${fmtDur(workSecs)}.`
        : "You'll be signed out of your account.",
      okText: "Log out",
      cancelText: "Stay logged in",
      okButtonProps: { danger: true, style: { borderRadius: 8 } },
      cancelButtonProps: { style: { borderRadius: 8 } },
      centered: true,
      onOk: async () => {
        if (user?._id) {
          try {
            await smApi.recordLogout(user._id);
          } catch {}
        }
        localStorage.removeItem(admintoken);
        dispatch(isLoginSuccess({}));
        navigate("/");
      },
    });
  };

  // ── In Time ──────────────────────────────────────────────────────────────
  // Opens the camera-capture modal. The actual /session/login call happens
  // once the modal confirms a photo + location (see handleInTimeConfirm).
  const handleOpenInTime = () => {
    if (!user?._id) return;
    setShowInTimeModal(true);
  };

  const handleInTimeConfirm = async (selfieUrl, coords) => {
    if (!user?._id) return;
    // selfieUrl may be null when a canSkip user chose to skip the photo
    const res = await smApi.recordLogin(user._id, {
      ...(selfieUrl ? { selfie_url: selfieUrl } : {}),
      latitude: coords?.latitude,
      longitude: coords?.longitude,
      accuracy: coords?.accuracy,
    });
    const session = res?.data?.data?.session;
    setSessionStart(session?.login_at ?? new Date().toISOString());
    setOnBreak(false);
    setBreakType(null);
    setBreakStart(null);
    setTotalBreakSecs(0);
    setShowInTimeModal(false);
    message.success("In time recorded!");
  };

  // ── Out Time ─────────────────────────────────────────────────────────────
  // Ends the attendance session ONLY. The user stays signed into the app —
  // no token removal, no navigation away. They can click "In Time" again
  // later to start a new attendance session.
  const handleOutTime = () => {
    if (!user?._id || !sessionStart) return;
    Modal.confirm({
      title: "Record out time?",
      icon: <LogoutOutlined style={{ color: "#DC2626" }} />,
      content: `Your attendance session will be closed. Worked time: ${fmtDur(workSecs)}. You'll stay logged in — this just stops the clock.`,
      okText: "Out Time",
      cancelText: "Cancel",
      okButtonProps: { danger: true, style: { borderRadius: 8 } },
      cancelButtonProps: { style: { borderRadius: 8 } },
      centered: true,
      onOk: async () => {
        setAttendanceLoading(true);
        try {
          await smApi.recordLogout(user._id);
        } catch (err) {
          message.error(
            err?.response?.data?.message || "Failed to record out time",
          );
          return;
        } finally {
          setAttendanceLoading(false);
        }
        setSessionStart(null);
        setOnBreak(false);
        setBreakType(null);
        setBreakStart(null);
        setTotalBreakSecs(0);
        setShowBreakMenu(false);
        message.success("Out time recorded. You're still logged in.");
      },
    });
  };

  // ── Derived display values ────────────────────────────────────────────────
  const otSecs = Math.max(0, workSecs - STANDARD_WORK_SECS);
  const showOT = otSecs > 0;
  const workPct = Math.min(
    100,
    Math.round((workSecs / STANDARD_WORK_SECS) * 100),
  );
  const ringColor = showOT ? "#F97316" : workPct >= 80 ? "#EAB308" : "#2563EB";
  const ringTrack = "#F1F5F9";
  const showStatsStrip =
    initialized && sessionStart && (workSecs > 0 || totalBreakSecs > 0);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div
        className="sticky z-40 bg-white/95 backdrop-blur-md border-b overflow-visible"
        style={{
          borderColor: "#EEF1F5",
          boxShadow: scrolled
            ? "0 4px 16px rgba(15, 23, 42, 0.06)"
            : "0 1px 2px rgba(15, 23, 42, 0.03)",
          transition: "box-shadow 0.25s ease",
          // Sits directly below the fixed mobile hamburger bar (52px) instead of
          // overlapping it; on desktop there is no hamburger bar so this is 0.
          top: "var(--mobile-topbar-offset, 0px)",
        }}
      >
        {/* ── Main row: identity + primary actions, always a single line ── */}
        <div className="flex items-center justify-between px-2.5 sm:px-4 md:px-6 py-2.5 sm:py-3 h-14 sm:h-16 md:h-20 gap-2 sm:gap-3">
          {/* Left: identity */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 overflow-hidden">
            <Avatar
              size={32}
              className="sm:!w-9 sm:!h-9 !text-[12px] sm:!text-[13px]"
              style={{
                background: "linear-gradient(135deg, #2563EB 0%, #4F46E5 100%)",
                fontWeight: 700,
                flexShrink: 0,
                boxShadow: "0 2px 6px rgba(37,99,235,0.25)",
              }}
            >
              {getInitials(user?.name)}
            </Avatar>

            <div className="flex flex-col min-w-0 flex-1 gap-0.5 overflow-hidden">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[13px] sm:text-[15px] leading-tight font-semibold text-slate-800 truncate">
                  {getGreeting(user?.name)}
                </span>
                <span
                  className="text-sm hidden md:inline shrink-0"
                  aria-hidden="true"
                >
                  {getGreetingIcon()}
                </span>
              </div>

              {/* Work status only shown inline from sm+; on mobile it moves to
                  the stats strip below so it isn't lost, just relocated. */}
              {initialized && sessionStart && (
                <span
                  className="hidden sm:inline-flex text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5 font-mono tabular-nums items-center gap-1 w-fit"
                  title="Time worked this session"
                >
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                    style={{
                      background: onBreak ? "#F59E0B" : "#22C55E",
                      boxShadow: onBreak
                        ? "0 0 0 2px rgba(245,158,11,0.18)"
                        : "0 0 0 2px rgba(34,197,94,0.18)",
                    }}
                  />
                  <span className="whitespace-nowrap">
                    {fmtDur(workSecs)} worked
                  </span>
                </span>
              )}
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* In Time / Out Time — attendance, separate from app auth */}
            {initialized &&
              (sessionStart ? (
                <Button
                  onClick={handleOutTime}
                  loading={attendanceLoading}
                  size="middle"
                  icon={!attendanceLoading && <LogoutOutlined />}
                  style={{
                    borderRadius: 10,
                    fontWeight: 600,
                    borderColor: "#FCA5A5",
                    color: "#DC2626",
                    background: "#FEF2F2",
                    height: 34,
                    paddingInline: 10,
                  }}
                  title="End your attendance session (you'll stay logged in)"
                >
                  <span className="hidden md:inline">Out Time</span>
                  <span className="md:hidden">⏱ Out</span>
                </Button>
              ) : (
                <Button
                  type="primary"
                  onClick={handleOpenInTime}
                  size="middle"
                  icon={<CameraOutlined />}
                  style={{
                    borderRadius: 10,
                    fontWeight: 600,
                    background:
                      "linear-gradient(135deg, #16A34A 0%, #15803D 100%)",
                    border: "none",
                    height: 34,
                    paddingInline: 10,
                    boxShadow: "0 2px 8px rgba(22,163,74,0.28)",
                  }}
                  title="Capture a photo + location to start your attendance session"
                >
                  <span className="hidden md:inline">In Time</span>
                  <span className="md:hidden">⏱ In</span>
                </Button>
              ))}

            {/* Work progress ring — desktop/tablet only; mobile gets the %
                inside the stats strip instead since hover tooltips don't
                work well on touch. */}
            {initialized && sessionStart && (
              <Tooltip
                title={
                  <div style={{ textAlign: "center", lineHeight: 1.5 }}>
                    <div style={{ fontWeight: 700 }}>{workPct}% of 10h day</div>
                    {showOT && <div>Overtime: {fmtDur(otSecs)}</div>}
                    {totalBreakSecs > 0 && (
                      <div>Break time: {fmtDur(totalBreakSecs)}</div>
                    )}
                  </div>
                }
              >
                <div
                  className="relative w-9 h-9 cursor-help hidden md:flex items-center justify-center rounded-full transition-transform duration-150 hover:scale-105"
                  role="img"
                  aria-label={`${workPct} percent of the standard work day completed`}
                >
                  <svg
                    width="36"
                    height="36"
                    viewBox="0 0 36 36"
                    className="-rotate-90"
                  >
                    <circle
                      cx="18"
                      cy="18"
                      r="14"
                      fill="none"
                      stroke={ringTrack}
                      strokeWidth="3.5"
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="14"
                      fill="none"
                      stroke={ringColor}
                      strokeWidth="3.5"
                      strokeDasharray={`${(87.96 * workPct) / 100} 87.96`}
                      strokeLinecap="round"
                      style={{
                        transition:
                          "stroke-dasharray 0.4s ease, stroke 0.3s ease",
                      }}
                    />
                  </svg>
                  <span className="absolute text-[9px] font-bold text-slate-600 tabular-nums">
                    {workPct}%
                  </span>
                </div>
              </Tooltip>
            )}

            {/* Break / Lunch */}
            {initialized &&
              sessionStart &&
              (onBreak ? (
                <Button
                  onClick={handleEndBreak}
                  loading={loading}
                  size="middle"
                  icon={!loading && <CloseCircleOutlined />}
                  style={{
                    background: breakType === "lunch" ? "#FEF3C7" : "#FEE2E2",
                    border:
                      "1px solid " +
                      (breakType === "lunch" ? "#FCD34D" : "#FCA5A5"),
                    color: breakType === "lunch" ? "#92400E" : "#DC2626",
                    fontWeight: 600,
                    borderRadius: 10,
                    height: 34,
                    paddingInline: 10,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                  }}
                >
                  <span className="hidden md:inline">
                    End {breakType === "lunch" ? "Lunch" : "Break"} ·{" "}
                  </span>
                  <span className="tabular-nums font-mono">
                    {fmtDur(breakLive)}
                  </span>
                </Button>
              ) : (
                <div className="relative" ref={breakMenuRef}>
                  <Button
                    onClick={() => setShowBreakMenu((v) => !v)}
                    size="middle"
                    icon={<CoffeeOutlined />}
                    loading={loading}
                    aria-haspopup="menu"
                    aria-expanded={showBreakMenu}
                    style={{
                      borderRadius: 10,
                      fontWeight: 600,
                      borderColor: "#E2E8F0",
                      color: "#374151",
                      height: 34,
                      paddingInline: 10,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span className="hidden md:inline">Break</span>
                    <DownOutlined
                      style={{
                        fontSize: 9,
                        transition: "transform 0.15s ease",
                        transform: showBreakMenu
                          ? "rotate(180deg)"
                          : "rotate(0deg)",
                      }}
                    />
                  </Button>

                  {showBreakMenu && (
                    <div
                      role="menu"
                      className="fixed sm:absolute right-2.5 sm:right-0 top-auto sm:top-11 left-2.5 sm:left-auto bg-white rounded-xl border border-slate-100 p-1.5 sm:w-[180px] animate-[fadeSlideIn_0.15s_ease-out]"
                      style={{
                        boxShadow: "0 12px 32px rgba(15,23,42,0.18)",
                        zIndex: 60,
                      }}
                    >
                      {[
                        {
                          type: "break",
                          icon: "☕",
                          label: "Short Break",
                          hint: "15 min",
                        },
                        {
                          type: "lunch",
                          icon: "🍽️",
                          label: "Lunch Break",
                          hint: "45 min",
                        },
                      ].map(({ type, icon, label, hint }) => (
                        <button
                          key={type}
                          role="menuitem"
                          onClick={() => handleStartBreak(type)}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 active:bg-slate-100 text-left transition-colors duration-100"
                        >
                          <span
                            className="text-base leading-none shrink-0"
                            aria-hidden="true"
                          >
                            {icon}
                          </span>
                          <span className="flex flex-col min-w-0">
                            <span className="truncate">{label}</span>
                            <span className="text-[10px] font-normal text-slate-400">
                              {hint} suggested
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}

            {/* New Job (admin only) */}
            {isAdmin ||
              (is_hari && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setCreateOpen(true)}
                  size="middle"
                  style={{
                    background:
                      "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
                    border: "none",
                    borderRadius: 10,
                    fontWeight: 600,
                    height: 34,
                    paddingInline: 10,
                    boxShadow: "0 2px 8px rgba(37,99,235,0.28)",
                  }}
                  className="hover:!shadow-lg hover:!brightness-105 transition-all duration-150"
                >
                  <span className="hidden md:inline">New Job</span>
                </Button>
              ))}

            {/* Divider */}
            <div
              className="hidden md:block w-px h-6 bg-slate-200 mx-0.5"
              aria-hidden="true"
            />

            {/* Logout */}
            <Tooltip title="Log out">
              <Button
                shape="circle"
                icon={<LogoutOutlined />}
                onClick={handleLogout}
                size="middle"
                aria-label="Log out"
                style={{
                  borderColor: "#E5E7EB",
                  color: "#6B7280",
                  width: 34,
                  height: 34,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
                className="hover:!text-red-600 hover:!border-red-200 hover:!bg-red-50 transition-colors duration-150"
              />
            </Tooltip>
          </div>
        </div>

        {/* ── Mobile stats strip: everything the sm+ layout hides (worked
            time, progress %, break total, overtime) gets a home here
            instead of disappearing, since this is the view staff actually
            check most. Horizontally scrollable so it never wraps/clips. */}
        {showStatsStrip && (
          <div className="sm:hidden flex items-center gap-1.5 px-2.5 pb-2 -mt-0.5 overflow-x-auto no-scrollbar">
            <StatChip>
              <span
                className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: onBreak ? "#F59E0B" : "#22C55E" }}
              />
              {fmtDur(workSecs)} worked
            </StatChip>
            <StatChip tone="blue">{workPct}% of day</StatChip>
            {showOT && (
              <StatChip tone="orange">⚡ OT +{fmtDur(otSecs)}</StatChip>
            )}
            {totalBreakSecs > 0 && !onBreak && (
              <StatChip tone="blue">
                <CoffeeOutlined style={{ fontSize: 10 }} />{" "}
                {fmtDur(totalBreakSecs)} break
              </StatChip>
            )}
          </div>
        )}
      </div>

      <CreateJobModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          onJobCreated?.();
        }}
        existingJobs={jobs}
      />

      {/* Capture photo + location and start the attendance session.
          canSkip=true for super admin / is_Special — photo is optional. */}
      <InTimeCaptureModal
        open={showInTimeModal}
        onClose={() => setShowInTimeModal(false)}
        onConfirm={handleInTimeConfirm}
        canSkip={canSkipInTimeCapture}
      />

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.65; }
        }
        .no-scrollbar {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </>
  );
};

export default TopNavbar;