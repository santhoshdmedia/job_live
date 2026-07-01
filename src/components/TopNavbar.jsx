import { useState, useEffect, useRef } from "react";
import { Button, Tooltip, Modal, message, Avatar } from "antd";
import {
  PlusOutlined,
  LogoutOutlined,
  CoffeeOutlined,
  CloseCircleOutlined,
  DownOutlined,
} from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import React from "react";
import { isLoginSuccess } from "../redux/slices/authSlice";
import { useNavigate } from "react-router-dom";
import CreateJobModal from "./job/Createjobmodal";
import { smApi } from "../api/staffmonitor.api";
import { admintoken } from "../helper/notification_helper";

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
      setSecs(Math.max(0, Math.floor((Date.now() - new Date(startIso)) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [running, startIso]);

  return secs;
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

  // UI
  const [loading, setLoading] = useState(false);
  const [showBreakMenu, setShowBreakMenu] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const breakMenuRef = useRef(null);

  // Live timers — both anchored to DB timestamps, so refresh-safe
  const workSecs = useLiveTimer(sessionStart, !!sessionStart && !onBreak);
  const breakLive = useLiveTimer(breakStart, onBreak);

  const isAdmin = ["super admin", "super_admin", "admin","designing head"].includes(
    user?.role?.toLowerCase?.()
  );

  // ── On mount: restore session & break state from server ──────────────────
  useEffect(() => {
    if (!user?._id) return;

    const initSession = async () => {
      try {
        // 1. Try to restore an existing active session
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
        // No active session found → record a fresh login
        try {
          const res = await smApi.recordLogin(user._id);
          const session = res?.data?.data?.session;
          setSessionStart(session?.login_at ?? new Date().toISOString());
        } catch {
          setSessionStart(new Date().toISOString());
        }
      } finally {
        setInitialized(true);
      }
    };

    initSession();
  }, [user?._id]);

  // ── Close break menu on outside click / Escape ───────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (breakMenuRef.current && !breakMenuRef.current.contains(e.target))
        setShowBreakMenu(false);
    };
    const escHandler = (e) => { if (e.key === "Escape") setShowBreakMenu(false); };
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
        type === "lunch" ? "🍽️ Lunch break started" : "☕ Break started"
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

  // ── Derived display values ────────────────────────────────────────────────
  const otSecs = Math.max(0, workSecs - STANDARD_WORK_SECS);
  const showOT = otSecs > 0;
  const workPct = Math.min(100, Math.round((workSecs / STANDARD_WORK_SECS) * 100));
  const ringColor = showOT ? "#F97316" : workPct >= 80 ? "#EAB308" : "#2563EB";
  const ringTrack = "#F1F5F9";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div
        className="flex items-center justify-between px-3 sm:px-4 md:px-6 py-3 h-16 md:h-20 bg-white/95 backdrop-blur-md border-b gap-2 sm:gap-3 overflow-visible sticky z-40"
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
        {/* ── Left: identity + greeting + work stats ── */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 overflow-hidden">
          <Avatar
            size={36}
            style={{
              background: "linear-gradient(135deg, #2563EB 0%, #4F46E5 100%)",
              fontWeight: 700,
              fontSize: 13,
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
              <span className="text-sm hidden sm:inline" aria-hidden="true">{getGreetingIcon()}</span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {initialized && sessionStart && (
                <span
                  className="hidden sm:inline-flex text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5 font-mono tabular-nums items-center gap-1"
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
                  <span className="whitespace-nowrap">{fmtDur(workSecs)} worked</span>
                </span>
              )}

              {totalBreakSecs > 0 && !onBreak && (
                <span className="text-[10px] sm:text-[11px] text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5 hidden lg:inline-flex items-center gap-1 tabular-nums">
                  <CoffeeOutlined style={{ fontSize: 10 }} />
                  {fmtDur(totalBreakSecs)} break
                </span>
              )}

              {showOT && (
                <span className="text-[10px] sm:text-[11px] font-bold text-orange-700 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5 tabular-nums animate-[pulse_2.4s_ease-in-out_infinite] hidden sm:inline-flex">
                  ⚡ OT +{fmtDur(otSecs)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Right: actions ── */}
        <div className="flex items-center gap-1.5 sm:gap-2 ml-auto flex-nowrap justify-end shrink-0 flex-none">

          {/* Work progress ring */}
          {initialized && sessionStart && (
            <Tooltip
              title={
                <div style={{ textAlign: "center", lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 700 }}>{workPct}% of 10h day</div>
                  {showOT && <div>Overtime: {fmtDur(otSecs)}</div>}
                  {totalBreakSecs > 0 && <div>Break time: {fmtDur(totalBreakSecs)}</div>}
                </div>
              }
            >
              <div
                className="relative w-9 h-9 cursor-help hidden sm:flex items-center justify-center rounded-full transition-transform duration-150 hover:scale-105"
                role="img"
                aria-label={`${workPct} percent of the standard work day completed`}
              >
                <svg width="36" height="36" viewBox="0 0 36 36" className="-rotate-90">
                  <circle cx="18" cy="18" r="14" fill="none" stroke={ringTrack} strokeWidth="3.5" />
                  <circle
                    cx="18" cy="18" r="14"
                    fill="none"
                    stroke={ringColor}
                    strokeWidth="3.5"
                    strokeDasharray={`${(87.96 * workPct) / 100} 87.96`}
                    strokeLinecap="round"
                    style={{ transition: "stroke-dasharray 0.4s ease, stroke 0.3s ease" }}
                  />
                </svg>
                <span className="absolute text-[9px] font-bold text-slate-600 tabular-nums">
                  {workPct}%
                </span>
              </div>
            </Tooltip>
          )}

          {/* Break / Lunch */}
          {initialized && sessionStart && (
            onBreak ? (
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
                  height: 36,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                }}
              >
                <span className="hidden sm:inline">
                  End {breakType === "lunch" ? "Lunch" : "Break"} ·{" "}
                </span>
                <span className="tabular-nums font-mono">{fmtDur(breakLive)}</span>
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
                    height: 36,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <span className="hidden sm:inline">Break</span>
                  <DownOutlined
                    style={{
                      fontSize: 9,
                      transition: "transform 0.15s ease",
                      transform: showBreakMenu ? "rotate(180deg)" : "rotate(0deg)",
                    }}
                  />
                </Button>

                {showBreakMenu && (
                  <div
                    role="menu"
                    className="absolute right-0 top-11 bg-white rounded-xl border border-slate-100 p-1.5 w-[180px] max-w-[calc(100vw-24px)] animate-[fadeSlideIn_0.15s_ease-out]"
                    style={{
                      boxShadow: "0 12px 32px rgba(15,23,42,0.18)",
                      zIndex: 60,
                    }}
                  >
                    {[
                      { type: "break", icon: "☕", label: "Short Break", hint: "15 min" },
                      { type: "lunch", icon: "🍽️", label: "Lunch Break", hint: "45 min" },
                    ].map(({ type, icon, label, hint }) => (
                      <button
                        key={type}
                        role="menuitem"
                        onClick={() => handleStartBreak(type)}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 active:bg-slate-100 text-left transition-colors duration-100"
                      >
                        <span className="text-base leading-none shrink-0" aria-hidden="true">{icon}</span>
                        <span className="flex flex-col min-w-0">
                          <span className="truncate">{label}</span>
                          <span className="text-[10px] font-normal text-slate-400">{hint} suggested</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          )}

          {/* New Job (admin only) */}
          {isAdmin && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateOpen(true)}
              size="middle"
              style={{
                background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
                border: "none",
                borderRadius: 10,
                fontWeight: 600,
                height: 36,
                boxShadow: "0 2px 8px rgba(37,99,235,0.28)",
              }}
              className="hover:!shadow-lg hover:!brightness-105 transition-all duration-150"
            >
              <span className="hidden sm:inline">New Job</span>
            </Button>
          )}

          {/* Divider */}
          <div className="hidden sm:block w-px h-6 bg-slate-200 mx-0.5" aria-hidden="true" />

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
                width: 36,
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              className="hover:!text-red-600 hover:!border-red-200 hover:!bg-red-50 transition-colors duration-150"
            />
          </Tooltip>
        </div>
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

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.65; }
        }
      `}</style>
    </>
  );
};

export default TopNavbar;