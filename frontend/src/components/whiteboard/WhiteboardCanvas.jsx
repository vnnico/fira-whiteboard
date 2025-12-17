import { useState, useRef, useEffect, useCallback } from "react";
import { WhiteboardShell } from "./WhiteboardShell";
import {
  FiChevronLeft,
  FiChevronRight,
  FiMic,
  FiMessageSquare,
} from "react-icons/fi";

import { useWhiteboard } from "../../hooks/useWhiteboard";
import {
  ToolTypes,
  ActionTypes,
  CursorPosition,
} from "../../constant/constants";

import { createElement } from "../../utils/createElement";
import { adjustElementCoordinates } from "../../utils/adjustElementCoordinates";
import { drawElements } from "../../utils/drawElement";
import { getElementAtPosition } from "../../utils/getElementByPosition";
import { getResizedCoordinates } from "../../utils/getResizedCoordinates";
import { updateElement } from "../../utils/updateElement";
import { getCursorForPosition } from "../../utils/getCursorForPosition";

import CursorOverlay from "./CursorOverlay";
import { useToast } from "../../hooks/useToast";
import { useNavigate } from "react-router-dom";

import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";

import {
  drawSelectionOverlay,
  getElementBounds,
} from "../../utils/drawSelectionOverlay";
import { getSelectionHitPosition } from "../../utils/getSelectionHitPosition";
import { useElementSelection } from "../../hooks/useElementSelection";

const CANVAS_SIZE = 8000;
const CLIPBOARD_OFFSET = 20;

