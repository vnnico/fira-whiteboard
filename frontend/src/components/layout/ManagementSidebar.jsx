import React from "react";
import {
  FiX,
  FiMic,
  FiMicOff,
  FiUserMinus,
  FiHeadphones,
  FiEdit2,
} from "react-icons/fi";
import { getAvatarColor, getInitials } from "../../utils/avatarUtils";
import ChatPanel from "../chat/ChatPanel";

const formatDeviceLabel = (d) => {
  const raw = String(d?.label || "").trim();
  const fallback = `Microphone (${String(d?.deviceId || "").slice(0, 6)}…)`;

  if (!raw) return fallback;

  const max = 48;
  if (raw.length <= max) return raw;

  return raw.slice(0, max - 1) + "…";
};

function SlashedIcon({
  children,
  slashClassName = "bg-rose-500/90",
  slashHeightClass = "h-6",
  slashWidthClass = "w-[2px]",
}) {
  return (
    <span className="relative inline-flex">
      {children}
      <span
        className={[
          "pointer-events-none absolute left-1/2 top-1/2",
          "-translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full",
          slashHeightClass,
          slashWidthClass,
          slashClassName,
        ].join(" ")}
      />
    </span>
  );
}

function controlButtonClass(
  variant = "surface",
  disabled = false,
  readOnly = false
) {
  const base =
    "relative flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200 focus:outline-none";

  const variants = {
    surface:
      "bg-white text-slate-700 ring-1 ring-slate-900/10 hover:bg-slate-50",
    "danger-ghost": "text-rose-500 hover:bg-rose-50 hover:text-rose-600",
  };

  let cls = `${base} ${variants[variant] || variants.surface}`;
  if (readOnly) cls += " cursor-default";
  if (disabled) cls += " opacity-40 cursor-not-allowed hover:bg-inherit";
  return cls;
}

