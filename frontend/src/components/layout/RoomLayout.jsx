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
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const voiceState = useVoiceState({ roomId });
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  const normId = (v) => (v === null || v === undefined ? "" : String(v));

  const voiceById = new Map(
    (voiceState?.participants || []).map((p) => [normId(p.id), p])
  );

  const myId = normId(user?.id);

  const participantsForUI =
    Array.isArray(roomMembers) && roomMembers.length > 0
      ? roomMembers.map((m) => {
          const mid = normId(m.id);
          const vp = voiceById.get(mid);

          return {
            id: mid,
            name: m.username || m.name || mid,
            isMe: myId ? mid === myId : false,
            isInVoice: !!vp,
            isMuted: vp ? !!vp.isMuted : true,
            isSpeaking: vp ? !!vp.isSpeaking : false,
            role: m.role,
          };
        })
      : (voiceState?.participants || []).map((p) => ({
          ...p,
          id: normId(p.id),
          isInVoice: true,
        }));

  const navigate = useNavigate();
  const { showToast } = useToast();
  const [localTitle, setLocalTitle] = useState(title);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef(null);

  const prevParticipantsRef = useRef(new Map());

  const myRole = participantsForUI.find((p) => p.isMe)?.role || "VIEWER";
  const prevMyRoleRef = useRef(myRole);

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

  useEffect(() => {
    setLocalTitle(title || "Untitled");
  }, [title]);

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
  }, [participantsForUI, showToast]);

  useEffect(() => {
    let prevRole = prevMyRoleRef.current;
    if (prevRole === myRole) return;

    if (myRole === "EDITOR") {
      showToast("You are now an editor", "info");
    } else if (myRole === "VIEWER") {
      showToast("You are now a viewer", "info");
    }

    prevMyRoleRef.current = myRole;
  }, [myRole, showToast]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    const onKicked = async () => {
      try {
        // leave voice if connected
        await voiceState?.leaveVoice?.();
      } catch (_) {
        // ignore
      } finally {
        navigate("/", { replace: true });
      }
    };

    window.addEventListener("wb-kicked", onKicked);
    return () => window.removeEventListener("wb-kicked", onKicked);
  }, [leaveVoice, navigate]);

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

      <CommDock
        voiceState={voiceState}
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
      />
    </div>
  );
}
