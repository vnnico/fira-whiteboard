// frontend/src/components/whiteboard/WhiteboardShell.jsx
import { useEffect, useRef, useState } from "react";
import { FiChevronLeft, FiChevronDown, FiMoreVertical } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { updateBoardTitle } from "../../services/whiteboardApi";
import { useToast } from "../../hooks/useToast";

export function WhiteboardShell({
  title = "Untitled",
  roomId,
  onTitleChange,
  children,
  handleShareLink,
}) {
  const navigate = useNavigate();
  const { showToast } = useToast?.() || { showToast: () => {} };

  const [localTitle, setLocalTitle] = useState(title);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const inputRef = useRef(null);

  // sinkron ketika prop title berubah (misal dari fetch)
  useEffect(() => {
    setLocalTitle(title || "Untitled");
  }, [title]);

  // auto-focus ketika masuk mode edit
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleBack = () => {
    navigate("/");
  };

  const startEdit = () => {
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setLocalTitle(title || "Untitled");
  };

  const handleTitleSubmit = async (e) => {
    e.preventDefault();
    const nextTitle = localTitle.trim() || "Untitled";

    // kalau belum ada roomId (edge case) → lokal saja
    console.log(roomId);
    if (!roomId) {
      onTitleChange?.(nextTitle);
      setIsEditing(false);
      return;
    }

    try {
      setIsSaving(true);
      const res = await updateBoardTitle(roomId, nextTitle);
      console.log(res);
      const finalTitle = res?.title || nextTitle;
      onTitleChange?.(finalTitle);
      setLocalTitle(finalTitle);
      setIsEditing(false);
      showToast?.("Title updated", "success");
    } catch (err) {
      console.error(err);
      showToast?.("Failed to update title", "error");
      cancelEdit();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-slate-900 text-slate-50">
      {/* HEADER */}
      <header className="flex h-14 items-center justify-between border-b border-slate-800 px-4">
        {/* Left: back + title */}
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={handleBack}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700"
          >
            <FiChevronLeft className="h-4 w-4" />
          </button>

          <div
            className="flex min-w-0 items-center gap-3
          "
          >
            {isEditing ? (
              <form
                onSubmit={handleTitleSubmit}
                className="flex min-w-0 items-center gap-2"
              >
                <input
                  ref={inputRef}
                  value={localTitle}
                  onChange={(e) => setLocalTitle(e.target.value)}
                  onBlur={!isSaving ? handleTitleSubmit : undefined}
                  className="min-w-0 max-w-xs truncate rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-sm outline-none focus:border-fira-primary"
                  placeholder="Untitled"
                />
              </form>
            ) : (
              <button
                type="button"
                onClick={startEdit}
                className="min-w-0 max-w-xs truncate text-left text-sm font-medium text-slate-50 hover:text-slate-100"
                title={localTitle}
              >
                {localTitle}
              </button>
            )}

            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700"
            >
              <FiMoreVertical className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-full bg-slate-700 px-3 py-1 text-xs text-slate-200 gap-2">
            <span className="h-6 w-6 rounded-full bg-slate-500" />
            <span className="h-6 w-6 rounded-full bg-slate-500 -ml-2" />
            <span className="h-6 w-6 rounded-full bg-slate-500 -ml-2" />
            <FiChevronDown className="ml-2" />
          </div>
          {handleShareLink && (
            <button
              onClick={handleShareLink}
              className="rounded-lg bg-fira-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500"
            >
              Share link
            </button>
          )}
        </div>
      </header>

      {/* BODY */}
      <main className="relative flex-1 overflow-hidden bg-slate-950">
        {children}
      </main>
    </div>
  );
}
