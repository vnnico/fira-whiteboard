// hooks/useWhiteboard.js
import { useEffect, useMemo, useRef, useState } from "react";
import throttle from "lodash.throttle";
import { createWhiteboardSocket } from "../services/socketClient";
import { useAuth } from "./useAuth";

export function useWhiteboard(roomId) {
  const { token, user } = useAuth();
  const [socket, setSocket] = useState(null);

  const [elements, setElements] = useState([]);
  const [locks, setLocks] = useState({}); // elementId -> userId
  const [cursors, setCursors] = useState([]); // [{userId,x,y}]

  // Data state in mid whiteboard
  const [title, setTitle] = useState("Untitled");
  const myUserId = user?.id || "anon";

  // ------ socket setup ------
  useEffect(() => {
    if (!token || !roomId) return;

    const s = createWhiteboardSocket(token);

    s.on("connect", () => {
      s.emit("join-room", { roomId });
    });

    // snapshot
    s.on("whiteboard-state", ({ elements: initialElements, title }) => {
      setElements(initialElements || []);
      if (typeof title === "string" && title.trim()) setTitle(title);
    });

    // realtime element update
    s.on("element-update", ({ element }) => {
      if (!element) return;

      console.log(element);
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
      setCursors((prev) => {
        const idx = prev.findIndex((c) => c.userId === userId);
        const next = [...prev];
        if (idx === -1) next.push({ userId, x, y });
        else next[idx] = { userId, x, y };
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
    s.on("user-disconnected", ({ userId }) => {
      setCursors((prev) => prev.filter((c) => c.userId !== userId));
      setLocks((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((elId) => {
          if (next[elId] === userId) delete next[elId];
        });
        return next;
      });
    });

    // update title in mid whiteboard
    s.on("title-update", ({ title }) => {
      if (typeof title === "string" && title.trim()) setTitle(title);
    });

    setSocket(s);

    return () => {
      s.disconnect();
      setSocket(null);
      setCursors([]);
      setLocks({});
    };
  }, [roomId, token]);

  // ------ emit helpers (draft + final + lock + cursor) ------

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
  }, [socket, roomId]);

  const api = useMemo(() => {
    return {
      title,
      elements,
      setElements, // untuk dipakai WhiteboardCanvas (local rendering)
      locks,
      cursors,
      myUserId,

      // mouseMove: kirim draft
      sendDraftElement: (element) => {
        if (!socket || !emitDraftElementUpdate.current) return;
        emitDraftElementUpdate.current({
          roomId,
          element,
          isFinal: false,
        });
      },

      // mouseUp: kirim final
      sendFinalElement: (element) => {
        if (!socket || !rawEmitElementUpdate.current) return;
        if (emitDraftElementUpdate.current) {
          emitDraftElementUpdate.current.cancel(); // pastikan tidak ada draft mengekor
        }
        rawEmitElementUpdate.current({
          roomId,
          element,
          isFinal: true,
        });
      },

      // clear board (opsional flag isFinal di server)
      clearBoard: (isFinal = true) => {
        if (!socket) return;
        socket.emit("whiteboard-clear", { roomId, isFinal });
        if (isFinal) setElements([]);
      },

      // cursor
      sendCursor: (x, y) => {
        if (!socket) return;
        socket.emit("cursor-position", { roomId, x, y });
      },

      // locking
      lockElement: (elementId) => {
        if (!socket) return;
        socket.emit("element-lock", {
          roomId,
          elementId,
          userId: myUserId,
          locked: true,
        });
        // local optimistik
        setLocks((prev) => ({ ...prev, [elementId]: myUserId }));
      },
      unlockElement: (elementId) => {
        if (!socket) return;
        socket.emit("element-lock", {
          roomId,
          elementId,
          userId: myUserId,
          locked: false,
        });
        setLocks((prev) => {
          const next = { ...prev };
          if (next[elementId] === myUserId) delete next[elementId];
          return next;
        });
      },
    };
  }, [elements, locks, cursors, myUserId, socket, roomId]);

  return api;
}
