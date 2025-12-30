import { useState, useEffect, useRef } from "react";
import { FiShare2, FiMenu, FiChevronLeft, FiDownload } from "react-icons/fi";

import { useLocation, useNavigate } from "react-router-dom";
import { useVoiceState } from "../../hooks/useVoiceState";
import CommDock from "./CommDock";
import ManagementSidebar from "./ManagementSidebar";
import { updateBoardTitle } from "../../services/whiteboardApi";
import { useToast } from "../../hooks/useToast";
import { useAuth } from "../../hooks/useAuth";
import { getAvatarColor, getInitials } from "../../utils/avatarUtils";

export default function RoomLayout({
  children,
  roomId,
  title = "Untitled",
  onTitleUpdated,
  roomMembers = [],
  kickUserFn,
  setUserRoleFn,
  onExportPngFn,
  wbConnectionState = "disconnected",
  timerState,
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const voiceState = useVoiceState({ roomId });
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  const normId = (v) => (v === null || v === undefined ? "" : String(v));

  const voiceById = new Map(
    (voiceState?.participants || []).map((p) => [normId(p.id), p])
  );
  const [voiceStateMap, setVoiceStateMap] = useState(() => new Map());

  const myId = normId(user?.id);
  const lkById = new Map(
    (voiceState?.participants || []).map((p) => [normId(p.id), p])
  );

  const hasJoinedWhiteboardRoom = Array.isArray(roomMembers)
    ? roomMembers.some((m) => String(m?.id ?? m) === myId)
    : false;

  //  Gating hanya untuk tombol Join (initial). Voice yang sudah connected tidak terpengaruh.
  const canJoinVoice = Boolean(myId) && hasJoinedWhiteboardRoom;

  const voiceByUserId = voiceState?.remoteVoiceStates || {};
  const participantsForUI = (roomMembers || []).map((m) => {
    const id = normId(m?.id ?? m);
    const username = m?.username || m?.name || "Unknown";
    const isMe = id === myId;

    const v = voiceByUserId[id] || {};
    const lk = lkById.get(id);

    const micEnabled =
      typeof v.micEnabled === "boolean"
        ? v.micEnabled
        : lk
        ? !lk.isMuted
        : undefined;

    return {
      ...m,
      id,
      name: username,
      isMe,
      isInVoice: !!v.inVoice,
      isDeafened: !!v.deafened,
      isMuted: typeof micEnabled === "boolean" ? !micEnabled : undefined,
      isSpeaking: !!lk?.isSpeaking,
      voice: {
        inVoice: !!v.inVoice,
        micEnabled,
        deafened: !!v.deafened,
      },
    };
  });

  const navigate = useNavigate();
  const { showToast } = useToast();
  const [localTitle, setLocalTitle] = useState(title);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef(null);

  const prevParticipantsRef = useRef(new Map());

  const myRole = participantsForUI.find((p) => p.isMe)?.role || "VIEWER";
  const prevMyRoleRef = useRef(myRole);
  const hasInitMyRoleRef = useRef(false);

  const audioUnlockOnceRef = useRef(false);

  const { needsAudioStart, startAudioPlayback, leaveVoice } = voiceState;

  const handleAnyUserGesture = async () => {
    if (!needsAudioStart) return;
    if (audioUnlockOnceRef.current) return;

    audioUnlockOnceRef.current = true;
    try {
      await startAudioPlayback?.();
    } finally {
      if (needsAudioStart) audioUnlockOnceRef.current = false;
    }
  };

  const formatMs = (ms) => {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const [remainingMs, setRemainingMs] = useState(0);

  useEffect(() => {
    if (!timerState?.running || !timerState?.endAt) {
      setRemainingMs(0);
      return;
    }

    const tick = () => setRemainingMs(timerState.endAt - Date.now());
    tick();

    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [timerState?.running, timerState?.endAt]);

  useEffect(() => {
    setLocalTitle(title || "Untitled");
  }, [title]);

  useEffect(() => {
    const handler = (e) => {
      const p = e?.detail || {};
      const action = String(p.action || "");

      if (action === "start") showToast("Timer started", "success");
      if (action === "stop") showToast("Timer stopped", "info");
      if (action === "reset") showToast("Timer reset", "info");
    };

    window.addEventListener("wb-timer-action", handler);
    return () => window.removeEventListener("wb-timer-action", handler);
  }, [showToast]);

  useEffect(() => {
    let prev = prevParticipantsRef.current;
    let next = new Map();

    for (let i = 0; i < participantsForUI.length; i++) {
      let p = participantsForUI[i];
      next.set(String(p.id), p);
    }

    if (prev.size === 0) {
      prevParticipantsRef.current = next;
      return;
    }

    if (wbConnectionState !== "connected") {
      prevParticipantsRef.current = next;
      return;
    }

    next.forEach((p, id) => {
      if (!prev.has(id)) {
        showToast(p.name + " joined", "info");
      }
    });

    // Leave = ada di prev tapi tidak ada di next
    prev.forEach((p, id) => {
      if (!next.has(id)) {
        showToast(p.name + " left", "info");
      }
    });

    prevParticipantsRef.current = next;
  }, [participantsForUI, showToast, wbConnectionState]);

  useEffect(() => {
    // Prevent role toasts during initial hydration
    // wait until connected AND all user already appears in roomMembers.
    if (wbConnectionState !== "connected" || !hasJoinedWhiteboardRoom) {
      hasInitMyRoleRef.current = false;
      prevMyRoleRef.current = myRole;
      return;
    }

    // First stable moment (connected + already in roomMembers) and set baseline role w/o toast
    if (!hasInitMyRoleRef.current) {
      hasInitMyRoleRef.current = true;
      prevMyRoleRef.current = myRole;
      return;
    }

    const prevRole = prevMyRoleRef.current;
    if (prevRole === myRole) return;

    if (myRole === "EDITOR") {
      showToast("You are now an editor", "info");
    } else if (myRole === "VIEWER") {
      showToast("You are now a viewer", "info");
    }

    prevMyRoleRef.current = myRole;
  }, [myRole, showToast, wbConnectionState, hasJoinedWhiteboardRoom]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    const onKicked = async (e) => {
      const reason = e?.detail?.reason;

      //  toast di sini supaya pasti muncul sebelum navigate
      if (reason === "timer") showToast("Session ended (timer)", "info");

      try {
        await voiceState?.leaveVoice?.();
      } catch (_) {
        // ignore
      } finally {
        navigate("/", { replace: true });
      }
    };

    window.addEventListener("wb-kicked", onKicked);
    return () => window.removeEventListener("wb-kicked", onKicked);
  }, [voiceState, navigate, showToast]);

  const participantsRef = useRef([]);
  useEffect(() => {
    participantsRef.current = participantsForUI;
  }, [participantsForUI]);

  useEffect(() => {
    const handler = (e) => {
      const payload = e?.detail;
      if (!payload) return;

      // forward ke useVoiceState (target user akan memproses)
      window.dispatchEvent(
        new CustomEvent("voice-moderation", { detail: payload })
      );

      const action = String(payload.action || "");
      const targetId = String(payload.targetUserId || "");
      const actorId = String(payload.actorUserId || "");

      window.dispatchEvent(
        new CustomEvent("voice-moderation", { detail: payload })
      );

      // toast name lookup pakai ref agar tidak dependency-loop
      const list = participantsRef.current || [];
      const targetName =
        list.find((p) => String(p.id) === targetId)?.name || "A participant";

      if (targetId === myId) {
        if (action === "mute") showToast("You were muted by the host", "info");

        return;
      }

      if (actorId === myId) {
        if (action === "mute") showToast(`Muted ${targetName}`, "info");
      }
    };

    window.addEventListener("voice-moderation-raw", handler);
    return () => window.removeEventListener("voice-moderation-raw", handler);
  }, [myId, showToast]);

  useEffect(() => {
    const onSnapshot = (e) => {
      const snap = e?.detail?.snapshot || {};
      const next = new Map();
      for (const [uid, st] of Object.entries(snap)) {
        next.set(String(uid), {
          inVoice: !!st?.inVoice,
          deafened: !!st?.deafened,
        });
      }
      setVoiceStateMap(next);
    };

    const onUpdate = (e) => {
      const p = e?.detail;
      if (!p?.userId) return;

      const uid = String(p.userId);
      setVoiceStateMap((prev) => {
        const next = new Map(prev);
        const cur = next.get(uid) || { inVoice: false, deafened: false };

        next.set(uid, {
          inVoice: typeof p.inVoice === "boolean" ? p.inVoice : !!cur.inVoice,
          deafened:
            typeof p.deafened === "boolean" ? p.deafened : !!cur.deafened,
        });
        return next;
      });
    };

    window.addEventListener("voice-state-snapshot-raw", onSnapshot);
    window.addEventListener("voice-state-raw", onUpdate);
    return () => {
      window.removeEventListener("voice-state-snapshot-raw", onSnapshot);
      window.removeEventListener("voice-state-raw", onUpdate);
    };
  }, []);

  const handleTitleSubmit = async (e) => {
    e?.preventDefault();
    const nextTitle = localTitle.trim() || "Untitled";

    if (nextTitle === title) {
      setIsEditing(false);
      return;
    }

    if (!roomId) {
      setIsEditing(false);
      return;
    }

    try {
      setIsSaving(true);
      const res = await updateBoardTitle(roomId, nextTitle);
      const finalTitle = res?.board?.title || res?.title || nextTitle;
      setLocalTitle(finalTitle);
      onTitleUpdated?.(finalTitle);
      showToast("Title updated", "success");
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      showToast("Failed to update title", "error");
      setLocalTitle(title);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast("Link copied to clipboard!", "success");
    } catch (err) {
      showToast("Failed to copy link", "error");
    }
  };

  // Avatar panel
  const topAvatars = (participantsForUI || []).slice(0, 5);

  return (
    <div
      className="relative flex h-screen w-screen flex-col overflow-hidden bg-slate-50"
      onPointerDownCapture={handleAnyUserGesture}
    >
      <header className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex items-center justify-between p-4">
        <div className="pointer-events-auto flex items-center gap-2 rounded-xl bg-white/90 p-1.5 shadow-sm backdrop-blur-sm ring-1 ring-slate-900/5 transition-all hover:bg-white">
          <button
            onClick={() => {
              if (!isAuthenticated) {
                navigate("/login", { state: { from: location } });
                return;
              }
              navigate("/");
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600"
          >
            <FiChevronLeft className="h-5 w-5" />
          </button>
          <div className="h-4 w-px bg-slate-200" />
          <div className="flex min-w-0 items-center gap-2 px-3">
            {isEditing ? (
              <form onSubmit={handleTitleSubmit} className="min-w-0">
                <input
                  ref={inputRef}
                  value={localTitle}
                  onChange={(e) => setLocalTitle(e.target.value)}
                  onBlur={handleTitleSubmit}
                  disabled={isSaving}
                  className=" w-[180px] md:w-[320px] max-w-[60vw]
            rounded-md border border-emerald-500 bg-white px-2 py-1
            text-sm font-semibold text-slate-900 outline-none
            focus:ring-2 focus:ring-emerald-200"
                />
              </form>
            ) : (
              <button
                onClick={() => roomId && setIsEditing(true)}
                className="max-w-[150px] truncate text-left text-sm font-semibold text-slate-700 hover:text-emerald-600 hover:underline md:max-w-xs"
                title="Click to rename"
              >
                {localTitle}
              </button>
            )}
            <div className="my-2 w-px bg-slate-200" />

            {/* Export button */}
            <button
              onClick={() => onExportPngFn?.()}
              disabled={!onExportPngFn}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              title="Export PNG"
            >
              <FiDownload className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-3">
          {/* Avatar panel */}
          <div
            className="flex -space-x-2 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setIsSidebarOpen(true)}
          >
            {topAvatars.length === 0 ? (
              <div className="h-8 w-8 rounded-full bg-slate-200 ring-2 ring-white" />
            ) : (
              topAvatars.map((p) => {
                const bg = getAvatarColor(p.id);
                const initials = getInitials(p.name, p.id);

                return (
                  <div
                    key={p.id}
                    className="h-8 w-8 rounded-full ring-2 ring-white grid place-items-center text-[11px] font-extrabold text-white shadow-sm"
                    title={p.name}
                    style={{
                      background: bg,

                      boxShadow: p.isSpeaking
                        ? "0 0 0 2px rgba(16,185,129,0.35), 0 6px 18px rgba(0,0,0,0.12)"
                        : "0 6px 18px rgba(0,0,0,0.10)",
                    }}
                  >
                    {initials}
                  </div>
                );
              })
            )}

            {participantsForUI.length > topAvatars.length && (
              <div
                className="h-8 w-8 rounded-full ring-2 ring-white grid place-items-center text-[11px] font-extrabold text-slate-700 bg-slate-200 shadow-sm"
                title={`${participantsForUI.length - topAvatars.length} more`}
              >
                +{participantsForUI.length - topAvatars.length}
              </div>
            )}
          </div>
          <button
            onClick={handleShare}
            className="flex h-9 items-center gap-2 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white shadow hover:bg-slate-800 transition-colors"
          >
            <FiShare2 />
            <span className="hidden md:inline">Share</span>
          </button>
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-white shadow ring-1 ring-slate-900/5 hover:bg-slate-50 transition-colors"
          >
            <FiMenu className="text-slate-600" />
          </button>
        </div>

        {voiceState?.needsAudioStart &&
          voiceState?.connectionState === "connected" && (
            <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-xs text-white shadow">
              Audio diblokir browser. Klik di mana saja untuk mengaktifkan
              suara.
            </div>
          )}
      </header>

      <main className="absolute inset-0 z-0">{children}</main>

      {timerState?.running && timerState?.endAt && (
        <div className="fixed bottom-4 right-4 z-50 pointer-events-none">
          <div className={"rounded-xl px-4 py-2 text-black"}>
            <div className="text-xs opacity-80">Time left</div>
            <div
              className={[
                "tabular-nums",
                remainingMs <= 10_000
                  ? "text-xl text-red-500 animate-pulse font-semibold"
                  : "text-red",
              ].join(" ")}
            >
              {formatMs(remainingMs)}
            </div>
          </div>
        </div>
      )}

      <CommDock
        voiceState={voiceState}
        canJoinVoice={canJoinVoice}
        onToggleChat={() => setIsSidebarOpen((prev) => !prev)}
      />
      <ManagementSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        participants={participantsForUI}
        voiceState={voiceState}
        myRole={myRole}
        onSetRole={(targetUserId, role) => setUserRoleFn?.(targetUserId, role)}
        onKick={(targetUserId) => kickUserFn?.(targetUserId)}
        onMuteParticipant={(targetUserId) =>
          voiceState?.ownerMuteParticipant?.(targetUserId)
        }
        onToggleDeafenParticipant={(targetUserId, deafened) =>
          voiceState?.ownerSetDeafenParticipant?.(targetUserId, deafened)
        }
      />
    </div>
  );
}
