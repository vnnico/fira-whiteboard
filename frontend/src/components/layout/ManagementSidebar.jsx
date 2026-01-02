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
import ChatPanel from "../chat/ChatPanel";

const formatDeviceLabel = (d) => {
  const raw = String(d?.label || "").trim();
  const fallback = `Microphone (${String(d?.deviceId || "").slice(0, 6)}…)`;

  if (!raw) return fallback;

  const max = 48;
  if (raw.length <= max) return raw;

  return raw.slice(0, max - 1) + "…";
};

function controlButtonClass(variant = "secondary", disabled = false) {
  const base =
    "relative flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200 focus:outline-none";

  const variants = {
    dark: "bg-slate-800 text-white hover:bg-slate-900",
    secondary: "bg-slate-100 text-slate-600 hover:bg-slate-200",
    danger: "bg-rose-50 text-rose-500 hover:bg-rose-100",
    "danger-ghost": "text-rose-500 hover:bg-rose-50 hover:text-rose-600",
    success: "bg-emerald-500 text-white hover:bg-emerald-600",
  };

  const cls = `${base} ${variants[variant] || variants.secondary}`;
  return disabled ? `${cls} opacity-40 cursor-not-allowed` : cls;
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
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold tracking-wide text-slate-500">
            {String(participant.role || "VIEWER").toUpperCase()}
          </span>
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
            className={controlButtonClass(
              isEditor ? "dark" : "secondary",
              false
            )}
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
            className={controlButtonClass(
              !canSelfControl
                ? "secondary"
                : voiceState?.isMicEnabled
                ? "dark"
                : "danger",
              !canSelfControl
            )}
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
            className={controlButtonClass("secondary", !canSelfControl)}
          >
            <FiHeadphones
              className={voiceState?.isDeafened ? "opacity-40" : ""}
              size={16}
            />
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
                className={controlButtonClass(
                  "danger",
                  !canModerate || isMuted
                )}
              >
                <FiMicOff size={16} />
              </button>
            ) : (
              <div
                className={controlButtonClass(
                  !inVoice
                    ? "secondary"
                    : micKnown && micEnabled
                    ? "secondary"
                    : "danger",
                  true
                )}
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
                className={controlButtonClass("secondary", !canModerate)}
              >
                <FiHeadphones
                  className={deafened ? "opacity-40" : ""}
                  size={16}
                />
              </button>
            ) : (
              <div
                className={controlButtonClass("secondary", true)}
                title={
                  !inVoice ? "Not in voice" : deafened ? "Deafened" : "Hearing"
                }
              >
                <FiHeadphones
                  className={deafened ? "opacity-40" : ""}
                  size={16}
                />
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
            className={controlButtonClass("danger-ghost", false)}
          >
            <FiUserMinus size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
