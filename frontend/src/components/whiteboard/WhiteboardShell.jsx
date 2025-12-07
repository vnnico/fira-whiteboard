import { FiChevronDown, FiMoreVertical } from "react-icons/fi";

export function WhiteboardShell({
  title = "Untitled",
  children,
  onInviteClick,
}) {
  return (
    <div className="flex h-screen flex-col bg-slate-100 text-slate-900">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-3 bg-slate-900 shadow-sm">
        <div className="flex items-center">
          <div className="flex items-center gap-2 rounded-full bg-slate-100 px-2 py-2">
            <span className="h-6 w-6 rounded-full bg-slate-400 inline-block" />
            <span className="text-sm font-medium text-slate-900">{title}</span>
            <button className="text-slate-900">
              <FiMoreVertical />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 gap-2">
            <span className="h-6 w-6 rounded-full bg-slate-400" />
            <span className="h-6 w-6 -ml-2 rounded-full bg-slate-400" />
            <span className="h-6 w-6 -ml-2 rounded-full bg-slate-400" />
            <FiChevronDown className="ml-1" />
          </div>
          <button
            onClick={onInviteClick}
            className="rounded-full bg-slate-100 px-4 py-2 text-xs font-medium text-slate-900"
          >
            Invite
          </button>
        </div>
      </header>

      {/* Fullscreen whiteboard area */}
      <main className="relative flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
