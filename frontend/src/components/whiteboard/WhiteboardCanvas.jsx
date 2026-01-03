import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  FiChevronLeft,
  FiChevronRight,
  FiPlay,
  FiRotateCcw,
  FiSquare,
} from "react-icons/fi";
import { GrDuplicate } from "react-icons/gr";
import { FaRegCopy } from "react-icons/fa6";
import { RiDeleteBin6Line } from "react-icons/ri";
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
import LoadingModal from "../ui/LoadingModal";

const CANVAS_SIZE = 8000;
const CLIPBOARD_OFFSET = 20;
const LOCK_IDLE_TIMEOUT_MS = 5 * 1000;
const MIN_PENCIL_POINT_DIST = 15;

const STROKE_COLORS = [
  "#111827", // slate-900
  "#ef4444", // red
  "#f59e0b", // amber
  "#10b981", // emerald
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#64748b", // slate
];

const STROKE_WIDTHS = [2, 4, 8];

const genSeed = () => {
  return Math.floor(Math.random() * 2 ** 31);
};

// Deep copy element: avoid copy by reference.
// Ideally we'll be using function of `structuredClone()`, but we also handle fallback mechanism if the function is not provided in user's browser
const deepCloneElement = (el) => {
  if (!el) return null;

  // structuredClone aman untuk object/array (browser modern)
  if (typeof structuredClone === "function") return structuredClone(el);

  // fallback manual (cukup untuk shape)
  const cloned = { ...el };
  if (el.points) cloned.points = el.points.map((p) => ({ ...p }));
  if (el.base && typeof el.base === "object") cloned.base = { ...el.base };
  return cloned;
};

const isShapeTool = (t) => {
  return (
    t === ToolTypes.RECTANGLE ||
    t === ToolTypes.CIRCLE ||
    t === ToolTypes.TRIANGLE ||
    t === ToolTypes.LINE
  );
};

const getShapeIcon = (t) => {
  if (t === ToolTypes.CIRCLE) return "○";
  if (t === ToolTypes.TRIANGLE) return "△";
  if (t === ToolTypes.LINE) return "／";
  return "▢"; // default rectangle
};

const isFillableTool = (t) => {
  return (
    t === ToolTypes.RECTANGLE ||
    t === ToolTypes.CIRCLE ||
    t === ToolTypes.TRIANGLE
  );
};

