import React, { useState } from "react";
import {
  FiX,
  FiMic,
  FiMicOff,
  FiUserMinus,
  FiHeadphones,
  FiEdit2,
} from "react-icons/fi";
import { getAvatarColor, getInitials } from "../../utils/avatarUtils";

export default function ManagementSidebar({
  isOpen,
  onClose,
  participants = [],
  voiceState,
  myRole,
  onKick,
  onSetRole,
  onMuteParticipant,
  onToggleDeafenParticipant,
}) {
  const [activeTab, setActiveTab] = useState("participants");

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out md:w-80 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab("participants")}
              className={`text-sm font-semibold transition-colors ${
                activeTab === "participants"
                  ? "text-slate-900 border-b-2 border-slate-900"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              People ({participants.length})
            </button>

            <button
              onClick={() => setActiveTab("chat")}
              className={`text-sm font-semibold transition-colors ${
                activeTab === "chat"
                  ? "text-slate-900 border-b-2 border-slate-900"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              Chat
            </button>
          </div>

          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-50"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === "participants" ? (
            <div className="space-y-3">
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
                        {d.label || `Microphone (${d.deviceId.slice(0, 6)}…)`}
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
          ) : (
            <div className="flex h-full flex-col justify-end">
              <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
                <p>Chat messages will appear here.</p>
              </div>
              <div className="mt-4 border-t border-slate-100 pt-4">
                <input
                  type="text"
                  placeholder="Type a message..."
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>
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

  // Support both shapes:
  // - participant.voice.{inVoice,micEnabled,deafened}
  // - legacy: participant.isInVoice / participant.isMuted / participant.isDeafened
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
  const isMuted = micKnown ? !micEnabled : false;

  const canModerate = isOwner && !isSelf && inVoice;

  const initial = getInitials(participant.name, participant.id);
  const bg = getAvatarColor(participant.id);
  const statusLabel = inVoice ? "In voice" : "Not in voice";
  const canSelfControl = isSelf && voiceState?.connectionState === "connected";

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

          <div className="text-[10px] uppercase tracking-wider text-slate-400">
            {statusLabel} • {participant.role ?? "participant"}
            {inVoice && (
              <>
                {" "}
                • {deafened ? "deafened" : "hearing"} •{" "}
                {micKnown ? (isMuted ? "mic off" : "mic on") : "mic ?"}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-1">
        {isOwner && !isSelf && (
          <button
            type="button"
            aria-pressed={isEditor}
            onClick={() =>
              onSetRole?.(participant.id, isEditor ? "VIEWER" : "EDITOR")
            }
            title={isEditor ? "Set as viewer" : "Set as editor"}
            className={`rounded-lg p-2 transition-colors ${
              isEditor
                ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            <FiEdit2 size={16} />
          </button>
        )}

        {isSelf && (
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
            className={`rounded-lg p-2 transition-colors ${
              !canSelfControl
                ? "bg-slate-100 text-slate-300 cursor-not-allowed"
                : voiceState?.isMicEnabled
                ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {voiceState?.isMicEnabled ? (
              <FiMic size={16} />
            ) : (
              <FiMicOff size={16} />
            )}
          </button>
        )}

        {isSelf && (
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
            className={`rounded-lg p-2 transition-colors ${
              !canSelfControl
                ? "bg-slate-100 text-slate-300 cursor-not-allowed"
                : voiceState?.isDeafened
                ? "bg-slate-900 text-white hover:bg-slate-800"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <FiHeadphones size={16} />
          </button>
        )}

        {!isSelf && (
          <>
            {/* Mic */}
            {isOwner ? (
              <button
                type="button"
                onClick={() => onMuteParticipant?.(participant.id)}
                disabled={!canModerate || isMuted}
                title={
                  !inVoice
                    ? "User is not in voice"
                    : isMuted
                    ? "Already muted"
                    : "Mute participant"
                }
                className={`rounded-lg p-2 transition-colors ${
                  !canModerate || isMuted
                    ? "bg-slate-100 text-slate-300 cursor-not-allowed"
                    : "bg-rose-50 text-rose-600 hover:bg-rose-100"
                }`}
              >
                <FiMicOff size={16} />
              </button>
            ) : (
              <div
                className={`rounded-lg p-2 ${
                  !inVoice
                    ? "bg-slate-100 text-slate-300"
                    : micKnown && micEnabled
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-100 text-slate-500"
                }`}
                title={
                  !inVoice
                    ? "Not in voice"
                    : micKnown
                    ? micEnabled
                      ? "Mic on"
                      : "Mic off"
                    : "Mic unknown"
                }
              >
                {micKnown && micEnabled ? (
                  <FiMic size={16} />
                ) : (
                  <FiMicOff size={16} />
                )}
              </div>
            )}

            {/* Headphone */}
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
                className={`rounded-lg p-2 transition-colors ${
                  !canModerate
                    ? "bg-slate-100 text-slate-300 cursor-not-allowed"
                    : deafened
                    ? "bg-slate-900 text-white hover:bg-slate-800"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <FiHeadphones size={16} />
              </button>
            ) : (
              <div
                className={`rounded-lg p-2 ${
                  !inVoice
                    ? "bg-slate-100 text-slate-300"
                    : deafened
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-500"
                }`}
                title={
                  !inVoice ? "Not in voice" : deafened ? "Deafened" : "Hearing"
                }
              >
                <FiHeadphones size={16} />
              </div>
            )}
          </>
        )}

        {/* Kick (OWNER only, not self) */}
        {isOwner && !isSelf && (
          <button
            type="button"
            onClick={() => {
              if (!confirm(`Kick ${participant.name}?`)) return;
              onKick?.(participant.id);
            }}
            title="Kick"
            className="rounded-lg p-2 bg-rose-600 text-white hover:bg-rose-700 transition-colors"
          >
            <FiUserMinus size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
