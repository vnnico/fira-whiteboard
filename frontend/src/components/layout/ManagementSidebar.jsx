import React, { useState } from "react";
import {
  FiX,
  FiMic,
  FiMicOff,
  FiUserMinus,
  FiMoreVertical,
} from "react-icons/fi";

export default function ManagementSidebar({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState("participants");
  const participants = [
    {
      id: 1,
      name: "You (Host)",
      isMe: true,
      isSpeaking: false,
      isMuted: true,
      role: "admin",
    },
    {
      id: 2,
      name: "Siska",
      isMe: false,
      isSpeaking: true,
      isMuted: false,
      role: "editor",
    },
    {
      id: 3,
      name: "Joko",
      isMe: false,
      isSpeaking: false,
      isMuted: false,
      role: "viewer",
    },
  ];

  return (
    <>
      {/* Backdrop Mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out md:w-80 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === "participants" ? (
            <div className="space-y-3">
              {participants.map((p) => (
                <ParticipantCard key={p.id} participant={p} />
              ))}
            </div>
          ) : (
            <div className="flex h-full flex-col justify-end">
              <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
                <p>Chat messages will appear here.</p>
              </div>
              {/* Chat Input */}
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

function ParticipantCard({ participant }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-100 p-3 transition-colors hover:bg-slate-50">
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm ${
            participant.isSpeaking
              ? "bg-emerald-500 ring-2 ring-emerald-200"
              : "bg-slate-400"
          }`}
        >
          {participant.name.charAt(0)}
        </div>
        <div>
          <div className="text-sm font-medium text-slate-900">
            {participant.name}
            {participant.isMe && (
              <span className="ml-2 text-xs text-slate-400">(You)</span>
            )}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400">
            {participant.role}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-1">
        <button
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
            className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500"
            title="Kick"
          >
            <FiUserMinus size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