const clampMinutes = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return 5;
  if (n < 5) return 5;
  if (n > 120) return 120;
  return Math.trunc(n);
};
export default function WhiteboardCanvas({
  roomId,
  onTitleChange,
  onMembersChange,
  onWhiteboardApi,
  onConnectionStateChange,
}) {
  const navigate = useNavigate();

  // Boundary DOM state
  const containerRef = useRef(null);
  // Transform wrapper state, belongs to react-pinch-pan-zoom
  const transformRef = useRef(null);
  // Canvas state
  const canvasRef = useRef(null);
  // Text area state
  const textAreaRef = useRef(null);

  const { showToast } = useToast();
  // Drawing activity utility
  const drawingIdRef = useRef(null);
  const textOriginalRef = useRef(null);
  const erasedIdsRef = useRef(new Set());
  const lastStyleSyncIdRef = useRef(null);

  // Color state
  const [strokeColor, setStrokeColor] = useState("#111827");
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [fillColor, setFillColor] = useState("");

  // UI states
  const [shapeMenuOpen, setShapeMenuOpen] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);

  // Snapshot for moving/resizing
  const interactionRef = useRef({
    originX: 0,
    originY: 0,
    originalElement: null,
  });

  const isClampingRef = useRef(false);
  const lastLockActivityAtRef = useRef(0);
  const markLockActivity = () => {
    lastLockActivityAtRef.current = Date.now();
  };

  //  Copy / Paste / Duplicate (internal clipboard per-tab & per-room)
  // Clipboard disimpan di memory (useRef) => otomatis tidak bisa lintas tab.
  // Kita juga simpan roomId supaya tidak bisa paste lintas room.
  const clipboardRef = useRef(null);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  // Whiteboard data source
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
    isHydrated,
    kickUser,
    setUserRole,
    timerState,
    startTimer,
    stopTimer,
    resetTimer,
  } = useWhiteboard(roomId);

  const wbBlocked = wbConnectionState !== "connected" || !isHydrated;
  const editDisabled = wbBlocked || !canEdit;

  // Default screen scale
  const [scale, setScale] = useState(1);
  // Participant and message menu
  const [collapsed, setCollapsed] = useState(false);

  // Tool and action
  const [currentTool, setCurrentTool] = useState(ToolTypes.POINTER);
  const [action, setAction] = useState(ActionTypes.NONE);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedPosition, setSelectedPosition] = useState(
    CursorPosition.OUTSIDE
  );
  const [textDraft, setTextDraft] = useState("");
  const [writingElementId, setWritingElementId] = useState(null);

  const [isTimerOpen, setIsTimerOpen] = useState(false);
  const [timerMinutes, setTimerMinutes] = useState("5");
  const timerRef = useRef(null);

  const timerRunning = !!timerState?.running;
  const canUseTimer = role === "OWNER";

  const exportPng = useCallback(() => {
    // kalau sedang edit text, commit dulu agar hasil export final
    if (writingElementId) {
      textAreaRef.current?.blur();
    }

    const els = (elements || []).filter((el) => el && !el.isDeleted);
    if (els.length === 0) {
      showToast?.("Nothing to export", "info");
      return;
    }

    // cari bounding box keseluruhan
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const el of els) {
      const b = getElementBounds(el);
      const left = Math.min(b.x1, b.x2);
      const right = Math.max(b.x1, b.x2);
      const top = Math.min(b.y1, b.y2);
      const bottom = Math.max(b.y1, b.y2);

      if (left < minX) minX = left;
      if (top < minY) minY = top;
      if (right > maxX) maxX = right;
      if (bottom > maxY) maxY = bottom;
    }

    const PAD = 30;
    minX = Math.max(0, Math.floor(minX - PAD));
    minY = Math.max(0, Math.floor(minY - PAD));
    maxX = Math.min(CANVAS_SIZE, Math.ceil(maxX + PAD));
    maxY = Math.min(CANVAS_SIZE, Math.ceil(maxY + PAD));

    const w = Math.max(1, maxX - minX);
    const h = Math.max(1, maxY - minY);

    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;

    const ctx = off.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    // geser origin agar crop pas
    ctx.save();
    ctx.translate(-minX, -minY);

    // render elemen tanpa lock overlay (pakai locks kosong)
    drawElements(ctx, els, {}, myUserId);

    ctx.restore();

    const url = off.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `whiteboard-${roomId || "export"}.png`;
    a.click();

    showToast?.("Exported PNG", "success");
  }, [writingElementId, elements, myUserId, roomId, showToast]);

  useEffect(() => {
    if (!isTimerOpen) return;

    const onDown = (e) => {
      const el = timerRef.current;
      if (!el) return;
      if (!el.contains(e.target)) setIsTimerOpen(false);
    };

    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [isTimerOpen]);

  // Lift room presence up to RoomLayout (for avatar list / sidebar)
  useEffect(() => {
    if (typeof onMembersChange === "function")
      onMembersChange(roomMembers || []);
  }, [roomMembers, onMembersChange]);

  useEffect(() => {
    onWhiteboardApi?.({
      kickUser,
      setUserRole,
      exportPng,

      timerState,
      startTimer,
      stopTimer,
      resetTimer,
    });
  }, [
    onWhiteboardApi,
    kickUser,
    setUserRole,
    exportPng,
    timerState,
    startTimer,
    stopTimer,
    resetTimer,
  ]);

  useEffect(() => {
    if (typeof onConnectionStateChange === "function") {
      onConnectionStateChange(wbConnectionState);
    }
  }, [wbConnectionState, onConnectionStateChange]);

  // Filter all active elements (remove soft delete one)
  const elementsActive = useMemo(() => {
    return elements.filter((el) => el && !el.isDeleted);
  }, [elements]);
  // Special case if currently in writing, then hide only the edited element
  const elementsToRender = useMemo(() => {
    if (!writingElementId) return elementsActive;
    return elementsActive.filter((el) => el?.id !== writingElementId);
  }, [elementsActive, writingElementId]);

  const writingElement = writingElementId
    ? elements.find((el) => el.id === writingElementId)
    : null;

  const userNameById = useMemo(() => {
    const map = {};
    (roomMembers || []).forEach((m) => {
      const id = String(m.id);
      map[id] = m.username || m.name || id;
    });
    return map;
  }, [roomMembers]);

  // Selection/locking helper
  const { select, deselect, isLockedByOther } = useElementSelection({
    selectedId,
    setSelectedId,
    setSelectedPosition,
    setAction,
    locks,
    myUserId,
    lockElement,
    unlockElement,
  });

  const isFillableType = (t) => {
    return (
      t === ToolTypes.RECTANGLE ||
      t === ToolTypes.CIRCLE ||
      t === ToolTypes.TRIANGLE
    );
  };

  const applyStyleToSelected = useCallback(
    (patch) => {
      if (!selectedId) return;

      // jangan ubah style saat sedang edit text (textarea)
      if (writingElementId) return;

      // jangan ubah style saat sedang drag/drawing/resizing
      if (action !== ActionTypes.NONE) return;

      // jangan ubah kalau dikunci user lain
      if (isLockedByOther(selectedId)) return;

      const current = elements.find((e) => e?.id === selectedId);
      if (!current || current.isDeleted) return;

      const next = { ...current, ...patch };

      // kalau ada `base` (legacy/text), update juga agar konsisten
      if (current.base && typeof current.base === "object") {
        next.base = { ...current.base, ...patch };
      }

      setElements((prev) => prev.map((e) => (e?.id === selectedId ? next : e)));

      sendFinalElement(next);
    },
    [
      selectedId,
      writingElementId,
      action,
      elements,
      setElements,
      sendFinalElement,
      isLockedByOther,
    ]
  );

  const releaseMySelectedLock = useCallback(() => {
    if (!selectedId) return;
    if (writingElementId) return;

    const owner = locks?.[selectedId];
    if (!owner) return;
    if (String(owner) !== String(myUserId)) return;

    unlockElement(selectedId);
    deselect();
    setAction(ActionTypes.NONE);
  }, [selectedId, writingElementId, locks, myUserId, unlockElement, deselect]);

  // Coordinates Helper
  // Get relative position. Bridge between world coordinates and screen coordinates.
  const getRelativePos = (e) => {
    // Screen coordinates (affected by zoom/pan from transformRef)
    const rect = canvasRef.current.getBoundingClientRect();

    let currentScale = transformRef.current?.instance.transformState.scale || 1;

    // Prevent scale to be negative value
    if (currentScale <= 0 || isNaN(currentScale)) currentScale = 1;

    // Mathematical relation between world coordinates and screen coordinates:
    // screen = (world * scale) + translate
    return {
      x: (e.clientX - rect.left) / currentScale,
      y: (e.clientY - rect.top) / currentScale,
    };
  };

  const distPointToSegment = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax;
    const dy = by - ay;

    if (dx === 0 && dy === 0) {
      // segment degenerate
      const vx = px - ax;
      const vy = py - ay;
      return Math.sqrt(vx * vx + vy * vy);
    }

    const t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
    const tt = Math.max(0, Math.min(1, t));

    const cx = ax + tt * dx;
    const cy = ay + tt * dy;

    const vx = px - cx;
    const vy = py - cy;
    return Math.sqrt(vx * vx + vy * vy);
  };

  const pencilHitTest = (points, x, y, radius) => {
    if (!Array.isArray(points) || points.length < 2) return false;

    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const d = distPointToSegment(x, y, a.x, a.y, b.x, b.y);
      if (d <= radius) return true;
    }
    return false;
  };

  const eraseAtPoint = (x, y) => {
    const ERASE_RADIUS = 10;

    // cari dari atas (elemen paling akhir biasanya paling "top")
    for (let i = elementsActive.length - 1; i >= 0; i--) {
      const el = elementsActive[i];
      if (!el || el.isDeleted) continue;
      if (el.type !== ToolTypes.PENCIL) continue;

      // jangan hapus kalau sudah dihapus pada drag ini
      if (erasedIdsRef.current.has(el.id)) continue;

      // respect lock: kalau dikunci user lain, skip
      if (locks?.[el.id] && locks[el.id] !== myUserId) continue;

      const hit = pencilHitTest(el.points, x, y, ERASE_RADIUS);
      if (!hit) continue;

      const deleted = {
        ...el,
        isDeleted: true,
        deletedAt: Date.now(),
        deletedBy: myUserId,
      };

      setElements((prev) => prev.map((p) => (p?.id === el.id ? deleted : p)));
      sendFinalElement(deleted);
      unlockElement(el.id);

      if (selectedId === el.id) {
        deselect();
        setAction(ActionTypes.NONE);
      }

      erasedIdsRef.current.add(el.id);
      return; // hapus 1 stroke per event move (lebih stabil)
    }
  };

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

  // Copy element
  // Disabled if DRAWING, MOVING
  // Must have selection
  const copySelected = useCallback(() => {
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

  // Duplicate element
  // Similar to copy
  // But immediately create the duplicated element near (based on defined offset) the original element.
  // No need to store it in browser clipboard
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

  // Delete selected element using keyboard `Delete` or `Backspace`.
  // Couldn't delete locked element.
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

  // Activate text writing
  const beginEditText = (el) => {
    if (editDisabled) return;
    if (!el?.id) return;

    if (isLockedByOther(el.id)) return;
    lockElement(el.id);
    markLockActivity();

    textOriginalRef.current = structuredClone(el);
    setWritingElementId(el.id);
    setTextDraft(el.text ?? "");
  };

  const measureTextBlock = (text, fontSize, lineHeight) => {
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
  };

  const handleTextareaBlur = () => {
    if (!writingElementId) return;

    const value = textDraft ?? "";
    const id = writingElementId;
    setWritingElementId(null);

    const current = elements.find((el) => el?.id === id);
    if (!current) {
      if (locks && locks[id] === myUserId) unlockElement(id);
      id;
      return;
    }

    if (!value.trim()) {
      setElements((prev) => prev.filter((el) => el?.id !== id));
      if (locks && locks[id] === myUserId) unlockElement(id);
      id;
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
    if (locks && locks[id] === myUserId) unlockElement(id);

    setTextDraft("");
    textOriginalRef.current = null;
  };

  // Transform Helper
  const clampTransformToBounds = () => {
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
  };

  // Re-center the screens
  const handleResetZoom = () => {
    transformRef.current?.centerView(1, 300, "easeOut");
  };

  const selectedElement = useMemo(() => {
    if (!selectedId) return null;
    return elementsActive.find((el) => el?.id === selectedId) || null;
  }, [elementsActive, selectedId]);

  const actionBarPos = useMemo(() => {
    if (!selectedElement) return null;

    const b = getElementBounds(selectedElement);
    const left = Math.min(b.x1, b.x2);
    const right = Math.max(b.x1, b.x2);
    const top = Math.min(b.y1, b.y2);

    const cx = (left + right) / 2;
    const y = Math.max(10, top - 14); // sedikit di atas element

    return { x: cx, y };
  }, [selectedElement]);

  // Adjust size of textarea to the size of the content while editing text
  // Textarea is displayed without scrollbar
  useEffect(() => {
    if (!writingElementId) return;
    const ta = textAreaRef.current;
    if (!ta) return;

    ta.style.height = "0px";
    ta.style.width = "0px";
    ta.style.height = `${ta.scrollHeight}px`;
    ta.style.width = `${Math.max(50, ta.scrollWidth + 2)}px`;
  }, [textDraft, writingElementId]);

  // Prevent browser default zoom
  // Instead we modify zoom functionality by using react-zoom-pan-pinch
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

  // If user enter editing text mode, browser immediately focus on textarea.
  // To improve consistency and make sure DOM is already stable, we use requestAnimationFrame to trigger focus on next render frame.
  useEffect(() => {
    if (writingElementId && textAreaRef.current) {
      textAreaRef.current.focus();
      requestAnimationFrame(() => {
        const ta = textAreaRef.current;
        if (!ta) return;
        ta.focus();
      });
    }
  }, [writingElementId]);

  // First initialization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawElements(ctx, elementsToRender, locks, myUserId);

    // jangan tampilkan selection overlay saat sedang DRAWING
    if (action !== ActionTypes.DRAWING) {
      drawSelectionOverlay(ctx, {
        elements: elementsToRender,
        selectedId,
        locks,
        myUserId,
        userNameById,
      });
    }
  }, [elementsToRender, locks, myUserId, selectedId, action]);

  useEffect(() => {
    if (typeof onTitleChange === "function") onTitleChange(title);
  }, [title, onTitleChange]);

  // Panning via mouse scroll wheel
  // Intercept default panning (which provided by library)
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

  useEffect(() => {
    // kalau tidak ada selection, reset marker sync
    if (!selectedId) {
      lastStyleSyncIdRef.current = null;
      return;
    }

    // sync hanya saat selection berubah (hindari spam saat element sedang di-drag)
    if (lastStyleSyncIdRef.current === selectedId) return;
    lastStyleSyncIdRef.current = selectedId;

    const el = elements.find((e) => e?.id === selectedId);
    if (!el) return;

    // Ambil style dari level atas, fallback ke el.base (untuk legacy/text)
    const nextStroke = el.stroke ?? el.base?.stroke ?? "#111827";
    const nextWidthRaw = el.strokeWidth ?? el.base?.strokeWidth;
    const nextWidth =
      typeof nextWidthRaw === "number" && !isNaN(nextWidthRaw)
        ? nextWidthRaw
        : 2;

    setStrokeColor(nextStroke);
    setStrokeWidth(nextWidth);

    // Fill hanya untuk shape tertentu
    const fillable =
      el.type === ToolTypes.RECTANGLE ||
      el.type === ToolTypes.CIRCLE ||
      el.type === ToolTypes.TRIANGLE;

    if (fillable) {
      const nextFill = el.fill ?? el.base?.fill ?? "";
      setFillColor(nextFill || "");
    } else {
      setFillColor("");
    }
  }, [selectedId, elements, setStrokeColor, setStrokeWidth, setFillColor]);

  useEffect(() => {
    const t = setInterval(() => {
      if (!selectedId) return;
      if (writingElementId) return;

      // hanya auto-unlock kalau lock milik kita
      const owner = locks?.[selectedId];
      if (!owner || owner !== myUserId) return;

      const last = lastLockActivityAtRef.current || 0;
      if (!last) return;

      const idleMs = Date.now() - last;
      if (idleMs < LOCK_IDLE_TIMEOUT_MS) return;

      unlockElement(selectedId);
      deselect();
      setAction(ActionTypes.NONE);
    }, 1000);

    return () => clearInterval(t);
  }, [selectedId, writingElementId, locks, myUserId, deselect]);

  useEffect(() => {
    if (!writingElementId) return;

    let owner = null;
    if (locks && writingElementId in locks) {
      owner = locks[writingElementId];
    }
    if (!owner) return;

    if (owner !== myUserId) {
      setWritingElementId(null);
      setTextDraft("");
      textOriginalRef.current = null;
    }
  }, [writingElementId, locks, myUserId]);

  useEffect(() => {
    if (!selectedId) return;

    const owner = locks?.[selectedId];
    if (owner && String(owner) === String(myUserId)) {
      markLockActivity();
    }
  }, [selectedId, locks, myUserId]);

  // Auto-unlock when tab is hidden or window blur
  useEffect(() => {
    // const onBlur = () => {
    //   releaseMySelectedLock();
    // };

    const onVisibility = () => {
      if (document.hidden) {
        releaseMySelectedLock();
      }
    };

    const onPageHide = () => {
      releaseMySelectedLock();
    };

    // window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [selectedId, locks, myUserId, writingElementId]);

  const handleMouseDown = (e) => {
    if (wbBlocked) return;
    if (!canEdit) {
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
        stroke: strokeColor,
        strokeWidth: strokeWidth,
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
      currentTool === ToolTypes.CIRCLE ||
      currentTool === ToolTypes.TRIANGLE ||
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
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        fill: isFillableTool(currentTool) ? fillColor : "",
      });

      drawingIdRef.current = id;
      // interactionRef.current.originalElement = element;
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

            const isCorner =
              hitPos === CursorPosition.TOP_LEFT ||
              hitPos === CursorPosition.TOP_RIGHT ||
              hitPos === CursorPosition.BOTTOM_LEFT ||
              hitPos === CursorPosition.BOTTOM_RIGHT;

            const canResize =
              selectedEl.type === ToolTypes.RECTANGLE ||
              selectedEl.type === ToolTypes.CIRCLE ||
              selectedEl.type === ToolTypes.TRIANGLE ||
              selectedEl.type === ToolTypes.LINE ||
              selectedEl.type === ToolTypes.PENCIL ||
              selectedEl.type === ToolTypes.TEXT;

            // Circle: resize hanya dari corner supaya tetap bulat
            if (selectedEl.type === ToolTypes.CIRCLE && !isCorner) {
              setAction(ActionTypes.MOVING);
            } else {
              setAction(
                hitPos === CursorPosition.INSIDE || !canResize
                  ? ActionTypes.MOVING
                  : ActionTypes.RESIZING
              );
            }

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

      markLockActivity();

      // snapshot untuk move/resize
      interactionRef.current.originalElement = {
        ...element,
        points: element.points
          ? element.points.map((p) => ({ ...p }))
          : undefined,
      };

      const res = select(element.id, position);
      if (res && res.interactive) {
        markLockActivity();
      }

      if (position === CursorPosition.INSIDE) setAction(ActionTypes.MOVING);
      else setAction(ActionTypes.RESIZING);

      return;
    }

    // ERASER TOOL (pencil-only)
    if (currentTool === ToolTypes.ERASER) {
      if (editDisabled) return;
      if (writingElementId) return;

      e.stopPropagation();

      erasedIdsRef.current = new Set();
      setAction(ActionTypes.ERASING);

      deselect();

      eraseAtPoint(x, y);
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

    if (action === ActionTypes.ERASING) {
      // selama drag eraser: hapus pencil stroke yang kena
      eraseAtPoint(x, y);
      return;
    }

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
      } else if (currentTool === ToolTypes.ERASER) {
        canvas.style.cursor = "crosshair";
      } else {
        canvas.style.cursor = "crosshair";
      }
      return;
    }

    // DRAWING tidak boleh butuh selectedId
    if (action === ActionTypes.DRAWING) {
      const drawId = drawingIdRef.current;
      if (!drawId) return;

      markLockActivity();

      setElements((prev) => {
        const current = prev.find((el) => el?.id === drawId);
        if (!current) return prev;

        // Pencil sampling :skip update kalau jarak terlalu kecil
        if (current.type === ToolTypes.PENCIL) {
          const pts = current.points || [];
          const last = pts[pts.length - 1];
          if (last) {
            const dx = x - last.x;
            const dy = y - last.y;
            if (
              dx * dx + dy * dy <
              MIN_PENCIL_POINT_DIST * MIN_PENCIL_POINT_DIST
            ) {
              return prev; // tidak update state, tidak kirim draft
            }
          }
        }
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

      markLockActivity();

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
      markLockActivity();

      setElements((prev) => {
        const { elements: updated, element: updatedElement } = updateElement(
          prev,
          selectedId,
          (el) => {
            if (
              el.type !== ToolTypes.RECTANGLE &&
              el.type !== ToolTypes.LINE &&
              el.type !== ToolTypes.CIRCLE &&
              el.type !== ToolTypes.TRIANGLE &&
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

            if (el.type === ToolTypes.CIRCLE) {
              const orig = interactionRef.current.originalElement;
              if (!orig) return el;

              // gunakan bounds orig (normalized)
              const oLeft = Math.min(orig.x1, orig.x2);
              const oRight = Math.max(orig.x1, orig.x2);
              const oTop = Math.min(orig.y1, orig.y2);
              const oBottom = Math.max(orig.y1, orig.y2);

              // tentukan anchor = opposite corner
              let ax = oLeft;
              let ay = oTop;

              if (selectedPosition === CursorPosition.TOP_LEFT) {
                ax = oRight;
                ay = oBottom;
              } else if (selectedPosition === CursorPosition.TOP_RIGHT) {
                ax = oLeft;
                ay = oBottom;
              } else if (selectedPosition === CursorPosition.BOTTOM_LEFT) {
                ax = oRight;
                ay = oTop;
              } else if (selectedPosition === CursorPosition.BOTTOM_RIGHT) {
                ax = oLeft;
                ay = oTop;
              } else {
                // circle resize non-corner tidak didukung (sudah dicegah di mousedown)
                return el;
              }

              const side = Math.max(Math.abs(x - ax), Math.abs(y - ay)) || 1;

              let nx1 = ax,
                ny1 = ay,
                nx2 = ax,
                ny2 = ay;

              if (selectedPosition === CursorPosition.TOP_LEFT) {
                nx1 = ax - side;
                ny1 = ay - side;
                nx2 = ax;
                ny2 = ay;
              } else if (selectedPosition === CursorPosition.TOP_RIGHT) {
                nx1 = ax;
                ny1 = ay - side;
                nx2 = ax + side;
                ny2 = ay;
              } else if (selectedPosition === CursorPosition.BOTTOM_LEFT) {
                nx1 = ax - side;
                ny1 = ay;
                nx2 = ax;
                ny2 = ay + side;
              } else if (selectedPosition === CursorPosition.BOTTOM_RIGHT) {
                nx1 = ax;
                ny1 = ay;
                nx2 = ax + side;
                ny2 = ay + side;
              }

              return { ...el, x1: nx1, y1: ny1, x2: nx2, y2: ny2 };
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
      rawElement.type === ToolTypes.CIRCLE ||
      rawElement.type === ToolTypes.TRIANGLE ||
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

    if (action === ActionTypes.ERASING) {
      erasedIdsRef.current = new Set();
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

  const handleMouseUp = (e) => {
    if (action !== ActionTypes.NONE) finishInteraction();
  };

  const handleMouseLeave = () => {
    if (action !== ActionTypes.NONE) finishInteraction();
  };

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

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full bg-slate-50 overflow-hidden"
      // Fires first before event travel further to children.
      // Intercept during text handling.
      onPointerDownCapture={(e) => {
        if (!writingElementId) return;

        const ta = textAreaRef.current;
        if (ta && (e.target === ta || ta.contains(e.target))) return;
        ta?.blur();
        setAction(ActionTypes.NONE);
        setCurrentTool(ToolTypes.POINTER);
      }}
    >
      {/* If  */}
      {wbBlocked && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/10 backdrop-blur-[1px]">
          <div className="rounded-xl bg-white px-4 py-2 text-sm text-slate-700 shadow">
            {wbConnectionState === "connected" && !isHydrated ? (
              <LoadingModal
                open={wbBlocked}
                title="Loading"
                subtitle="Syncing room data…"
              />
            ) : wbConnectionState === "reconnecting" ? (
              <LoadingModal
                open={wbBlocked}
                title="Reconnecting"
                subtitle="Whiteboard reconnecting… Editing is temporarily disabled."
              />
            ) : (
              <LoadingModal
                open={wbBlocked}
                title="Disconnected"
                subtitle="Whiteboard disconnected. Please wait or refresh."
              />
            )}
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
          // Disable panning IF tool is not HAND or user is currently writing
          disabled: currentTool !== ToolTypes.HAND || !!writingElementId,
          // Disable panning IF user moving text editor
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
              className="block wb-canvas"
              style={{ touchAction: "none" }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              onDoubleClick={(e) => {
                // if (writingElementId) return;
                if (currentTool !== ToolTypes.POINTER) return;

                const { x, y } = getRelativePos(e);
                const { element } = getElementAtPosition(elementsActive, x, y);

                if (element?.type === ToolTypes.TEXT) {
                  if (isLockedByOther(element.id)) return;
                  beginEditText(element);
                }
              }}
            />

            {actionBarPos &&
              selectedElement &&
              action === ActionTypes.NONE &&
              !writingElementId &&
              !isLockedByOther(selectedId) && (
                <div
                  style={{
                    position: "absolute",
                    left: actionBarPos.x,
                    top: actionBarPos.y,
                    transform: "translate(-50%, -100%)",
                    pointerEvents: "auto",
                    zIndex: 60,
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-1 rounded-xl bg-white/95 px-1.5 py-1 shadow-lg ring-1 ring-slate-900/10 backdrop-blur-sm">
                    <button
                      className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                      onClick={() => {
                        copySelected();
                      }}
                      title="Copy"
                    >
                      <FaRegCopy className="h-5 w-5"></FaRegCopy>
                    </button>

                    <button
                      className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                      onClick={() => {
                        duplicateSelected();
                      }}
                      title="Duplicate"
                    >
                      <GrDuplicate className="h-5 w-5"></GrDuplicate>
                    </button>

                    <button
                      className="rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                      onClick={() => {
                        deleteSelected();
                      }}
                      title="Delete"
                    >
                      <RiDeleteBin6Line className="h-5 w-5"></RiDeleteBin6Line>
                    </button>
                  </div>
                </div>
              )}

            {writingElement && (
              <textarea
                className="wb-text-editor"
                ref={textAreaRef}
                value={textDraft}
                onChange={(e) => {
                  setTextDraft(e.target.value);
                  markLockActivity();
                }}
                onBlur={() => {
                  handleTextareaBlur();
                }}
                wrap="off"
                onMouseDown={(e) => {
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                }}
                onPointerDownCapture={(e) => e.stopPropagation()}
                onPointerMoveCapture={(e) => e.stopPropagation()}
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
                    if (locks && locks[id] === myUserId) {
                      unlockElement(id);
                    }

                    return;
                  }

                  if (e.key === "Enter") {
                    const shiftKey = e.shiftKey;

                    if (!shiftKey) {
                      e.preventDefault();
                      e.stopPropagation();
                      e.currentTarget.blur();
                      setSelectedId(null);
                      return;
                    }
                  }
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
              <CursorOverlay cursors={cursors} roomMembers={roomMembers} />
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
          {canUseTimer && (
            <div className="relative" ref={timerRef}>
              <button
                type="button"
                onClick={() => setIsTimerOpen((v) => !v)}
                className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 shadow-sm ring-1 ring-slate-900/5 hover:bg-slate-200 transition"
                title="Timer"
              >
                ⏱
              </button>

              {isTimerOpen && (
                <div className="absolute left-14 top-0 z-40 rounded-2xl bg-white p-3 shadow-2xl ring-1 ring-slate-900/10">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={5}
                        max={120}
                        step={5}
                        value={timerMinutes}
                        disabled={timerRunning}
                        onChange={(e) => setTimerMinutes(e.target.value)}
                        onBlur={() => {
                          const n = clampMinutes(timerMinutes);
                          setTimerMinutes(String(n));
                        }}
                        className="w-20 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums"
                      />
                      <span className="text-sm text-slate-500">min</span>
                    </div>

                    <div className="h-8 w-px bg-slate-200" />

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={timerRunning}
                        onClick={() => {
                          const n = clampMinutes(timerMinutes);
                          startTimer?.(n * 60 * 1000);
                          setIsTimerOpen(false);
                        }}
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white disabled:opacity-50"
                        title="Start"
                      >
                        <FiPlay />
                      </button>

                      <button
                        type="button"
                        disabled={!timerRunning}
                        onClick={() => {
                          stopTimer?.();
                          setIsTimerOpen(false);
                        }}
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 disabled:opacity-50"
                        title="Stop"
                      >
                        <FiSquare />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          resetTimer?.();
                          setIsTimerOpen(false);
                        }}
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700"
                        title="Reset"
                      >
                        <FiRotateCcw />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="relative">
            <button
              disabled={editDisabled}
              onClick={() => {
                setStyleOpen((prev) => !prev);
                setShapeMenuOpen(false);
              }}
              className={`flex h-11 w-11 items-center justify-center rounded-xl shadow ${
                editDisabled
                  ? "bg-slate-200 text-slate-400"
                  : "bg-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
              title="Stroke options"
            >
              <div
                className="h-5 w-5 rounded-full ring-2 ring-white"
                style={{ backgroundColor: strokeColor }}
              />
            </button>

            {styleOpen && (
              <div
                className="absolute left-12 top-0 z-30 w-44 rounded-xl bg-white p-2 shadow-lg ring-1 ring-slate-900/10"
                onMouseLeave={() => setStyleOpen(false)}
              >
                <div className="mb-2 text-[11px] font-semibold text-slate-500">
                  Stroke color
                </div>

                <div className="flex flex-wrap gap-2">
                  {STROKE_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`h-6 w-6 rounded-full ring-2 ${
                        strokeColor === c ? "ring-slate-900" : "ring-slate-200"
                      }`}
                      style={{ backgroundColor: c }}
                      onClick={() => {
                        setStrokeColor(c);
                        applyStyleToSelected({ stroke: c });
                      }}
                      title={c}
                    />
                  ))}
                </div>

                <div className="mt-3 mb-2 text-[11px] font-semibold text-slate-500">
                  Stroke width
                </div>

                <div className="flex gap-2">
                  {STROKE_WIDTHS.map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => {
                        setStrokeWidth(w);
                        applyStyleToSelected({ stroke: w });
                      }}
                      className={`flex flex-1 items-center justify-center rounded-lg border px-2 py-2 ${
                        strokeWidth === w
                          ? "border-slate-900 bg-slate-50"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                      title={`${w}px`}
                    >
                      <div
                        className="w-7 rounded-full"
                        style={{ height: w, backgroundColor: strokeColor }}
                      />
                    </button>
                  ))}
                </div>

                <div className="mt-3 mb-2 text-[11px] font-semibold text-slate-500">
                  Fill (shapes only)
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFillColor(""); // apply hanya kalau selected element memang shape fillable
                      const sel = elements.find((e) => e?.id === selectedId);
                      if (sel && isFillableType(sel.type)) {
                        applyStyleToSelected({ fill: "" });
                      }
                    }}
                    className={`rounded-lg border px-2 py-1 text-xs ${
                      fillColor === ""
                        ? "border-slate-900 bg-slate-50"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                    title="No fill"
                  >
                    No
                  </button>

                  {STROKE_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setFillColor(c);
                        const sel = elements.find((e) => e?.id === selectedId);
                        if (sel && isFillableType(sel.type)) {
                          applyStyleToSelected({ fill: c });
                        }
                      }}
                      className={`h-6 w-6 rounded-full ring-2 ${
                        fillColor === c ? "ring-slate-900" : "ring-slate-200"
                      }`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>

                {!isFillableTool(currentTool) && (
                  <div className="mt-2 text-[11px] text-slate-400">
                    Fill only applies to Rectangle, Circle, Triangle.
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 rounded-2xl bg-slate-200 px-1 py-2 shadow">
            <ToolButton
              active={currentTool === ToolTypes.POINTER}
              onClick={() => {
                if (writingElementId) textAreaRef.current?.blur();
                setCurrentTool(ToolTypes.POINTER);
                setAction(ActionTypes.NONE);
                setShapeMenuOpen(false);
                setStyleOpen(false);
              }}
            >
              ▲
            </ToolButton>

            <ToolButton
              active={currentTool === ToolTypes.HAND}
              onClick={() => {
                setCurrentTool(ToolTypes.HAND);
                setAction(ActionTypes.NONE);
                setShapeMenuOpen(false);
                setStyleOpen(false);
              }}
            >
              ✋
            </ToolButton>

            <ToolButton
              active={currentTool === ToolTypes.PENCIL}
              onClick={() => {
                if (editDisabled) return;

                setCurrentTool(ToolTypes.PENCIL);
                setShapeMenuOpen(false);
                setStyleOpen(false);
              }}
            >
              ✏️
            </ToolButton>
            <ToolButton
              active={currentTool === ToolTypes.ERASER}
              onClick={() => {
                if (editDisabled) return;
                if (writingElementId) textAreaRef.current?.blur();
                setCurrentTool(ToolTypes.ERASER);
                setAction(ActionTypes.NONE);
                setShapeMenuOpen(false);
                setStyleOpen(false);
              }}
            >
              🧽
            </ToolButton>

            <div className="relative">
              <ToolButton
                active={isShapeTool(currentTool)}
                onClick={() => {
                  if (editDisabled) return;
                  setShapeMenuOpen((prev) => !prev);
                  setStyleOpen(false);
                }}
              >
                {getShapeIcon(currentTool)}
              </ToolButton>

              {shapeMenuOpen && (
                <div
                  className="absolute left-12 top-0 z-30 w-40 rounded-xl bg-white p-2 shadow-lg ring-1 ring-slate-900/10"
                  onMouseLeave={() => setShapeMenuOpen(false)}
                >
                  <button
                    className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"
                    onClick={() => {
                      setCurrentTool(ToolTypes.RECTANGLE);
                      setShapeMenuOpen(false);
                      setShapeMenuOpen(false);
                      setStyleOpen(false);
                    }}
                  >
                    ▢ Rectangle
                  </button>

                  <button
                    className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"
                    onClick={() => {
                      setCurrentTool(ToolTypes.CIRCLE);
                      setShapeMenuOpen(false);
                      setShapeMenuOpen(false);
                      setStyleOpen(false);
                    }}
                  >
                    ○ Circle
                  </button>

                  <button
                    className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"
                    onClick={() => {
                      setCurrentTool(ToolTypes.TRIANGLE);
                      setShapeMenuOpen(false);
                      setShapeMenuOpen(false);
                      setStyleOpen(false);
                    }}
                  >
                    △ Triangle
                  </button>

                  <button
                    className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"
                    onClick={() => {
                      setCurrentTool(ToolTypes.LINE);
                      setShapeMenuOpen(false);
                      setShapeMenuOpen(false);
                      setStyleOpen(false);
                    }}
                  >
                    ／ Line
                  </button>
                </div>
              )}
            </div>

            <ToolButton
              active={false}
              onClick={() => {
                if (editDisabled) return;

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
                  setShapeMenuOpen(false);
                  setStyleOpen(false);
                }
              }}
            >
              ⌫
            </ToolButton>

            <ToolButton
              active={currentTool === ToolTypes.TEXT}
              onClick={() => {
                setCurrentTool(ToolTypes.TEXT);
                setShapeMenuOpen(false);
                setStyleOpen(false);
              }}
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
