import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createChatSocket } from "../services/socketClient";
import { useAuth } from "./useAuth";

function makeLocalTempId() {
  const rnd = Math.floor(Math.random() * 1e9);
  return `tmp-${Date.now()}-${rnd}`;
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
    createdAt: raw.createdAt || null,
    status: "sent",
  };
}

function replaceOptimisticById(prev, localId, serverMsg, myUserId) {
  if (!serverMsg) return null;

  const idx = prev.findIndex((m) => String(m.id) === String(localId));
  if (idx < 0) return null;

  const mine = String(prev[idx]?.sender?.id || "") === String(myUserId || "");
  if (!mine) return null;
  if (prev[idx]?.status !== "sending") return null;

  const clone = [...prev];
  clone[idx] = { ...serverMsg, status: "sent" };
  return clone;
}

function reconcileLastSendingSameText(prev, serverMsg, myUserId) {
  if (!serverMsg) return null;

  const isMe = String(serverMsg?.sender?.id || "") === String(myUserId || "");
  if (!isMe) return null;

  for (let i = prev.length - 1; i >= 0; i--) {
    const m = prev[i];
    const mine = String(m?.sender?.id || "") === String(myUserId || "");
    if (mine && m.status === "sending" && m.text === serverMsg.text) {
      const clone = [...prev];
      clone[i] = { ...serverMsg, status: "sent" };
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
        const fixed = reconcileLastSendingSameText(prev, msg, myUserId);
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
        // BE: tidak perlu roomId
        s.emit("chat:typing", { typing: false });
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
        if (next) {
          if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
          typingTimerRef.current = setTimeout(() => {
            typingActiveRef.current = false;
            socket.emit("chat:typing", { typing: false });
          }, 1400);
        }
        return;
      }

      typingActiveRef.current = next;
      socket.emit("chat:typing", { typing: next });

      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);

      if (next) {
        typingTimerRef.current = setTimeout(() => {
          typingActiveRef.current = false;
          socket.emit("chat:typing", { typing: false });
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

      const localId = makeLocalTempId();

      const optimistic = {
        id: localId,
        roomId: String(roomId || ""),
        text: clean,
        sender: { id: myUserId, username: String(user?.username || "Me") },
        createdAt: new Date().toISOString(),
        status: "sending",
      };

      setMessages((prev) => upsertMessage(prev, optimistic));
      setTyping(false);

      return new Promise((resolve) => {
        // BE: rid diambil dari socket.data, payload cukup text
        socket.emit("chat:send", { text: clean }, (res) => {
          if (!res?.ok) {
            setMessages((prev) =>
              prev.map((m) =>
                String(m.id) === String(localId) ? { ...m, status: "error" } : m
              )
            );
            resolve({ ok: false, code: res?.code || "send-failed" });
            return;
          }

          const serverMsg = mapServerMessage(res.message);

          setMessages((prev) => {
            if (!serverMsg) {
              return prev.map((m) =>
                String(m.id) === String(localId) ? { ...m, status: "sent" } : m
              );
            }

            const fixedById = replaceOptimisticById(
              prev,
              localId,
              serverMsg,
              myUserId
            );
            if (fixedById) return fixedById;

            const fixedByText = reconcileLastSendingSameText(
              prev,
              serverMsg,
              myUserId
            );
            if (fixedByText) return fixedByText;

            return upsertMessage(prev, serverMsg);
          });

          resolve({ ok: true });
        });
      });
    },
    [socket, connectionState, roomId, myUserId, user?.username, setTyping]
  );

  return useMemo(
    () => ({
      connectionState,
      messages,
      isHistoryLoaded,
      typingUsers,
      sendMessage,
      setTyping,
    }),
    [
      connectionState,
      messages,
      isHistoryLoaded,
      typingUsers,
      sendMessage,
      setTyping,
    ]
  );
}
