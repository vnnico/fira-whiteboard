import {
  FiMic,
  FiHeadphones,
  FiMessageSquare,
  FiPhone,
  FiPhoneOff,
} from "react-icons/fi";

function SlashedIcon({
  children,
  slashClassName = "bg-rose-500/90 text-rose-500/90",
  rotateClass = "rotate-45",
  slashHeightClass = "h-6",
  slashWidthClass = "w-[2px]",
}) {
  return (
    <span className="relative inline-flex">
      {children}
      <span
        className={[
          "pointer-events-none absolute left-1/2 top-1/2",
          "-translate-x-1/2 -translate-y-1/2",
          rotateClass,
          "rounded-full",
          slashHeightClass,
          slashWidthClass,
          slashClassName,
        ].join(" ")}
      />
    </span>
  );
}

export default function CommDock({
  voiceState,
  canJoinVoice,
  onToggleChat,
  unreadCount = 0,
}) {
  const {
    connectionState,
    isMicEnabled,
    isDeafened,
    joinVoice,
    leaveVoice,
    toggleMic,
    toggleDeafen,
    needsAudioStart,
    startAudioPlayback,
    lastError,
    disconnectReason,
  } = voiceState;

  const isDisconnected = connectionState === "disconnected";
  const isConnecting = connectionState === "connecting";
  const isConnected = connectionState === "connected";

  // Status message (single source of truth for the dock)
  let statusText = "";
  // if (isConnecting) statusText = "Connecting…";
  // if (isConnected) statusText = "Connected";
  // if (isDisconnected && disconnectReason) statusText = "Disconnected";

  if (lastError) statusText = lastError;
  if (needsAudioStart) statusText = "Audio is blocked. Tap to enable audio.";

  if (isDisconnected) {
    return (
      <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
        <div className="flex items-center overflow-hidden rounded-full bg-white p-1 shadow-xl ring-1 ring-slate-900/5 transition-all hover:scale-105">
          <button
            onClick={joinVoice}
            disabled={!canJoinVoice}
            className={
              canJoinVoice
                ? "flex items-center gap-2 rounded-full bg-emerald-500 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-600"
                : "flex items-center gap-2 rounded-full bg-slate-100 px-6 py-3 text-sm font-bold text-slate-600 opacity-40 transition-colors hover:bg-slate-200"
            }
          >
            <FiPhone className="h-4 w-4" />
            <span>Join Voice</span>
          </button>

          <div className="mx-1 h-6 w-px bg-slate-200" />

          <button
            onClick={onToggleChat}
            className="relative rounded-full p-3 text-slate-600 hover:bg-slate-100"
          >
            <FiMessageSquare />
            {unreadCount > 0 && (
              <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
            )}
          </button>
        </div>

        {statusText && (
          <div className="max-w-[520px] rounded-full bg-white/90 px-4 py-2 text-xs text-slate-600 shadow ring-1 ring-slate-900/5">
            {statusText}
          </div>
        )}
      </div>
    );
  }

  if (isConnecting) {
    return (
      <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 flex flex-col items-center gap-2">
        <div className="flex items-center rounded-full bg-white px-6 py-3 shadow-xl ring-1 ring-slate-900/5">
          <span className="flex items-center gap-2 text-sm font-bold text-slate-600 me-1">
            <svg
              className="h-4 w-4 animate-spin text-emerald-500"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Connecting...
          </span>

          <div className="mx-1 h-6 w-px bg-slate-200" />

          <div className="flex gap-1">
            <DockButton
              onClick={onToggleChat}
              onIcon={<FiMessageSquare />}
              variant="secondary"
              hasBadge={unreadCount > 0}
              tooltip="Chat"
            />
          </div>

          <div className="mx-3 h-8 w-px bg-slate-200" />

          <DockButton
            onClick={leaveVoice}
            onIcon={<FiPhoneOff />}
            variant="danger-ghost"
            tooltip="Cancel"
          />
        </div>

        {statusText && (
          <div className="max-w-[520px] rounded-full bg-white/90 px-4 py-2 text-xs text-slate-600 shadow ring-1 ring-slate-900/5">
            {statusText}
          </div>
        )}
      </div>
    );
  }

  // CONNECTED
  return (
    <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
      <div className="flex items-center rounded-full bg-white p-1.5 shadow-2xl ring-1 ring-slate-900/5 transition-all">
        <div className="flex gap-1">
          <DockButton
            active={isMicEnabled}
            onClick={toggleMic}
            disabled={!isConnected}
            variant="secondary"
            onIcon={<FiMic className="text-slate-700" />}
            offIcon={
              <SlashedIcon
                slashClassName="bg-rose-500/90"
                rotateClass="rotate-45"
              >
                <FiMic className="text-rose-500/90" />
              </SlashedIcon>
            }
            tooltip={isMicEnabled ? "Turn mic off" : "Turn mic on"}
          />

          <DockButton
            active={!isDeafened}
            onClick={toggleDeafen}
            variant="secondary"
            onIcon={<FiHeadphones className="text-slate-700" />}
            offIcon={
              <SlashedIcon
                slashClassName="bg-rose-500/90"
                rotateClass="rotate-45"
              >
                <FiHeadphones className="text-rose-500/90" />
              </SlashedIcon>
            }
            tooltip={isDeafened ? "Undeafen" : "Deafen"}
          />
        </div>

        <div className="mx-3 h-8 w-px bg-slate-200" />

        <div className="flex gap-1">
          <DockButton
            onClick={onToggleChat}
            onIcon={<FiMessageSquare />}
            variant="secondary"
            hasBadge={unreadCount > 0}
            tooltip="Chat"
          />
        </div>

        <div className="mx-3 h-8 w-px bg-slate-200" />

        <DockButton
          onClick={leaveVoice}
          onIcon={<FiPhoneOff />}
          variant="danger-ghost"
          tooltip="Disconnect"
        />
      </div>

      {needsAudioStart && (
        <button
          type="button"
          onClick={startAudioPlayback}
          className="rounded-full bg-white/90 px-4 py-2 text-xs font-medium text-slate-700 shadow ring-1 ring-slate-900/5 hover:bg-white"
          title="Enable audio playback"
        >
          Enable audio
        </button>
      )}

      {statusText && (
        <div className="max-w-[520px] rounded-full bg-white/90 px-4 py-2 text-xs text-slate-600 shadow ring-1 ring-slate-900/5">
          {statusText}
        </div>
      )}
    </div>
  );
}

function DockButton({
  active = true,
  onClick,
  onIcon,
  offIcon,
  variant = "secondary",
  hasBadge,
  tooltip,
  disabled = false,
}) {
  const baseClass =
    "relative flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200 focus:outline-none";

  const variants = {
    secondary: "bg-slate-100 text-slate-600 hover:bg-slate-200",
    "danger-ghost": "text-rose-500 hover:bg-rose-50 hover:text-rose-600",
  };

  const disabledClass = disabled
    ? "opacity-40 cursor-not-allowed hover:bg-inherit"
    : "";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClass} ${variants[variant]} ${disabledClass}`}
      title={tooltip}
      type="button"
    >
      {active ? onIcon : offIcon || onIcon}
      {hasBadge && (
        <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
      )}
    </button>
  );
}