export default function WhiteboardCanvas({
  roomId,
  onTitleChange,
  onMembersChange,
  onWhiteboardApi,
}) {
  const {
    title,
    elements,
    setElements,
    locks,
    cursors,
    connectionState: wbConnectionState,
    myUserId,
    sendDraftElement,
    sendFinalElement,
    sendCursor,
    lockElement,
    unlockElement,
    clearBoard,
    roomMembers,
    role,
    canEdit,
    locked,
    kickUser,
    setUserRole,
  } = useWhiteboard(roomId);

  // Lift room presence up to RoomLayout (for avatar list / sidebar)
  useEffect(() => {
    if (typeof onMembersChange === "function") {
      onMembersChange(roomMembers || []);
    }
  }, [roomMembers, onMembersChange]);

  useEffect(() => {
    onWhiteboardApi?.({ kickUser, setUserRole });
  }, [onWhiteboardApi, kickUser, setUserRole]);

  const wbBlocked = wbConnectionState !== "connected";
  const editDisabled = wbBlocked || !canEdit;
  const lastViewOnlyToastRef = useRef(0);

  const notifyViewOnly = () => {
    const now = Date.now();
    if (now - lastViewOnlyToastRef.current < 1500) return;
    lastViewOnlyToastRef.current = now;
    showToast("View only: you don't have edit access", "error");
  };

  const [collapsed, setCollapsed] = useState(false);
  const [currentTool, setCurrentTool] = useState(ToolTypes.POINTER);
  const [action, setAction] = useState(ActionTypes.NONE);

  const [selectedId, setSelectedId] = useState(null);
  const [selectedPosition, setSelectedPosition] = useState(
    CursorPosition.OUTSIDE
  );

  const [textDraft, setTextDraft] = useState("");
  const textOriginalRef = useRef(null);
  const [isTextFocused, setIsTextFocused] = useState(false);

  const { showToast } = useToast();
  const navigate = useNavigate();

  const transformRef = useRef(null);

  const [writingElementId, setWritingElementId] = useState(null);
  const textAreaRef = useRef(null);

  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  const [scale, setScale] = useState(1);
  const isClampingRef = useRef(false);

  const drawingIdRef = useRef(null);

  const interactionRef = useRef({
    originX: 0,
    originY: 0,
    originalElement: null,
  });

  //  Copy / Paste / Duplicate (internal clipboard per-tab & per-room)
  // Clipboard disimpan di memory (useRef) => otomatis tidak bisa lintas tab.
  // Kita juga simpan roomId supaya tidak bisa paste lintas room.
  const clipboardRef = useRef(null);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  const genSeed = useCallback(() => Math.floor(Math.random() * 2 ** 31), []);

  const deepCloneElement = useCallback((el) => {
    if (!el) return null;

    // structuredClone aman untuk object/array (browser modern)
    if (typeof structuredClone === "function") return structuredClone(el);

    // fallback manual (cukup untuk shape)
    const cloned = { ...el };
    if (el.points) cloned.points = el.points.map((p) => ({ ...p }));
    if (el.base && typeof el.base === "object") cloned.base = { ...el.base };
    return cloned;
  }, []);

  const cloneWithTransform = useCallback(
    (source, { dx, dy }) => {
      const newEl = deepCloneElement(source);
      if (!newEl) return null;

      const newId = crypto.randomUUID();
      newEl.id = newId;

      // kalau ada nested base (legacy TEXT), biar konsisten
      if (newEl.base && typeof newEl.base === "object") {
        newEl.base.id = newId;
      }

      // offset koordinat
      if (newEl.type === ToolTypes.PENCIL && Array.isArray(newEl.points)) {
        newEl.points = newEl.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
      } else {
        if (typeof newEl.x1 === "number") newEl.x1 += dx;
        if (typeof newEl.y1 === "number") newEl.y1 += dy;
        if (typeof newEl.x2 === "number") newEl.x2 += dx;
        if (typeof newEl.y2 === "number") newEl.y2 += dy;
      }

      // reset seed roughJS supaya tidak 100% identik
      const nextSeed = genSeed();
      newEl.seed = nextSeed;
      if (
        newEl.base &&
        typeof newEl.base === "object" &&
        "seed" in newEl.base
      ) {
        newEl.base.seed = nextSeed;
      }

      return newEl;
    },
    [deepCloneElement, genSeed]
  );

  const elementsActive = elements.filter((el) => el && !el.isDeleted);

  const elementsToRender = writingElementId
    ? elementsActive.filter((el) => el?.id !== writingElementId)
    : elementsActive;

  const { select, deselect, unlockIfOwned, isLockedByOther } =
    useElementSelection({
      selectedId,
      setSelectedId,
      setSelectedPosition,
      setAction,
      locks,
      myUserId,
      lockElement,
      unlockElement,
    });

  const copySelected = useCallback(() => {
    // jangan ganggu state interaksi (drag/drawing/text editing)
    if (action !== ActionTypes.NONE) return;
    if (writingElementId) return;
    if (!selectedId) return;

    const el = elements.find((e) => e?.id === selectedId);
    if (!el) return;

    clipboardRef.current = {
      roomId,
      element: deepCloneElement(el),
    };
  }, [
    action,
    writingElementId,
    selectedId,
    elements,
    roomId,
    deepCloneElement,
  ]);

  const pasteFromClipboard = useCallback(() => {
    if (action !== ActionTypes.NONE) return;
    if (writingElementId) return;

    const clip = clipboardRef.current;
    if (!clip?.element) return;
    if (clip.roomId !== roomId) return; // tidak bisa paste lintas room

    const source = clip.element;

    // paste dekat posisi cursor terakhir (plus offset kecil)
    const b = getElementBounds(source);
    const left = Math.min(b.x1, b.x2);
    const top = Math.min(b.y1, b.y2);

    const cursor = lastMousePosRef.current || { x: left, y: top };
    const dx = cursor.x - left + CLIPBOARD_OFFSET;
    const dy = cursor.y - top + CLIPBOARD_OFFSET;

    const newEl = cloneWithTransform(source, { dx, dy });
    if (!newEl) return;

    setElements((prev) => [...prev, newEl]);
    sendFinalElement(newEl);

    // pilih element baru (auto-lock via select())
    select(newEl.id, CursorPosition.INSIDE);
  }, [
    action,
    writingElementId,
    roomId,
    setElements,
    sendFinalElement,
    select,
    cloneWithTransform,
  ]);

  const duplicateSelected = useCallback(() => {
    if (action !== ActionTypes.NONE) return;
    if (writingElementId) return;
    if (!selectedId) return;

    const el = elements.find((e) => e?.id === selectedId);
    if (!el) return;

    const newEl = cloneWithTransform(el, {
      dx: CLIPBOARD_OFFSET,
      dy: CLIPBOARD_OFFSET,
    });
    if (!newEl) return;

    setElements((prev) => [...prev, newEl]);
    sendFinalElement(newEl);
    select(newEl.id, CursorPosition.INSIDE);
  }, [
    action,
    writingElementId,
    selectedId,
    elements,
    setElements,
    sendFinalElement,
    select,
    cloneWithTransform,
  ]);

  const deleteSelected = useCallback(() => {
    // jangan hapus saat sedang dragging/drawing atau editing text
    if (action !== ActionTypes.NONE) return;
    if (writingElementId) return;
    if (!selectedId) return;

    // kalau dikunci user lain, jangan boleh hapus
    if (isLockedByOther(selectedId)) return;

    const el = elements.find((e) => e?.id === selectedId);
    if (!el) return;

    const deleted = {
      ...el,
      isDeleted: true,
      deletedAt: Date.now(),
      deletedBy: myUserId,
    };

    setElements((prev) =>
      prev.map((e) => (e?.id === selectedId ? deleted : e))
    );

    // persist + broadcast ke semua user
    sendFinalElement(deleted);

    // pastikan lock dilepas supaya tidak ada "ghost lock"
    unlockElement(selectedId);

    // clear selection lokal
    deselect();
    setAction(ActionTypes.NONE);
  }, [
    action,
    writingElementId,
    selectedId,
    elements,
    myUserId,
    isLockedByOther,
    setElements,
    sendFinalElement,
    unlockElement,
    deselect,
    setAction,
  ]);

  const beginEditText = (el) => {
    if (!el?.id) return;

    textOriginalRef.current = el;
    setWritingElementId(el.id);
    setTextDraft(el.text ?? "");
    lockElement(el.id);
  };

  const autosizeTextarea = useCallback(() => {
    const ta = textAreaRef.current;
    if (!ta) return;

    ta.style.height = "0px";
    ta.style.width = "0px";

    ta.style.height = `${ta.scrollHeight}px`;
    ta.style.width = `${Math.max(50, ta.scrollWidth + 2)}px`;
  }, []);

  const clampTransformToBounds = useCallback(() => {
    const ref = transformRef.current;
    if (!ref) return;

    const { instance } = ref;
    if (!instance?.wrapperComponent) return;

    const { scale, positionX, positionY } = instance.transformState;
    const wrapperRect = instance.wrapperComponent.getBoundingClientRect();

    const wrapperWidth = wrapperRect.width;
    const wrapperHeight = wrapperRect.height;

    const contentWidth = CANVAS_SIZE * scale;
    const contentHeight = CANVAS_SIZE * scale;

    const minX = wrapperWidth - contentWidth;
    const minY = wrapperHeight - contentHeight;

    const maxX = 0;
    const maxY = 0;

    let newX = positionX;
    let newY = positionY;

    if (contentWidth > wrapperWidth)
      newX = Math.min(maxX, Math.max(minX, newX));
    else newX = (wrapperWidth - contentWidth) / 2;

    if (contentHeight > wrapperHeight)
      newY = Math.min(maxY, Math.max(minY, newY));
    else newY = (wrapperHeight - contentHeight) / 2;

    if (Math.abs(newX - positionX) > 0.5 || Math.abs(newY - positionY) > 0.5) {
      isClampingRef.current = true;
      ref.setTransform(newX, newY, scale, 0);
    }
  }, []);

  useEffect(() => {
    if (!writingElementId) return;
    autosizeTextarea();
  }, [textDraft, writingElementId, autosizeTextarea]);

  useEffect(() => {
    const handleWheel = (e) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    };
    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    window.history.pushState(null, document.title, window.location.href);

    const handlePopState = () => {
      const confirmLeave = window.confirm("Changes you made may not be saved");

      if (confirmLeave) {
        window.removeEventListener("popstate", handlePopState);
        navigate("/");
      } else {
        window.history.pushState(null, document.title, window.location.href);
      }
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [navigate]);

  useEffect(() => {
    if (writingElementId && textAreaRef.current) {
      textAreaRef.current.focus();
      requestAnimationFrame(() => {
        const ta = textAreaRef.current;
        if (!ta) return;
        ta.focus();
        autosizeTextarea();
      });
    }
  }, [writingElementId, autosizeTextarea]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;

    const ctx = canvas.getContext("2d");
    drawElements(ctx, elementsToRender, locks, myUserId);
  }, []); // once

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawElements(ctx, elementsToRender, locks, myUserId);

    // jangan tampilkan selection overlay saat sedang DRAWING (sesuai request kamu)
    if (action !== ActionTypes.DRAWING) {
      drawSelectionOverlay(ctx, {
        elements: elementsToRender,
        selectedId,
        locks,
        myUserId,
      });
    }
  }, [elementsToRender, locks, myUserId, selectedId, action]);

  useEffect(() => {
    if (typeof onTitleChange === "function") onTitleChange(title);
  }, [title, onTitleChange]);

  const getRelativePos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();

    let currentScale = transformRef.current?.instance.transformState.scale || 1;
    if (currentScale <= 0 || isNaN(currentScale)) currentScale = 1;

    return {
      x: (e.clientX - rect.left) / currentScale,
      y: (e.clientY - rect.top) / currentScale,
    };
  };

  const measureTextBlock = useCallback((text, fontSize, lineHeight) => {
    const canvas = canvasRef.current;
    if (!canvas) return { width: 1, height: lineHeight };

    const ctx = canvas.getContext("2d");
    if (!ctx) return { width: 1, height: lineHeight };

    ctx.save();
    ctx.font = `${fontSize}px sans-serif`;

    const lines = (text ?? "").split("\n");
    let maxWidth = 0;

    for (const line of lines) {
      const w = ctx.measureText(line).width;
      if (w > maxWidth) maxWidth = w;
    }

    const height = Math.max(1, lines.length) * lineHeight;
    ctx.restore();

    return {
      width: Math.max(1, Math.ceil(maxWidth)),
      height: Math.max(1, Math.ceil(height)),
    };
  }, []);

  const handleTextareaBlur = () => {
    if (!writingElementId) return;

    const value = textDraft ?? "";
    const id = writingElementId;
    setWritingElementId(null);

    const current = elements.find((el) => el?.id === id);
    if (!current) {
      unlockElement(id);
      return;
    }

    if (!value.trim()) {
      setElements((prev) => prev.filter((el) => el?.id !== id));
      unlockElement(id);
      return;
    }

    let x2 = current.x1;
    let y2 = current.y1;

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const FONT_SIZE = 24;
        const LINE_HEIGHT = 30;

        ctx.save();
        ctx.font = `${FONT_SIZE}px sans-serif`;

        const lines = value.split("\n");
        let maxWidth = 0;
        for (const line of lines)
          maxWidth = Math.max(maxWidth, ctx.measureText(line).width);

        const totalHeight = lines.length * LINE_HEIGHT;
        x2 = current.x1 + Math.max(1, Math.ceil(maxWidth));
        y2 = current.y1 + totalHeight;

        ctx.restore();
      }
    }

    const fontSize = current.fontSize ?? 24;
    const lineHeight = current.lineHeight ?? 30;

    const { width, height } = measureTextBlock(value, fontSize, lineHeight);

    const finalElement = {
      ...current,
      type: ToolTypes.TEXT,
      text: value,
      fontSize,
      lineHeight,
      x2: current.x1 + width,
      y2: current.y1 + height,
      stroke: current.stroke ?? "#111827",
      strokeWidth: current.strokeWidth ?? 2,
    };

    setElements((prev) =>
      prev.map((el) => (el?.id === id ? finalElement : el))
    );
    sendFinalElement(finalElement);
    unlockElement(id);

    setTextDraft("");
    textOriginalRef.current = null;
  };

  const handleMouseDown = (e) => {
    if (wbBlocked) return;
    if (!canEdit) {
      notifyViewOnly();
      return;
    }
    const { x, y } = getRelativePos(e);
    interactionRef.current.originX = x;
    interactionRef.current.originY = y;

    // TEXT TOOL
    if (currentTool === ToolTypes.TEXT) {
      if (writingElementId) return;

      deselect();

      const id = crypto.randomUUID();
      const element = createElement({
        id,
        type: ToolTypes.TEXT,
        x1: x,
        y1: y,
        x2: x,
        y2: y,
        text: "",
        fontSize: 24,
        lineHeight: 30,
      });

      setElements((prev) => [...prev, element]);
      sendDraftElement(element);
      lockElement(id);

      setWritingElementId(id);
      setTextDraft("");
      textOriginalRef.current = null;
      return;
    }

    // DRAWING TOOLS
    if (
      currentTool === ToolTypes.RECTANGLE ||
      currentTool === ToolTypes.LINE ||
      currentTool === ToolTypes.PENCIL
    ) {
      e.stopPropagation();

      // mulai menggambar => jangan tampilkan selection border
      deselect();

      const id = crypto.randomUUID();
      const element = createElement({
        id,
        type: currentTool,
        x1: x,
        y1: y,
        x2: x,
        y2: y,
      });

      drawingIdRef.current = id;
      interactionRef.current.originalElement = element;
      setAction(ActionTypes.DRAWING);

      setElements((prev) => [...prev, element]);
      sendDraftElement(element);
      lockElement(id);
      return;
    }

    // POINTER TOOL (SELECT / MOVE / RESIZE)
    if (currentTool === ToolTypes.POINTER) {
      // kalau sudah ada selection, allow hit di selection box area
      if (selectedId && action === ActionTypes.NONE) {
        const selectedEl = elements.find((el) => el?.id === selectedId);

        if (selectedEl) {
          const hitPos = getSelectionHitPosition(selectedEl, x, y);

          if (hitPos !== CursorPosition.OUTSIDE) {
            // kalau selected element dikunci user lain, jangan interaktif
            if (isLockedByOther(selectedId)) {
              setAction(ActionTypes.NONE);
              return;
            }

            e.stopPropagation();

            // snapshot untuk move/resize
            interactionRef.current.originalElement = {
              ...selectedEl,
              points: selectedEl.points
                ? selectedEl.points.map((p) => ({ ...p }))
                : undefined,
            };

            setSelectedPosition(hitPos);

            const canResize =
              selectedEl.type === ToolTypes.RECTANGLE ||
              selectedEl.type === ToolTypes.LINE ||
              selectedEl.type === ToolTypes.PENCIL ||
              selectedEl.type === ToolTypes.TEXT;

            setAction(
              hitPos === CursorPosition.INSIDE || !canResize
                ? ActionTypes.MOVING
                : ActionTypes.RESIZING
            );

            // lock biar peer lihat
            if (locks?.[selectedId] !== myUserId) lockElement(selectedId);
            return;
          }
        }
      }

      //  normal hit test ke element
      const { element, position } = getElementAtPosition(elementsActive, x, y);

      if (!element) {
        deselect();
        setAction(ActionTypes.NONE);
        return;
      }

      e.stopPropagation();

      // locked oleh user lain, select tapi ga bisa interaktif
      if (locks[element.id] && locks[element.id] !== myUserId) {
        select(element.id, position);
        setAction(ActionTypes.NONE);
        return;
      }

      // snapshot untuk move/resize
      interactionRef.current.originalElement = {
        ...element,
        points: element.points
          ? element.points.map((p) => ({ ...p }))
          : undefined,
      };

      select(element.id, position);

      if (position === CursorPosition.INSIDE) setAction(ActionTypes.MOVING);
      else setAction(ActionTypes.RESIZING);

      return;
    }
  };

  const handleMouseMove = (e) => {
    const { x, y } = getRelativePos(e);

    // simpan posisi cursor terakhir (buat paste dekat cursor)
    lastMousePosRef.current = { x, y };

    sendCursor(x, y);

    const canvas = canvasRef.current;
    if (!canvas) return;

    // cursor preview (no action)
    if (action === ActionTypes.NONE) {
      if (currentTool === ToolTypes.POINTER) {
        // kalau ada selection, cursor harus bisa ngikut hit area selection box
        if (selectedId) {
          const selectedEl = elements.find((el) => el?.id === selectedId);
          if (selectedEl) {
            const hitPos = getSelectionHitPosition(selectedEl, x, y);
            if (hitPos !== CursorPosition.OUTSIDE) {
              canvas.style.cursor = getCursorForPosition(hitPos);
              return;
            }
          }
        }

        const { position } = getElementAtPosition(elementsActive, x, y);
        canvas.style.cursor = getCursorForPosition(position);
      } else if (currentTool === ToolTypes.TEXT) {
        canvas.style.cursor = "text";
      } else if (currentTool === ToolTypes.HAND) {
        canvas.style.cursor = "grab";
      } else {
        canvas.style.cursor = "crosshair";
      }
      return;
    }

    // DRAWING tidak boleh butuh selectedId
    if (action === ActionTypes.DRAWING) {
      const drawId = drawingIdRef.current;
      if (!drawId) return;

      setElements((prev) => {
        const { elements: updated, element: updatedElement } = updateElement(
          prev,
          drawId,
          (el) => {
            if (el.type === ToolTypes.PENCIL) {
              return { ...el, points: [...(el.points || []), { x, y }] };
            }
            return { ...el, x2: x, y2: y };
          }
        );

        if (updatedElement) sendDraftElement(updatedElement);
        return updated;
      });

      return;
    }

    // MOVING / RESIZING require selectedId + snapshot
    if (!selectedId || !interactionRef.current.originalElement) return;

    const { originX, originY } = interactionRef.current;

    if (action === ActionTypes.MOVING) {
      const dx = x - originX;
      const dy = y - originY;

      setElements((prev) => {
        const { elements: updated, element: updatedElement } = updateElement(
          prev,
          selectedId,
          (el) => {
            if (el.type === ToolTypes.PENCIL) {
              return {
                ...el,
                points: (
                  interactionRef.current.originalElement.points || []
                ).map((p) => ({
                  x: p.x + dx,
                  y: p.y + dy,
                })),
              };
            }

            return {
              ...el,
              x1: interactionRef.current.originalElement.x1 + dx,
              y1: interactionRef.current.originalElement.y1 + dy,
              x2: interactionRef.current.originalElement.x2 + dx,
              y2: interactionRef.current.originalElement.y2 + dy,
            };
          }
        );

        if (updatedElement) sendDraftElement(updatedElement);
        return updated;
      });

      return;
    }

    if (action === ActionTypes.RESIZING) {
      setElements((prev) => {
        const { elements: updated, element: updatedElement } = updateElement(
          prev,
          selectedId,
          (el) => {
            if (
              el.type !== ToolTypes.RECTANGLE &&
              el.type !== ToolTypes.LINE &&
              el.type !== ToolTypes.PENCIL &&
              el.type !== ToolTypes.TEXT
            )
              return el;

            if (el.type === ToolTypes.TEXT) {
              const isCorner =
                selectedPosition === CursorPosition.TOP_LEFT ||
                selectedPosition === CursorPosition.TOP_RIGHT ||
                selectedPosition === CursorPosition.BOTTOM_LEFT ||
                selectedPosition === CursorPosition.BOTTOM_RIGHT;

              if (!isCorner) return el;

              const orig = interactionRef.current.originalElement;
              if (!orig) return el;

              const of = orig.fontSize ?? 24;

              // bounds lama (normalized)
              const oLeft = Math.min(orig.x1, orig.x2);
              const oRight = Math.max(orig.x1, orig.x2);
              const oTop = Math.min(orig.y1, orig.y2);
              const oBottom = Math.max(orig.y1, orig.y2);

              const oW = Math.max(1, oRight - oLeft);
              const oH = Math.max(1, oBottom - oTop);

              // anchor = opposite corner
              let anchorX = oLeft;
              let anchorY = oTop;

              if (selectedPosition === CursorPosition.TOP_LEFT) {
                anchorX = oRight;
                anchorY = oBottom;
              } else if (selectedPosition === CursorPosition.TOP_RIGHT) {
                anchorX = oLeft;
                anchorY = oBottom;
              } else if (selectedPosition === CursorPosition.BOTTOM_LEFT) {
                anchorX = oRight;
                anchorY = oTop;
              } else if (selectedPosition === CursorPosition.BOTTOM_RIGHT) {
                anchorX = oLeft;
                anchorY = oTop;
              }

              // ukuran box baru dari drag mouse
              const nW = Math.max(1, Math.abs(x - anchorX));
              const nH = Math.max(1, Math.abs(y - anchorY));

              // scale uniform
              const scale = Math.min(nW / oW, nH / oH);
              const newFontSize = Math.max(
                8,
                Math.min(200, Math.round(of * scale))
              );
              const newLineHeight = Math.round(newFontSize * 1.25);

              // ukur text sesuai font baru
              const { width, height } = measureTextBlock(
                orig.text ?? el.text ?? "",
                newFontSize,
                newLineHeight
              );

              // set x1,y1,x2,y2 berdasarkan anchor
              let nx1 = anchorX,
                ny1 = anchorY,
                nx2 = anchorX,
                ny2 = anchorY;

              if (selectedPosition === CursorPosition.TOP_LEFT) {
                nx1 = anchorX - width;
                ny1 = anchorY - height;
                nx2 = anchorX;
                ny2 = anchorY;
              } else if (selectedPosition === CursorPosition.TOP_RIGHT) {
                nx1 = anchorX;
                ny1 = anchorY - height;
                nx2 = anchorX + width;
                ny2 = anchorY;
              } else if (selectedPosition === CursorPosition.BOTTOM_LEFT) {
                nx1 = anchorX - width;
                ny1 = anchorY;
                nx2 = anchorX;
                ny2 = anchorY + height;
              } else if (selectedPosition === CursorPosition.BOTTOM_RIGHT) {
                nx1 = anchorX;
                ny1 = anchorY;
                nx2 = anchorX + width;
                ny2 = anchorY + height;
              }

              return {
                ...el,
                fontSize: newFontSize,
                lineHeight: newLineHeight,
                x1: nx1,
                y1: ny1,
                x2: nx2,
                y2: ny2,
              };
            }

            const coords = getResizedCoordinates({
              type: el.type,
              position: selectedPosition,
              original: interactionRef.current.originalElement,
              mouseX: x,
              mouseY: y,
            });

            return { ...el, ...coords };
          }
        );

        if (updatedElement) sendDraftElement(updatedElement);
        return updated;
      });
    }
  };

  const finishInteraction = () => {
    const id =
      action === ActionTypes.DRAWING ? drawingIdRef.current : selectedId;

    if (!id) {
      setAction(ActionTypes.NONE);
      return;
    }

    // index harus cari by `id` aktif, bukan selalu drawingIdRef.current
    const index = elements.findIndex((el) => el?.id === id);
    if (index === -1) {
      if (action === ActionTypes.DRAWING) drawingIdRef.current = null;
      setAction(ActionTypes.NONE);
      return;
    }

    const rawElement = elements[index];
    const finalElement =
      rawElement.type === ToolTypes.RECTANGLE ||
      rawElement.type === ToolTypes.LINE
        ? adjustElementCoordinates(rawElement)
        : rawElement;

    setElements((prev) => {
      const updated = [...prev];
      updated[index] = finalElement;
      return updated;
    });

    sendFinalElement(finalElement);

    // DRAWING selesai => unlock, jangan auto-select
    if (action === ActionTypes.DRAWING) {
      unlockElement(id);
      drawingIdRef.current = null;
      setAction(ActionTypes.NONE);
      return;
    }

    // MOVING/RESIZING selesai => TETAP selected & TIDAK unlock (biar bisa delete/duplicate next)
    setSelectedPosition(CursorPosition.INSIDE);
    setAction(ActionTypes.NONE);

    const canvas = canvasRef.current;
    if (canvas)
      canvas.style.cursor = getCursorForPosition(CursorPosition.INSIDE);
  };

  const handleMouseUp = () => {
    if (action !== ActionTypes.NONE) finishInteraction();
  };

  const handleMouseLeave = () => {
    if (action !== ActionTypes.NONE) finishInteraction();
  };

  const writingElement = writingElementId
    ? elements.find((el) => el.id === writingElementId)
    : null;

  const handleShortcutAction = useCallback(
    (act) => {
      if (wbBlocked) return;
      switch (act) {
        case "COPY":
          copySelected();
          break;
        case "PASTE":
          pasteFromClipboard();
          break;
        case "DUPLICATE":
          duplicateSelected();
          break;

        case "DELETE_SELECTED":
          deleteSelected();
          break;

        case "ZOOM_IN":
          transformRef.current?.zoomIn();
          break;
        case "ZOOM_OUT":
          transformRef.current?.zoomOut();
          break;
        case "TOOL_POINTER":
          setCurrentTool(ToolTypes.POINTER);
          setAction(ActionTypes.NONE);
          break;
        case "TOOL_HAND":
          setCurrentTool(ToolTypes.HAND);
          setAction(ActionTypes.NONE);
          break;
        default:
          break;
      }
    },
    [
      wbBlocked,
      copySelected,
      pasteFromClipboard,
      duplicateSelected,
      deleteSelected,
    ]
  );
  useKeyboardShortcuts(handleShortcutAction);

  const handleResetZoom = () => {
    transformRef.current?.centerView(1, 300, "easeOut");
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e) => {
      if (!transformRef.current) return;
      if (e.ctrlKey || e.metaKey) return;

      e.preventDefault();
      e.stopPropagation();

      const { instance } = transformRef.current;
      const { scale, positionX, positionY } = instance.transformState;
      const wrapperRect = instance.wrapperComponent.getBoundingClientRect();

      const scrollSpeed = 1;
      let deltaX = e.deltaX;
      let deltaY = e.deltaY;

      if (e.shiftKey && deltaY !== 0 && deltaX === 0) {
        deltaX = deltaY;
        deltaY = 0;
      }

      let newX = positionX - deltaX * scrollSpeed;
      let newY = positionY - deltaY * scrollSpeed;

      const wrapperWidth = wrapperRect.width;
      const wrapperHeight = wrapperRect.height;

      const contentWidth = CANVAS_SIZE * scale;
      const contentHeight = CANVAS_SIZE * scale;

      const minX = wrapperWidth - contentWidth;
      const minY = wrapperHeight - contentHeight;

      const maxX = 0;
      const maxY = 0;

      if (contentWidth > wrapperWidth)
        newX = Math.min(maxX, Math.max(minX, newX));
      else newX = (wrapperWidth - contentWidth) / 2;

      if (contentHeight > wrapperHeight)
        newY = Math.min(maxY, Math.max(minY, newY));
      else newY = (wrapperHeight - contentHeight) / 2;

      transformRef.current.setTransform(newX, newY, scale, 0);
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, []);

  // Mencegah state selectedId nyangkut saat element hilang karena soft delete orang lain
  useEffect(() => {
    if (!selectedId) return;

    const el = elements.find((e) => e?.id === selectedId);
    if (!el || el.isDeleted) {
      deselect();
      setAction(ActionTypes.NONE);
    }
  }, [elements, selectedId, deselect, setAction]);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full bg-slate-50 overflow-hidden"
      onMouseDownCapture={(e) => {
        if (!writingElementId) return;
        const ta = textAreaRef.current;
        if (ta && (e.target === ta || ta.contains(e.target))) return;
        ta?.blur();
      }}
    >
      {wbBlocked && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/10 backdrop-blur-[1px]">
          <div className="rounded-xl bg-white px-4 py-2 text-sm text-slate-700 shadow">
            {wbConnectionState === "reconnecting"
              ? "Whiteboard reconnecting… Editing is temporarily disabled."
              : "Whiteboard disconnected. Please wait or refresh."}
          </div>
        </div>
      )}

      {!wbBlocked && !canEdit && (
        <div className="absolute top-3 left-1/2 z-40 -translate-x-1/2 rounded-full bg-slate-900 px-3 py-1 text-xs text-slate-100 shadow">
          View only • {role}
        </div>
      )}

      <TransformWrapper
        ref={transformRef}
        initialScale={1}
        minScale={0.1}
        maxScale={10}
        centerOnInit={true}
        limitToBounds={true}
        panning={{
          disabled: currentTool !== ToolTypes.HAND || !!writingElementId,
          excluded: ["wb-text-editor"],
          velocityDisabled: false,
          velocityAnimation: {
            sensitivity: 0.5,
            animationTime: 250,
            animationType: "easeOutQuart",
          },
        }}
        wheel={{
          step: 0.05,
          smoothStep: 0.002,
          activationKeys: ["Control", "Meta"],
          disabled: !!writingElementId,
          excluded: ["wb-text-editor"],
        }}
        doubleClick={{ disabled: true }}
        onTransformed={(instance) => {
          setScale(instance.state.scale);
          if (isClampingRef.current) {
            isClampingRef.current = false;
            return;
          }
          clampTransformToBounds();
        }}
      >
        <TransformComponent
          wrapperStyle={{
            width: "100%",
            height: "100%",
            overflow: "hidden",
            backgroundColor: "white",
          }}
        >
          <div
            style={{
              width: CANVAS_SIZE,
              height: CANVAS_SIZE,
              backgroundImage: "radial-gradient(#ddd 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
            className="relative bg-slate-50"
            onMouseEnter={() => {
              if (currentTool === ToolTypes.HAND)
                document.body.style.cursor = "grab";
            }}
          >
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              className="block"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              onDoubleClick={(e) => {
                if (writingElementId) return;
                if (currentTool !== ToolTypes.POINTER) return;

                const { x, y } = getRelativePos(e);
                const { element } = getElementAtPosition(elementsActive, x, y);

                if (element?.type === ToolTypes.TEXT) beginEditText(element);
              }}
            />

            {writingElement && (
              <textarea
                className="wb-text-editor"
                ref={textAreaRef}
                value={textDraft}
                onChange={(e) => setTextDraft(e.target.value)}
                onFocus={() => setIsTextFocused(true)}
                onBlur={() => {
                  setIsTextFocused(false);
                  handleTextareaBlur();
                }}
                wrap="off"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
                onPointerDownCapture={(e) => e.stopPropagation()}
                onPointerMoveCapture={(e) => e.stopPropagation()}
                onMouseDownCapture={(e) => e.stopPropagation()}
                spellCheck={false}
                autoCorrect="off"
                autoComplete="off"
                autoCapitalize="off"
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    const id = writingElementId;

                    const original = textOriginalRef.current;

                    if (original?.id === id) {
                      setElements((prev) =>
                        prev.map((el) => (el?.id === id ? original : el))
                      );
                    } else {
                      setElements((prev) => prev.filter((el) => el?.id !== id));
                    }

                    setWritingElementId(null);
                    setTextDraft("");
                    textOriginalRef.current = null;
                    unlockElement(id);
                    return;
                  }

                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    e.currentTarget.blur();
                  }
                }}
                onInput={(e) => {
                  const ta = e.currentTarget;
                  ta.style.height = "auto";
                  ta.style.height = `${ta.scrollHeight}px`;
                  ta.style.width = "auto";
                  ta.style.width = `${Math.max(50, ta.scrollWidth + 2)}px`;
                }}
                style={{
                  position: "absolute",
                  top: writingElement.y1,
                  left: writingElement.x1,
                  font: `${writingElement.fontSize ?? 24}px sans-serif`,
                  lineHeight: `${writingElement.lineHeight ?? 30}px`,
                  margin: 0,
                  padding: "2px 4px",
                  border: 0,
                  outline: 0,
                  resize: "none",
                  overflow: "hidden",
                  whiteSpace: "pre",
                  background: "rgba(255,255,255,0.88)",
                  borderRadius: "6px",
                  boxShadow:
                    "0 0 0 1px rgba(59,130,246,0.8), 0 0 0 2px rgba(59,130,246,0.10)",
                  caretColor: "#111827",
                  zIndex: 50,
                  minWidth: "50px",
                  color: "#111827",
                  pointerEvents: "auto",
                  userSelect: "text",
                  cursor: "text",
                }}
              />
            )}

            <div style={{ pointerEvents: "none" }}>
              <CursorOverlay cursors={cursors} />
            </div>
          </div>
        </TransformComponent>
      </TransformWrapper>

      <button
        onClick={() => setCollapsed((prev) => !prev)}
        className="absolute left-1 top-1/2 z-20 -translate-y-1/2 rounded-full bg-slate-900 px-[5px] py-[3px] text-xs text-slate-50 shadow"
      >
        {collapsed ? <FiChevronRight /> : <FiChevronLeft />}
      </button>

      <div
        className={`absolute left-4 top-1/2 z-10 -translate-y-1/2 transition-all duration-200 ${
          collapsed
            ? "-translate-x-16 opacity-0 pointer-events-none"
            : "translate-x-0 opacity-100"
        }`}
      >
        <div className="ms-2 flex flex-col items-center gap-4">
          <button className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-200 text-sm text-slate-700 shadow">
            ⏱
          </button>

          <div className="flex flex-col gap-2 rounded-2xl bg-slate-200 px-1 py-2 shadow">
            <ToolButton
              active={currentTool === ToolTypes.POINTER}
              onClick={() => {
                if (writingElementId) textAreaRef.current?.blur();
                setCurrentTool(ToolTypes.POINTER);
                setAction(ActionTypes.NONE);
              }}
            >
              ▲
            </ToolButton>

            <ToolButton
              active={currentTool === ToolTypes.HAND}
              onClick={() => {
                setCurrentTool(ToolTypes.HAND);
                setAction(ActionTypes.NONE);
              }}
            >
              ✋
            </ToolButton>

            <ToolButton
              active={currentTool === ToolTypes.PENCIL}
              onClick={() => {
                if (editDisabled) return notifyViewOnly();

                setCurrentTool(ToolTypes.PENCIL);
              }}
            >
              ✏️
            </ToolButton>

            <ToolButton
              active={currentTool === ToolTypes.RECTANGLE}
              onClick={() => {
                if (editDisabled) return notifyViewOnly();

                setCurrentTool(ToolTypes.RECTANGLE);
              }}
            >
              ▢
            </ToolButton>

            <ToolButton
              active={currentTool === ToolTypes.LINE}
              onClick={() => {
                if (editDisabled) return notifyViewOnly();

                setCurrentTool(ToolTypes.LINE);
              }}
            >
              ／
            </ToolButton>

            <ToolButton
              active={false}
              onClick={() => {
                if (editDisabled) return notifyViewOnly();

                if (writingElementId) textAreaRef.current?.blur();
                if (selectedId) {
                  deleteSelected();
                  return;
                }

                if (confirm("Are you sure to clear whiteboad?")) {
                  if (wbBlocked) return;
                  setWritingElementId(null);
                  deselect();
                  clearBoard(true);
                }
              }}
            >
              ⌫
            </ToolButton>

            <ToolButton
              active={currentTool === ToolTypes.TEXT}
              onClick={() => setCurrentTool(ToolTypes.TEXT)}
            >
              T
            </ToolButton>
          </div>

          <div className="flex flex-col gap-2 rounded-2xl bg-slate-200 px-1 py-2 shadow">
            <button
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-lg text-slate-800"
              onClick={(e) => {
                transformRef.current?.zoomIn();
                e.currentTarget.blur();
              }}
            >
              +
            </button>

            <button
              onClick={handleResetZoom}
              className="w-12 text-xs font-semibold text-slate-700 tabular-nums text-center hover:text-blue-600 outline-none focus:outline-none focus:ring-0"
              title="Reset Zoom"
            >
              {Math.max(10, Math.round(scale * 100))}%
            </button>

            <button
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-lg text-slate-800"
              onClick={(e) => {
                transformRef.current?.zoomOut();
                e.currentTarget.blur();
              }}
            >
              –
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        onClick();
        e.currentTarget.blur();
      }}
      className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm transition-all duration-150
        outline-none focus:outline-none focus:ring-0
        ${
          active
            ? "bg-slate-900 text-slate-50 shadow-md transform scale-105"
            : "bg-slate-100 text-slate-700 hover:bg-white hover:shadow-sm"
        }`}
    >
      {children}
    </button>
  );
}
