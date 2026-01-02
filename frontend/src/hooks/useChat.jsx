import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createChatSocket } from "../services/socketClient";
import { useAuth } from "./useAuth";

function makeClientMessageId() {
  const rnd = Math.floor(Math.random() * 1e9);
  return `${Date.now()}-${rnd}`;
}

function mapServerMessage(raw) {
  if (!raw) return null;

  const id = raw.id || raw._id;
  if (!id) return null;

  const senderId = raw?.sender?.id || raw.senderId;
  const senderUsername =
    raw?.sender?.username || raw.senderUsername || "Unknown";

  return {
    id: String(id),
    roomId: String(raw.roomId || ""),
    text: String(raw.text || ""),
    sender: {
      id: String(senderId || ""),
      username: String(senderUsername),
    },
    clientMessageId: raw.clientMessageId ? String(raw.clientMessageId) : null,
    createdAt: raw.createdAt || null,
    status: "sent",
  };
}

function reconcileSelfMessage(prev, msg, myUserId) {
  if (!msg) return null;

  const isMe = String(msg?.sender?.id || "") === String(myUserId || "");
  if (!isMe) return null;

  // match by clientMessageId
  if (msg.clientMessageId) {
    const idx = prev.findIndex(
      (m) => m.clientMessageId && m.clientMessageId === msg.clientMessageId
    );
    if (idx >= 0) {
      const clone = [...prev];
      clone[idx] = { ...clone[idx], ...msg, status: "sent" };
      return clone;
    }
  }

  // Fallback: last "sending" from me with same text (handles missing clientMessageId)
  for (let i = prev.length - 1; i >= 0; i--) {
    const m = prev[i];
    const mine = String(m?.sender?.id || "") === String(myUserId || "");
    if (mine && m.status === "sending" && m.text === msg.text) {
      const clone = [...prev];
      clone[i] = { ...m, ...msg, status: "sent" };
      return clone;
    }
  }

  return null;
}

function upsertMessage(prev, nextMsg) {
  if (!nextMsg) return prev;

  const byId = nextMsg.id ? prev.findIndex((m) => m.id === nextMsg.id) : -1;
  if (byId >= 0) {
    const clone = [...prev];
    clone[byId] = {
      ...clone[byId],
      ...nextMsg,
      status: nextMsg.status || "sent",
    };
    return clone;
  }

  if (nextMsg.clientMessageId) {
    const byClientId = prev.findIndex(
      (m) => m.clientMessageId && m.clientMessageId === nextMsg.clientMessageId
    );
    if (byClientId >= 0) {
      const clone = [...prev];
      clone[byClientId] = {
        ...clone[byClientId],
        ...nextMsg,
        status: nextMsg.status || "sent",
      };
      return clone;
    }
  }

  return [...prev, nextMsg];
}

