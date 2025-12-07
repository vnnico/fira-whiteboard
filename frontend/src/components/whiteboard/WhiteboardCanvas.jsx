import React, { useState, useRef, useEffect } from "react";
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

export default function WhiteboardCanvas({ roomId }) {
  const {
    elements,
    setElements,
    locks,
    cursors,
    myUserId,
    sendDraftElement,
    sendFinalElement,
    sendCursor,
    lockElement,
    unlockElement,
    clearBoard,
  } = useWhiteboard(roomId);

  const [collapsed, setCollapsed] = useState(false);
  const [currentTool, setCurrentTool] = useState(ToolTypes.POINTER);
  const [action, setAction] = useState(ActionTypes.NONE);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedPosition, setSelectedPosition] = useState(
    CursorPosition.OUTSIDE
  );

  // TEXT mode: simpan ID element TEXT yang sedang "ditulis"
  const [writingElementId, setWritingElementId] = useState(null);
  const textAreaRef = useRef(null);

  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  const interactionRef = useRef({
    originX: 0,
    originY: 0,
    originalElement: null,
  });

  // Auto focus textarea ketika muncul
  useEffect(() => {
    if (writingElementId && textAreaRef.current) {
      textAreaRef.current.focus();
    }
  }, [writingElementId]);

  // Resize canvas terhadap container
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawElements(ctx, elements, locks, myUserId);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [elements, locks, myUserId]);

  // Redraw ketika elements / locks berubah
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawElements(ctx, elements, locks, myUserId);
  }, [elements, locks, myUserId]);

  const getRelativePos = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  // ===== TEXT: commit/cancel  =====
  const handleTextareaBlur = (e) => {
    if (!writingElementId) return;

    const value = e.target.value.trim();
    const id = writingElementId;
    setWritingElementId(null);

    // Jika kosong → hapus placeholder TEXT
    if (!value) {
      setElements((prev) => prev.filter((el) => el.id !== id));
      return;
    }

    // Update element TEXT yang sudah ada
    let finalElement = null;

    setElements((prev) =>
      prev.map((el) => {
        if (el.id !== id) return el;

        // Hitung width/height text seperti reference
        let x2 = el.x2 ?? el.x1;
        let y2 = el.y2 ?? el.y1;
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext("2d");
          ctx.font = "24px sans-serif";
          const textWidth = ctx.measureText(value).width;
          const textHeight = 24; // mengikuti reference
          x2 = el.x1 + textWidth;
          y2 = el.y1 + textHeight;
        }

        finalElement = {
          ...el,
          text: value,
          x2,
          y2,
        };
        return finalElement;
      })
    );

    if (finalElement) {
      sendFinalElement(finalElement);
    }
  };

  // ===== MOUSE DOWN =====
  const handleMouseDown = (e) => {
    const { x, y } = getRelativePos(e);
    interactionRef.current.originX = x;
    interactionRef.current.originY = y;

    // === TEXT TOOL ===
    if (currentTool === ToolTypes.TEXT) {
      // Kalau sedang menulis text lain, jangan mulai yang baru
      if (writingElementId) return;

      const id = crypto.randomUUID();

      // 1) Buat placeholder element TEXT (text masih kosong)
      const element = createElement({
        id,
        type: ToolTypes.TEXT,
        x1: x,
        y1: y,
        x2: x,
        y2: y,
        text: "",
      });

      setElements((prev) => [...prev, element]);
      // 2) Simpan ID untuk dipakai render textarea
      setWritingElementId(id);
      return;
    }

    // === TOOLS SHAPE (RECT / LINE / PENCIL) ===
    if (
      currentTool === ToolTypes.RECTANGLE ||
      currentTool === ToolTypes.LINE ||
      currentTool === ToolTypes.PENCIL
    ) {
      const id = crypto.randomUUID();
      const element = createElement({
        id,
        type: currentTool,
        x1: x,
        y1: y,
        x2: x,
        y2: y,
      });

      interactionRef.current.originalElement = element;
      setSelectedId(id);
      setSelectedPosition(CursorPosition.INSIDE);
      setAction(ActionTypes.DRAWING);

      setElements((prev) => [...prev, element]);
      sendDraftElement(element);
      return;
    }

    // === POINTER (selection) ===
    if (currentTool === ToolTypes.POINTER) {
      const { element, position } = getElementAtPosition(elements, x, y);

      if (!element) {
        setSelectedId(null);
        setSelectedPosition(CursorPosition.OUTSIDE);
        setAction(ActionTypes.NONE);
        return;
      }

      // locked oleh user lain
      if (locks[element.id] && locks[element.id] !== myUserId) {
        setSelectedId(element.id);
        setSelectedPosition(position);
        setAction(ActionTypes.NONE);
        return;
      }

      interactionRef.current.originalElement = {
        ...element,
        points: element.points
          ? element.points.map((p) => ({ ...p }))
          : undefined,
      };

      setSelectedId(element.id);
      setSelectedPosition(position);

      if (position === CursorPosition.INSIDE) {
        setAction(ActionTypes.MOVING);
      } else {
        setAction(ActionTypes.RESIZING);
      }

      lockElement(element.id);
      return;
    }

    // HAND (pan canvas) belum diimplementasi
  };

  // ===== MOUSE MOVE =====
  const handleMouseMove = (e) => {
    const { x, y } = getRelativePos(e);
    sendCursor(x, y);

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Kalau tidak sedang drag / resize
    if (action === ActionTypes.NONE) {
      if (currentTool === ToolTypes.POINTER) {
        const { position } = getElementAtPosition(elements, x, y);
        canvas.style.cursor = getCursorForPosition(position);
      } else if (currentTool === ToolTypes.TEXT) {
        canvas.style.cursor = "text";
      } else {
        canvas.style.cursor = "crosshair";
      }
      return;
    }

    if (!selectedId || !interactionRef.current.originalElement) return;

    const { originX, originY, originalElement } = interactionRef.current;

    // DRAWING
    if (action === ActionTypes.DRAWING) {
      setElements((prev) => {
        const { elements: updated, element: updatedElement } = updateElement(
          prev,
          selectedId,
          (el) => {
            if (el.type === ToolTypes.PENCIL) {
              return {
                ...el,
                points: [...(el.points || []), { x, y }],
              };
            }
            return { ...el, x2: x, y2: y };
          }
        );
        if (updatedElement) sendDraftElement(updatedElement);
        return updated;
      });
      return;
    }

    // MOVING
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

    // RESIZING
    if (action === ActionTypes.RESIZING) {
      setElements((prev) => {
        const { elements: updated, element: updatedElement } = updateElement(
          prev,
          selectedId,
          (el) => {
            if (el.type !== ToolTypes.RECTANGLE && el.type !== ToolTypes.LINE) {
              return el;
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

  // ===== FINISH INTERACTION (untuk shape, bukan TEXT) =====
  const finishInteraction = () => {
    if (!selectedId) {
      setAction(ActionTypes.NONE);
      return;
    }

    let finalElement = null;

    setElements((prev) => {
      const { elements: updated, element } = updateElement(
        prev,
        selectedId,
        (el) => adjustElementCoordinates(el)
      );
      finalElement = element;
      return updated;
    });

    if (finalElement) {
      sendFinalElement(finalElement);
    }

    unlockElement(selectedId);
    setSelectedId(null);
    setSelectedPosition(CursorPosition.OUTSIDE);
    setAction(ActionTypes.NONE);

    const canvas = canvasRef.current;
    if (canvas) canvas.style.cursor = "crosshair";
  };

  const handleMouseUp = () => {
    if (action !== ActionTypes.NONE) finishInteraction();
  };

  const handleMouseLeave = () => {
    if (action !== ActionTypes.NONE) finishInteraction();
  };

  // Element TEXT yang sedang ditulis (kalau ada)
  const writingElement = writingElementId
    ? elements.find((el) => el.id === writingElementId)
    : null;

  // ===== RENDER =====
  return (
    <WhiteboardShell title="Untitled">
      <div ref={containerRef} className="relative h-full w-full">
        {/* Canvas utama */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full bg-slate-50"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        />

        {/* TEXTAREA overlay (ala reference) */}
        {writingElement && (
          <textarea
            ref={textAreaRef}
            onBlur={handleTextareaBlur}
            style={{
              position: "absolute",
              top: writingElement.y1 - 3,
              left: writingElement.x1,
              font: "24px sans-serif",
              margin: 0,
              padding: 0,
              border: 0,
              outline: 0,
              resize: "none",
              overflow: "hidden",
              whiteSpace: "pre",
              background: "transparent",
              zIndex: 30,
              minWidth: "50px",
            }}
          />
        )}

        {/* Tombol collapse toolbar */}
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="absolute left-1 top-1/2 z-20 -translate-y-1/2 rounded-full bg-slate-900 px-[5px] py-[3px] text-xs text-slate-50 shadow"
        >
          {collapsed ? <FiChevronRight /> : <FiChevronLeft />}
        </button>

        {/* Toolbar kiri */}
        <div
          className={`absolute left-4 top-1/2 z-10 -translate-y-1/2 transition-all duration-200 ${
            collapsed
              ? "-translate-x-16 opacity-0 pointer-events-none"
              : "translate-x-0 opacity-100"
          }`}
        >
          <div className="ms-2 flex flex-col items-center gap-4">
            {/* Clock */}
            <button className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-200 text-sm text-slate-700 shadow">
              ⏱
            </button>

            {/* Tools */}
            <div className="flex flex-col gap-2 rounded-2xl bg-slate-200 px-1 py-2 shadow">
              <ToolButton
                active={currentTool === ToolTypes.POINTER}
                onClick={() => {
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
                onClick={() => setCurrentTool(ToolTypes.PENCIL)}
              >
                ✏️
              </ToolButton>

              <ToolButton
                active={currentTool === ToolTypes.RECTANGLE}
                onClick={() => setCurrentTool(ToolTypes.RECTANGLE)}
              >
                ▢
              </ToolButton>

              <ToolButton
                active={currentTool === ToolTypes.LINE}
                onClick={() => setCurrentTool(ToolTypes.LINE)}
              >
                ／
              </ToolButton>

              {/* Eraser = clear board */}
              <ToolButton
                active={false}
                onClick={() => {
                  setWritingElementId(null);
                  clearBoard(true);
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

            {/* Zoom */}
            <div className="flex flex-col gap-2 rounded-2xl bg-slate-200 px-1 py-2 shadow">
              <button className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-lg text-slate-800">
                +
              </button>
              <button className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-lg text-slate-800">
                –
              </button>
            </div>
          </div>
        </div>

        {/* Voice & Chat buttons */}
        <div className="absolute bottom-6 right-6 z-10 flex items-center gap-2 rounded-2xl bg-slate-200/90 px-3 py-2 shadow">
          <button className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-slate-50">
            <FiMic />
          </button>
          <button className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-slate-50">
            <FiMessageSquare />
          </button>
        </div>

        {/* Cursor user lain */}
        <CursorOverlay cursors={cursors} />
      </div>
    </WhiteboardShell>
  );
}

function ToolButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm transition-colors ${
        active ? "bg-slate-900 text-slate-50" : "bg-slate-100 text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}
