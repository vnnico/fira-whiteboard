// hooks/useWhiteboard.js
import { useEffect, useMemo, useRef, useState } from "react";
import throttle from "lodash.throttle";
import { createWhiteboardSocket } from "../services/socketClient";
import { useAuth } from "./useAuth";
import { useToast } from "./useToast";

const CURSOR_THROTTLE_MS = 50; // 20 FPS or 20 udpates/sec
const CURSOR_MIN_DIST_PX = 10; // gerak <10px tidak perlu dikirim

export function useWhiteboard(roomId) {
  const { token, user } = useAuth();
  const [socket, setSocket] = useState(null);

  const [elements, setElements] = useState([]);
  const [connectionState, setConnectionState] = useState("disconnected");

  // Hydration.
  // States which need to hold the modal until initial data eventually hydrated.
  const [isHydrated, setIsHydrated] = useState(false);
  const gotBoardStateRef = useRef(false);
  const gotMembersRef = useRef(false);
  const gotPermsRef = useRef(false);

  const [locks, setLocks] = useState({}); // elementId -> userId
  const [cursors, setCursors] = useState([]); // [{userId,x,y}]

  // Data state in mid whiteboard
  const [title, setTitle] = useState("Untitled");
  const myUserId = String(user?.id || "");

  const { showToast } = useToast();

  const [role, setRole] = useState("VIEWER");
  const [canEdit, setCanEdit] = useState(false);
  const [locked, setLocked] = useState(false);

  const lastDeniedToastAtRef = useRef(0);

  // Room presence (who is in the room, regardless of voice)
  const [roomMembers, setRoomMembers] = useState([]);

  const [timerState, setTimerState] = useState({
    running: false,
    endAt: null,
    durationMs: null,
    startedBy: null,
  });

  // ------ socket setup ------
  useEffect(() => {
    if (!token || !roomId) return;

    const s = createWhiteboardSocket(token);
    setConnectionState("reconnecting");

    const tryMarkHydrated = () => {
      if (
        gotBoardStateRef.current &&
        gotMembersRef.current &&
        gotPermsRef.current
      ) {
        setIsHydrated(true);
      }
    };

    s.on("connect", () => {
      // reset hydration on every (re)connect
      gotBoardStateRef.current = false;
      gotMembersRef.current = false;
      gotPermsRef.current = false;
      setIsHydrated(false);
      setConnectionState("connected");
      s.emit("join-room", { roomId });
    });

    s.on("timer:action", (p) => {
      window.dispatchEvent(new CustomEvent("wb-timer-action", { detail: p }));
    });

    s.on("timer:state", (payload) => {
      setTimerState({
        running: !!payload?.running,
        endAt: payload?.endAt ?? null,
        durationMs: payload?.durationMs ?? null,
        startedBy: payload?.startedBy ?? null,
      });
    });

    // Session ended by timer
    s.on("session:ended", ({ reason }) => {
      showToast?.("Session ended", "info");

      window.dispatchEvent(
        new CustomEvent("wb-kicked", { detail: { reason: reason || "timer" } })
      );
    });

    // snapshot
    s.on(
      "whiteboard-state",
      ({ elements: initialElements, title, locks: initialLocks }) => {
        setElements(initialElements || []);
        if (typeof title === "string" && title.trim()) setTitle(title);
        if (initialLocks && typeof initialLocks === "object") {
          setLocks(initialLocks);
        }

        gotBoardStateRef.current = true;
        tryMarkHydrated();
      }
    );

    s.on("board-not-found", ({ roomId: notFoundRoomId }) => {
      window.dispatchEvent(
        new CustomEvent("wb-not-found", {
          detail: { roomId: notFoundRoomId || roomId },
        })
      );
    });

    // realtime element update
    s.on("element-update", ({ element }) => {
      if (!element) return;

      setElements((prev) => {
        const idx = prev.findIndex((el) => el.id === element.id);
        if (idx === -1) return [...prev, element];
        const clone = [...prev];
        clone[idx] = element;
        return clone;
      });
    });

    // clear
    s.on("whiteboard-clear", () => {
      setElements([]);
    });

    // cursor
    s.on("cursor-position", ({ userId, x, y }) => {
      if (!userId) return;

      setCursors((prev) => {
        const idx = prev.findIndex((c) => c.userId === userId);
        const next = [...prev];

        const item = {
          userId,
          x,
          y,
        };

        if (idx === -1) next.push(item);
        else next[idx] = item;

        return next;
      });
    });

    // element lock
    s.on("element-lock", ({ elementId, userId, locked }) => {
      if (!elementId || !userId) return;
      setLocks((prev) => {
        const next = { ...prev };
        if (locked) next[elementId] = userId;
        else if (next[elementId] === userId) delete next[elementId];
        return next;
      });
    });

    // remove data on disconnect (cursor + lock)
    s.on("user-disconnected", ({ userId, socketId }) => {
      const ids = new Set([userId, socketId].filter(Boolean).map(String));
      if (ids.size === 0) return;

      setCursors((prev) => prev.filter((c) => !ids.has(String(c.userId))));
      setLocks((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((elId) => {
          if (ids.has(String(next[elId]))) delete next[elId];
        });
        return next;
      });
    });

    // update title in mid whiteboard
    s.on("title-update", ({ title }) => {
      if (typeof title === "string" && title.trim()) setTitle(title);
    });

    // permissions snapshot from server
    s.on("room-permissions", ({ role, canEdit, locked }) => {
      if (role) setRole(role);
      setCanEdit(!!canEdit);
      setLocked(!!locked);

      gotPermsRef.current = true;
      tryMarkHydrated();
    });

    // server-side enforcement feedback
    s.on("permission-denied", ({ message }) => {
      const now = Date.now();
      if (now - lastDeniedToastAtRef.current < 1500) return;
      lastDeniedToastAtRef.current = now;
      showToast?.(message || "No permission", "error");
    });

    // room presence (who is in the room)
    s.on("room-members", ({ members }) => {
      setRoomMembers(Array.isArray(members) ? members : []);

      gotMembersRef.current = true;
      tryMarkHydrated();
    });

    s.on("disconnect", (reason) => {
      if (reason === "io client disconnect") setConnectionState("disconnected");
      else setConnectionState("reconnecting");
    });

    s.on("connect_error", () => {
      setConnectionState("reconnecting");
    });

    s.on("kicked", ({ reason }) => {
      showToast?.(reason || "You were removed by host", "error");
      // Signal to page/UI that we should exit room
      window.dispatchEvent(
        new CustomEvent("wb-kicked", { detail: { reason: reason || "kicked" } })
      );
    });

    setSocket(s);

    return () => {
      s.disconnect();
      setSocket(null);
      setCursors([]);
      setLocks({});
      setRoomMembers([]);
      setConnectionState("disconnected");
      setRole("VIEWER");
      setCanEdit(false);
      setLocked(false);
      setIsHydrated(false);
      setTimerState({
        running: false,
        endAt: null,
        durationMs: null,
        startedBy: null,
      });
    };
  }, [roomId, token]);

  const rawEmitCursor = useRef(null);
  const emitCursorThrottled = useRef(null);
  const lastCursorSentRef = useRef({ x: null, y: null });

  const rawEmitElementUpdate = useRef(null);
  const emitDraftElementUpdate = useRef(null);

  useEffect(() => {
    if (!socket) return;

    rawEmitElementUpdate.current = (payload) => {
      socket.emit("element-update", payload);
    };

    emitDraftElementUpdate.current = throttle(
      (payload) =>
        rawEmitElementUpdate.current && rawEmitElementUpdate.current(payload),
      30,
      { leading: true, trailing: true }
    );

    return () => {
      emitDraftElementUpdate.current && emitDraftElementUpdate.current.cancel();
    };
  }, [socket]);

  useEffect(() => {
    if (!socket) return;

    rawEmitCursor.current = (payload) => {
      socket.emit("cursor-position", payload);
    };

    emitCursorThrottled.current = throttle(
      (payload) => rawEmitCursor.current && rawEmitCursor.current(payload),
      CURSOR_THROTTLE_MS,
      { leading: true, trailing: true }
    );

    return () => {
      if (emitCursorThrottled.current?.cancel)
        emitCursorThrottled.current.cancel();
      rawEmitCursor.current = null;
      emitCursorThrottled.current = null;
      lastCursorSentRef.current = { x: null, y: null };
    };
  }, [socket]);

  const api = useMemo(() => {
    return {
      title,
      elements,
      setElements, // untuk dipakai WhiteboardCanvas (local rendering)
      locks,
      cursors,
      myUserId,
      roomMembers,
      connectionState,
      role,
      canEdit,
      locked,
      isHydrated,
      timerState,

      // mouseMove: kirim draft
      sendDraftElement: (element) => {
        if (!canEdit) return;

        if (!socket || !emitDraftElementUpdate.current) return;
        emitDraftElementUpdate.current({
          element,
          isFinal: false,
        });
      },

      // mouseUp: kirim final
      sendFinalElement: (element) => {
        if (!canEdit) return;

        if (!socket || !rawEmitElementUpdate.current) return;
        if (emitDraftElementUpdate.current) {
          emitDraftElementUpdate.current.cancel(); // pastikan tidak ada draft mengekor
        }
        rawEmitElementUpdate.current({
          element,
          isFinal: true,
        });
      },

      // clear board (opsional flag isFinal di server)
      clearBoard: (isFinal = true) => {
        if (!canEdit) return;

        if (!socket) return;
        socket.emit("whiteboard-clear", { isFinal });
        if (isFinal) setElements([]);
      },

      // send with throttled and distance threshold
      sendCursor: (x, y) => {
        if (!socket) return;
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        if (!emitCursorThrottled.current) return;

        const last = lastCursorSentRef.current;
        if (last.x !== null && last.y !== null) {
          const dx = x - last.x;
          const dy = y - last.y;
          if (dx * dx + dy * dy < CURSOR_MIN_DIST_PX * CURSOR_MIN_DIST_PX) {
            return;
          }
        }

        lastCursorSentRef.current = { x, y };
        emitCursorThrottled.current({ x, y });
      },

      // locking
      lockElement: (elementId) => {
        if (!canEdit) return;

        if (!socket) return;
        socket.emit("element-lock", {
          elementId,
          locked: true,
        });
      },
      unlockElement: (elementId) => {
        if (!canEdit) return;

        if (!socket) return;
        socket.emit("element-lock", { elementId, locked: false }, (ack) => {
          if (ack && !ack.ok) {
          }
        });
      },
      kickUser: (targetUserId) => {
        if (!socket) return;
        socket.emit("moderation:kick", { targetUserId });
      },
      setUserRole: (targetUserId, role) => {
        if (!socket) return;
        socket.emit("moderation:set-role", { targetUserId, role });
      },

      startTimer: (durationMs) => {
        if (!socket) return;
        socket.emit("timer:start", { durationMs });
      },
      stopTimer: () => {
        if (!socket) return;
        socket.emit("timer:stop", {});
      },
      resetTimer: () => {
        if (!socket) return;
        socket.emit("timer:reset", {});
      },
    };
  }, [
    title,
    roomMembers,
    elements,
    locks,
    cursors,
    myUserId,
    socket,
    roomId,
    role,
    canEdit,
    locked,
    timerState,
    connectionState,
    isHydrated,
  ]);

  return api;
}
