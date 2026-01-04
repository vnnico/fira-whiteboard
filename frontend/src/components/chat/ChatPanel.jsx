import { useEffect, useMemo, useRef, useState } from "react";
import { FiArrowDown } from "react-icons/fi";
import { getAvatarColor, getInitials } from "../../utils/avatarUtils";

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatTime(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatDayLabel(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";

  const now = new Date();
  const startOfDay = (x) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round(
    (startOfDay(d) - startOfDay(now)) / (24 * 60 * 60 * 1000)
  );

  if (diffDays === 0) return "Today";
  if (diffDays === -1) return "Yesterday";

  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "2-digit",
    year: now.getFullYear() === d.getFullYear() ? undefined : "numeric",
  }).format(d);
}

function groupByDay(messages) {
  const groups = [];
  const toKey = (ts) => {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return "unknown";
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  };

  let current = null;
  for (const msg of messages || []) {
    const key = toKey(msg.createdAt);
    if (!current || current.key !== key) {
      current = { key, label: formatDayLabel(msg.createdAt), items: [] };
      groups.push(current);
    }
    current.items.push(msg);
  }
  return groups;
}

export default function ChatPanel({
  roomId,
  connectionState,
  messages,
  myUserId,
  typingUsers,
  onSend,
  onTyping,
}) {
  const [text, setText] = useState("");
  const listRef = useRef(null);

  const stickToBottomRef = useRef(true);
  const [showScrollDown, setShowScrollDown] = useState(false);

  const groups = useMemo(() => groupByDay(messages || []), [messages]);
  const canSend = connectionState === "connected";

  const typingNames = useMemo(() => {
    return Object.values(typingUsers || {})
      .map((v) => v?.username)
      .filter(Boolean)
      .slice(0, 3);
  }, [typingUsers]);

  const typingLabel = useMemo(() => {
    if (typingNames.length === 0) return "";
    if (typingNames.length === 1) return `${typingNames[0]} is typing…`;
    if (typingNames.length === 2)
      return `${typingNames[0]} and ${typingNames[1]} are typing…`;
    return `${typingNames[0]}, ${typingNames[1]} and others are typing…`;
  }, [typingNames]);

  const scrollToBottom = (smooth = true) => {
    const el = listRef.current;
    if (!el) return;

    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });

    stickToBottomRef.current = true;
    setShowScrollDown(false);
  };

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const onScroll = () => {
      const threshold = 90;
      const distanceFromBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight;
      const nearBottom = distanceFromBottom < threshold;

      stickToBottomRef.current = nearBottom;
      setShowScrollDown(!nearBottom);
    };

    el.addEventListener("scroll", onScroll);
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    if (stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
      setShowScrollDown(false);
    } else {
      setShowScrollDown(true);
    }
  }, [messages?.length]);

  useEffect(() => {
    setText("");
    stickToBottomRef.current = true;
    setShowScrollDown(false);
    setTimeout(() => scrollToBottom(false), 0);
  }, [roomId]);

  const submit = async (e) => {
    e?.preventDefault();
    if (!canSend) return;

    const value = String(text || "").trim();
    if (!value) return;

    await onSend?.(value);
    setText("");
    onTyping?.(false);

    scrollToBottom(true);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* message list */}
      <div className="relative flex-1 min-h-0">
        <div
          ref={listRef}
          className="no-scrollbar h-full min-h-0 space-y-4 overflow-y-auto pr-1"
        >
          {groups.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              <p>No messages yet. Say hi.</p>
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.key} className="space-y-3">
                <DayPill label={g.label} />
                {g.items.map((m) => (
                  <MessageRow key={m.id} msg={m} myUserId={myUserId} />
                ))}
              </div>
            ))
          )}
        </div>

        {showScrollDown && (
          <button
            type="button"
            onClick={() => scrollToBottom(true)}
            className="absolute bottom-3 right-3 grid h-10 w-10 place-items-center rounded-full bg-white shadow-lg ring-1 ring-slate-200 hover:bg-slate-50"
            title="Scroll to bottom"
          >
            <FiArrowDown className="h-5 w-5 text-slate-700" />
          </button>
        )}
      </div>

      <div className="mt-3 shrink-0 border-t border-slate-100 pt-3">
        {typingLabel && (
          <div className="mb-2 text-xs text-slate-400">{typingLabel}</div>
        )}

        {connectionState !== "connected" && (
          <div className="mb-2 text-xs text-rose-500">
            Chat is not connected. Messages cannot be sent.
          </div>
        )}

        <form onSubmit={submit} className="flex gap-2">
          <input
            value={text}
            disabled={!canSend}
            onChange={(e) => {
              const v = e.target.value;
              setText(v);
              onTyping?.(v.trim().length > 0);
            }}
            onBlur={() => onTyping?.(false)}
            placeholder="Type a message…"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none disabled:opacity-50"
            maxLength={2000}
          />

          <button
            type="submit"
            disabled={!canSend || !text.trim()}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
            title={!canSend ? "Chat disconnected" : "Send"}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

function DayPill({ label }) {
  return (
    <div className="flex justify-center">
      <div className="rounded-full bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-500">
        {label}
      </div>
    </div>
  );
}

function MessageRow({ msg, myUserId }) {
  const isMe = String(msg?.sender?.id || "") === String(myUserId || "");
  const senderName = msg?.sender?.username || "Unknown";

  if (isMe) {
    return <MyMessageRow msg={msg} />;
  }

  return <OtherMessageRow msg={msg} senderName={senderName} />;
}

function OtherMessageRow({ msg, senderName }) {
  return (
    <div className="flex justify-start">
      <div className="flex max-w-[85%] gap-2">
        <div className="pt-1">
          <AvatarPill name={senderName} id={msg?.sender?.id} />
        </div>

        <div className="min-w-0">
          <div className="flex items-center">
            <div className="text-[11px] font-semibold text-slate-500">
              {senderName}
            </div>
          </div>

          <div className="mt-1 rounded-2xl bg-slate-100 px-3 py-2 text-sm leading-relaxed text-slate-800">
            <div className="whitespace-pre-wrap break-words">{msg.text}</div>
          </div>

          <div className="mt-1 text-[10px] text-slate-400">
            {formatTime(msg.createdAt)}
          </div>
        </div>
      </div>
    </div>
  );
}

function MyMessageRow({ msg }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%]">
        <div className="rounded-2xl bg-slate-900 px-3 py-2 text-sm leading-relaxed text-white">
          <div className="whitespace-pre-wrap break-words">{msg.text}</div>
        </div>

        <div className="mt-1 flex items-center justify-end gap-2 text-[10px] text-slate-400">
          <span>{formatTime(msg.createdAt)}</span>
          {msg.status === "sending" && <span>Sending…</span>}
          {msg.status === "error" && (
            <span className="text-rose-500">Failed</span>
          )}
        </div>
      </div>
    </div>
  );
}

function AvatarPill({ name, id }) {
  const bg = getAvatarColor(id || name);
  const initials = getInitials(name, id || name);

  return (
    <div
      className="h-8 w-8 shrink-0 rounded-full grid place-items-center text-[10px] font-extrabold text-white"
      title={name}
      style={{ background: bg }}
    >
      {initials}
    </div>
  );
}
