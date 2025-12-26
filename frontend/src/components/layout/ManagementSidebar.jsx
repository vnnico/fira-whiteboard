import React, { useState } from "react";
import { FiX, FiMic, FiMicOff, FiUserMinus } from "react-icons/fi";
import { getAvatarColor, getInitials } from "../../utils/avatarUtils";

export default function ManagementSidebar({
  isOpen,
  onClose,
  participants = [],
  voiceState,
  myRole,
  onKick,
  onSetRole,
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
                    value={voiceState.selectedAudioInputId || ""}
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
                  onKick={onKick}
                  onSetRole={onSetRole}
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

function ParticipantCard({ participant, myRole, onKick, onSetRole }) {
  const initial = getInitials(participant.name, participant.id);
  const bg = getAvatarColor(participant.id);
  const statusLabel = participant.isInVoice ? "In voice" : "Not in voice";

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
            {participant.isMe && (
              <span className="ml-2 text-xs text-slate-400">(You)</span>
            )}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400">
            {statusLabel} • {participant.role ?? "participant"}
          </div>
        </div>
      </div>

      <div className="flex gap-1">
        {myRole === "OWNER" && !participant.isMe && (
          <select
            value={participant.role || "VIEWER"}
            onChange={(e) => onSetRole?.(participant.id, e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
          >
            <option value="VIEWER">VIEWER</option>
            <option value="EDITOR">EDITOR</option>
          </select>
        )}

        {myRole === "OWNER" && !participant.isMe && (
          <button
            className="rounded-md bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700"
            onClick={() => {
              if (!confirm(`Kick ${participant.name}?`)) return;
              // Emit via whiteboard socket (butuh akses)
              onKick?.(participant.id);
            }}
          >
            Kick
          </button>
        )}

        <button
          disabled
          title="(Coming Soon)"
          className={`rounded p-1.5 ${
            participant.isMuted
              ? "bg-rose-50 text-rose-500"
              : "text-slate-400 hover:bg-slate-200"
          }`}
        >
          {participant.isMuted ? <FiMicOff size={14} /> : <FiMic size={14} />}
        </button>

        {!participant.isMe && (
          <button
            disabled
            className="rounded p-1.5 text-slate-300 cursor-not-allowed"
            title="(Coming Soon)"
          >
            <FiUserMinus size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