export function useChat(roomId) {
  const { token, user } = useAuth();

  const [socket, setSocket] = useState(null);
  const [connectionState, setConnectionState] = useState("disconnected");

  const [messages, setMessages] = useState([]);
  const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);

  const [typingUsers, setTypingUsers] = useState({});

  const myUserId = String(user?.id || "");

  const typingTimerRef = useRef(null);
  const typingActiveRef = useRef(false);

  useEffect(() => {
    if (!token || !roomId) return;

    const s = createChatSocket(token);
    setConnectionState("reconnecting");

    s.on("connect", () => {
      setConnectionState("connected");
      setIsHistoryLoaded(false);
      setTypingUsers({});
      s.emit("join-room", { roomId: String(roomId) });
    });

    s.on("disconnect", (reason) => {
      if (reason === "io client disconnect") setConnectionState("disconnected");
      else setConnectionState("reconnecting");
    });

    s.on("connect_error", () => {
      setConnectionState("reconnecting");
    });

    s.on("chat:history", ({ messages: history }) => {
      const next = (Array.isArray(history) ? history : [])
        .map(mapServerMessage)
        .filter(Boolean);

      setMessages(next);
      setIsHistoryLoaded(true);
    });

    s.on("chat:message", (raw) => {
      const msg = mapServerMessage(raw);
      if (!msg) return;
      setMessages((prev) => {
        const fixed = reconcileSelfMessage(prev, msg, myUserId);
        if (fixed) return fixed;
        return upsertMessage(prev, msg);
      });
    });

    s.on("chat:typing", ({ userId, username, typing, ts }) => {
      const uid = String(userId || "");
      if (!uid || uid === myUserId) return;

      setTypingUsers((prev) => {
        const next = { ...prev };
        if (typing)
          next[uid] = { username: username || "Unknown", ts: ts || Date.now() };
        else delete next[uid];
        return next;
      });
    });

    const pruneInterval = setInterval(() => {
      setTypingUsers((prev) => {
        const now = Date.now();
        const next = {};
        Object.entries(prev || {}).forEach(([uid, v]) => {
          if (now - (v?.ts || 0) <= 9000) next[uid] = v;
        });
        return next;
      });
    }, 2500);

    setSocket(s);

    return () => {
      clearInterval(pruneInterval);

      try {
        s.emit("chat:typing", { roomId: String(roomId), typing: false });
      } catch {}

      s.disconnect();
      setSocket(null);
      setMessages([]);
      setTypingUsers({});
      setIsHistoryLoaded(false);
      setConnectionState("disconnected");
    };
  }, [token, roomId, myUserId]);

  const setTyping = useCallback(
    (isTyping) => {
      if (!socket || !roomId) return;
      if (connectionState !== "connected") return;

      const next = !!isTyping;

      if (next === typingActiveRef.current) {
        // refresh timer if still typing
        if (next) {
          if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
          typingTimerRef.current = setTimeout(() => {
            typingActiveRef.current = false;
            socket.emit("chat:typing", {
              roomId: String(roomId),
              typing: false,
            });
          }, 1400);
        }
        return;
      }

      typingActiveRef.current = next;
      socket.emit("chat:typing", { roomId: String(roomId), typing: next });

      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);

      if (next) {
        typingTimerRef.current = setTimeout(() => {
          typingActiveRef.current = false;
          socket.emit("chat:typing", { roomId: String(roomId), typing: false });
        }, 1400);
      }
    },
    [socket, roomId, connectionState]
  );

  const sendMessage = useCallback(
    async (text) => {
      const clean = String(text || "").trim();
      if (!clean) return { ok: false, code: "empty" };

      if (!socket || connectionState !== "connected") {
        return { ok: false, code: "offline" };
      }

      const clientMessageId = makeClientMessageId();

      const optimistic = {
        id: clientMessageId, // temporary
        roomId: String(roomId || ""),
        text: clean,
        sender: { id: myUserId, username: String(user?.username || "Me") },
        clientMessageId,
        createdAt: new Date().toISOString(),
        status: "sending",
      };

      setMessages((prev) => upsertMessage(prev, optimistic));
      setTyping(false);

      return new Promise((resolve) => {
        socket.emit(
          "chat:send",
          { roomId: String(roomId), text: clean, clientMessageId },
          (res) => {
            if (!res?.ok) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.clientMessageId === clientMessageId
                    ? { ...m, status: "error" }
                    : m
                )
              );
              resolve({ ok: false, code: res?.code || "send-failed" });
              return;
            }

            const serverMsg = mapServerMessage(res.message);

            setMessages((prev) => {
              if (!serverMsg) {
                //mark as sent if server does not send message object
                return prev.map((m) =>
                  m.clientMessageId === clientMessageId
                    ? { ...m, status: "sent" }
                    : m
                );
              }

              const fixed = reconcileSelfMessage(prev, serverMsg, myUserId);
              if (fixed) return fixed;

              return upsertMessage(prev, serverMsg);
            });

            resolve({ ok: true });
          }
        );
      });
    },
    [socket, connectionState, roomId, myUserId, user?.username, setTyping]
  );

  return useMemo(() => {
    return {
      connectionState,
      messages,
      isHistoryLoaded,
      typingUsers,
      sendMessage,
      setTyping,
    };
  }, [
    connectionState,
    messages,
    isHistoryLoaded,
    typingUsers,
    sendMessage,
    setTyping,
  ]);
}
