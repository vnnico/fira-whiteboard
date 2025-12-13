import React, { useState, useEffect, useRef } from "react";
import { FiShare2, FiMenu, FiChevronLeft } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { useMockVoiceState } from "../../hooks/useMockVoiceState";
import CommDock from "./CommDock";
import ManagementSidebar from "./ManagementSidebar";
import { updateBoardTitle } from "../../services/whiteboardApi";
import { useToast } from "../../hooks/useToast";

export default function RoomLayout({
  children,
  roomId,
  title = "Untitled",
  onTitleUpdated,
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const voiceState = useMockVoiceState();

  const navigate = useNavigate();
  const { showToast } = useToast();
  const [localTitle, setLocalTitle] = useState(title);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    setLocalTitle(title || "Untitled");
  }, [title]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

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

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-slate-50">
      <header className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex items-center justify-between p-4">
        <div className="pointer-events-auto flex items-center gap-2 rounded-xl bg-white/90 p-1.5 shadow-sm backdrop-blur-sm ring-1 ring-slate-900/5 transition-all hover:bg-white">
          <button
            onClick={() => navigate("/")}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600"
          >
            <FiChevronLeft className="h-5 w-5" />
          </button>
          <div className="h-4 w-px bg-slate-200" />
          <div className="px-2">
            {isEditing ? (
              <form onSubmit={handleTitleSubmit}>
                <input
                  ref={inputRef}
                  value={localTitle}
                  onChange={(e) => setLocalTitle(e.target.value)}
                  onBlur={handleTitleSubmit}
                  disabled={isSaving}
                  className="w-[150px] rounded-md border border-emerald-500 bg-white px-1 py-0.5 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-200 md:w-[200px]"
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
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-3">
          <div
            className="flex -space-x-2 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setIsSidebarOpen(true)}
          >
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-8 w-8 rounded-full border-2 border-white bg-slate-200 ring-1 ring-slate-900/5"
              />
            ))}
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
      </header>

      <main className="absolute inset-0 z-0">{children}</main>

      <CommDock
        voiceState={voiceState}
        onToggleChat={() => setIsSidebarOpen((prev) => !prev)}
      />
      <ManagementSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
    </div>
  );
}