export default function ManagementSidebar({
  isOpen,
  onClose,
  activeTab = "participants",
  participants = [],
  voiceState,
  myRole,
  onKick,
  onTabChange,
  onSetRole,
  onMuteParticipant,
  onToggleDeafenParticipant,
  chatState,
  roomId,
  myUserId,
}) {
  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20  md:bg-black/10 md:backdrop-blur-0"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out sm:w-[360px] md:w-[420px] ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
          <div className="flex gap-4">
            <button
              onClick={() => onTabChange?.("participants")}
              className={`text-sm font-semibold transition-colors ${
                activeTab === "participants"
                  ? "text-slate-900 border-b-2 border-slate-900"
                  : "text-slate-400 hover:text-slate-600"
              }`}
              type="button"
            >
              People ({participants.length})
            </button>

            <button
              onClick={() => onTabChange?.("chat")}
              className={`text-sm font-semibold transition-colors ${
                activeTab === "chat"
                  ? "text-slate-900 border-b-2 border-slate-900"
                  : "text-slate-400 hover:text-slate-600"
              }`}
              type="button"
            >
              Chat
            </button>
          </div>

          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-50"
            type="button"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto ">
          {activeTab === "participants" ? (
            <div className="h-full overflow-y-auto p-3">
              <div className="space-y-2.5">
                {voiceState?.connectionState === "connected" && (
                  <div className="rounded-xl border border-slate-100 bg-white p-3">
                    <div className="mb-2 text-xs font-semibold text-slate-500">
                      Microphone
                    </div>

                    <select
                      value={voiceState.selectedAudioInputId || "default"}
                      onChange={(e) =>
                        voiceState.selectAudioInput?.(e.target.value)
                      }
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="default">Default</option>
                      {(voiceState.audioInputs || []).map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {formatDeviceLabel(d)}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => voiceState.refreshDevices?.()}
                      className="mt-2 text-xs text-slate-500 hover:text-slate-700"
                    >
                      Refresh device list
                    </button>
                  </div>
                )}

                {participants.map((p) => (
                  <ParticipantCard
                    key={p.id}
                    participant={p}
                    myRole={myRole}
                    voiceState={voiceState}
                    onKick={onKick}
                    onSetRole={onSetRole}
                    onMuteParticipant={onMuteParticipant}
                    onToggleDeafenParticipant={onToggleDeafenParticipant}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="h-full min-h-0 overflow-hidden p-3">
              <ChatPanel
                roomId={roomId}
                connectionState={chatState?.connectionState}
                messages={chatState?.messages || []}
                myUserId={myUserId}
                typingUsers={chatState?.typingUsers || {}}
                onSend={(t) => chatState?.sendMessage?.(t)}
                onTyping={(v) => chatState?.setTyping?.(v)}
              />
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function ParticipantCard({
  participant,
  myRole,
  voiceState,
  onKick,
  onSetRole,
  onMuteParticipant,
  onToggleDeafenParticipant,
}) {
  const isOwner = myRole === "OWNER";
  const isSelf = !!participant.isMe;
  const isEditor = String(participant.role || "VIEWER") === "EDITOR";

  // voice snapshot
  const v = participant.voice || {};
  const inVoice =
    typeof v.inVoice === "boolean" ? v.inVoice : !!participant.isInVoice;

  const deafened =
    typeof v.deafened === "boolean" ? v.deafened : !!participant.isDeafened;

  const micEnabled =
    typeof v.micEnabled === "boolean"
      ? v.micEnabled
      : typeof participant.isMuted === "boolean"
      ? !participant.isMuted
      : undefined;

  const micKnown = typeof micEnabled === "boolean";

  const micIsOn = micKnown ? micEnabled : true;
  const micIsOff = !micIsOn;

  const canModerate = isOwner && !isSelf && inVoice;
  const canSelfControl = isSelf && voiceState?.connectionState === "connected";

  const initial = getInitials(participant.name, participant.id);
  const bg = getAvatarColor(participant.id);

  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-100 p-3 transition-colors hover:bg-slate-50">
      <div className="flex items-center gap-3">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-extrabold text-white shadow-sm"
          title={participant.name}
          style={{
            background: bg,
            boxShadow: participant.isSpeaking
              ? "0 0 0 2px rgba(16,185,129,0.35), 0 6px 18px rgba(0,0,0,0.12)"
              : "0 6px 18px rgba(0,0,0,0.10)",
          }}
        >
          {initial}
        </div>

        <div>
          <div className="text-sm font-medium text-slate-900">
            {participant.name}
            {isSelf && (
              <span className="ml-2 text-xs text-slate-400">(You)</span>
            )}
          </div>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold tracking-wide text-slate-500">
            {String(participant.role || "VIEWER").toUpperCase()}
          </span>
        </div>
      </div>

      <div className="flex gap-1">
        {isSelf && (
          <>
            <button
              type="button"
              onClick={() => voiceState?.toggleMic?.()}
              disabled={!canSelfControl}
              title={
                !canSelfControl
                  ? "You are not connected to voice"
                  : voiceState?.isMicEnabled
                  ? "Turn mic off"
                  : "Turn mic on"
              }
              className={controlButtonClass("surface", !canSelfControl)}
            >
              {voiceState?.isMicEnabled ? (
                <FiMic size={16} className="text-slate-700" />
              ) : (
                <SlashedIcon
                  slashClassName="bg-rose-500/90"
                  rotateClass="rotate-45"
                  slashHeightClass="h-5"
                >
                  <FiMic size={16} className="text-rose-500/90" />
                </SlashedIcon>
              )}
            </button>

            <button
              type="button"
              onClick={() => voiceState?.toggleDeafen?.()}
              disabled={!canSelfControl}
              title={
                !canSelfControl
                  ? "You are not connected to voice"
                  : voiceState?.isDeafened
                  ? "Undeafen"
                  : "Deafen"
              }
              className={controlButtonClass("surface", !canSelfControl)}
            >
              {voiceState?.isDeafened ? (
                <SlashedIcon>
                  <FiHeadphones size={16} className="text-rose-500/90" />
                </SlashedIcon>
              ) : (
                <FiHeadphones size={16} className="text-slate-700" />
              )}
            </button>
          </>
        )}

        {isOwner && !isSelf && (
          <button
            type="button"
            aria-pressed={isEditor}
            onClick={() =>
              onSetRole?.(participant.id, isEditor ? "VIEWER" : "EDITOR")
            }
            title={isEditor ? "Set as viewer" : "Set as editor"}
            className={controlButtonClass("surface", false)}
          >
            <FiEdit2 size={16} className={isEditor ? "text-emerald-600" : ""} />
          </button>
        )}

        {isOwner && !isSelf && (
          <button
            type="button"
            onClick={() => {
              if (!confirm(`Kick ${participant.name}?`)) return;
              onKick?.(participant.id);
            }}
            title="Kick"
            className={controlButtonClass("danger-ghost", false)}
          >
            <FiUserMinus size={16} />
          </button>
        )}

        {/* OTHER PARTICIPANTS */}
        {!isSelf && (
          <>
            {isOwner ? (
              <button
                type="button"
                onClick={() => onMuteParticipant?.(participant.id)}
                disabled={!canModerate || micIsOff}
                title={
                  !inVoice
                    ? "User is not in voice"
                    : micIsOff
                    ? "Already muted"
                    : "Mute participant"
                }
                className={controlButtonClass(
                  "surface",
                  !canModerate || micIsOff
                )}
              >
                {micIsOn ? (
                  <FiMic size={16} className="text-slate-700" />
                ) : (
                  <SlashedIcon
                    slashClassName="bg-rose-500/90"
                    rotateClass="rotate-45"
                    slashHeightClass="h-5"
                  >
                    <FiMic size={16} className="text-rose-500/90" />
                  </SlashedIcon>
                )}
              </button>
            ) : (
              <div
                className={controlButtonClass("surface", false, true)}
                title={
                  !inVoice ? "Not in voice" : micIsOn ? "Mic on" : "Mic off"
                }
              >
                {micIsOn ? (
                  <FiMic size={16} className="text-slate-700" />
                ) : (
                  <SlashedIcon
                    slashClassName="bg-rose-500/90"
                    rotateClass="rotate-45"
                    slashHeightClass="h-5"
                  >
                    <FiMic size={16} className="text-rose-500/90" />
                  </SlashedIcon>
                )}
              </div>
            )}

            {isOwner ? (
              <button
                type="button"
                onClick={() =>
                  onToggleDeafenParticipant?.(participant.id, !deafened)
                }
                disabled={!canModerate}
                title={
                  !inVoice
                    ? "User is not in voice"
                    : deafened
                    ? "Undeafen"
                    : "Deafen"
                }
                className={controlButtonClass("surface", !canModerate)}
              >
                {deafened ? (
                  <SlashedIcon
                    slashClassName="bg-rose-500/90"
                    rotateClass="rotate-45"
                    slashHeightClass="h-5"
                  >
                    <FiHeadphones size={16} className="text-rose-500/90" />
                  </SlashedIcon>
                ) : (
                  <FiHeadphones size={16} className="text-slate-700" />
                )}
              </button>
            ) : (
              <div
                className={controlButtonClass("surface", false, true)}
                title={
                  !inVoice ? "Not in voice" : deafened ? "Deafened" : "Hearing"
                }
              >
                {deafened ? (
                  <SlashedIcon
                    slashClassName="bg-rose-500/90"
                    rotateClass="rotate-45"
                    slashHeightClass="h-5"
                  >
                    <FiHeadphones size={16} className="text-rose-500/90" />
                  </SlashedIcon>
                ) : (
                  <FiHeadphones size={16} className="text-slate-700" />
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
