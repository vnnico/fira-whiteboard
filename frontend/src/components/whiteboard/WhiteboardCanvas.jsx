import { useState, useRef, useEffect } from "react";
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

  const { showToast } = useToast();
  const navigate = useNavigate();

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

  useEffect(() => {
    // Fungsi penahan
    const handleBeforeUnload = (e) => {
      // Logic: Hanya aktifkan jika sedang ada koneksi penting
      // Contoh nanti: if (isVoiceConnected || hasUnsavedChanges)

      // Untuk sekarang, kita anggap masuk room = sesi penting
      e.preventDefault();
      e.returnValue = ""; // Trigger browser default warning: "Changes you made may not be saved."
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    // 2. Prevent Browser Back Button (History Trap)
    // Push state baru agar tombol back tidak langsung keluar, tapi mentok di sini dulu
    window.history.pushState(null, document.title, window.location.href);

    const handlePopState = (e) => {
      // Saat user tekan Back, event ini terpanggil
      // Munculkan konfirmasi native browser
      const confirmLeave = window.confirm("Changes you made may not be saved");

      if (confirmLeave) {
        // Jika user maksa keluar:
        // Bersihkan listener agar tidak looping
        window.removeEventListener("popstate", handlePopState);
        // Mundur beneran (atau ke dashboard)
        navigate("/");
      } else {
        // Jika user batal keluar:
        // Push state lagi untuk me-reset "jebakan" agar tombol back terkunci lagi
        window.history.pushState(null, document.title, window.location.href);
      }
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [navigate]);

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

  const handleShareLink = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      showToast(
        "Link copied to clipboard! Share it with your team.",
        "success"
      );
    } catch (err) {
      showToast("Failed to copy link", "error");
    }
  };

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

    const value = e.target.value; // Jangan di-trim total, user mungkin mau spasi di akhir
    const id = writingElementId;
    setWritingElementId(null);

    // Hapus jika kosong total
    if (!value.trim()) {
      setElements((prev) => prev.filter((el) => el.id !== id));
      return;
    }

    // Update element TEXT
    let finalElement = null;

    setElements((prev) =>
      prev.map((el) => {
        if (el.id !== id) return el;

        let x2 = el.x1;
        let y2 = el.y1;

        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext("2d");
          const FONT_SIZE = 24;
          const LINE_HEIGHT = 30;
          ctx.font = `${FONT_SIZE}px sans-serif`;

          const lines = value.split("\n");

          // Hitung Max Width
          let maxWidth = 0;
          lines.forEach((line) => {
            const width = ctx.measureText(line).width;
            if (width > maxWidth) maxWidth = width;
          });

          // Hitung Total Height
          const totalHeight = lines.length * LINE_HEIGHT;

          // Simpan bounding box yang akurat
          x2 = el.x1 + maxWidth;
          y2 = el.y1 + totalHeight;
        }

        // ... return finalElement
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

    // 1. Cari index elemen yang sedang diedit dari state 'elements' saat ini
    const index = elements.findIndex((el) => el.id === selectedId);
    if (index === -1) return;

    // 2. Lakukan kalkulasi finalisasi (Normalisasi koordinat)
    // Kita ambil elemen mentah, lalu olah
    const rawElement = elements[index];
    const finalElement = adjustElementCoordinates(rawElement);

    // 3. Update State Lokal dengan data yang SUDAH jadi
    setElements((prev) => {
      const updated = [...prev];
      updated[index] = finalElement; // Timpa dengan data yang sudah dihitung
      return updated;
    });

    // 4. Kirim ke Socket (Sekarang variabel finalElement pasti ada isinya)
    sendFinalElement(finalElement);

    // 5. Cleanup / Reset State
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

  return (
    <WhiteboardShell
      title="Untitled"
      roomId={roomId}
      handleShareLink={handleShareLink}
    >
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
            className="fixed-textarea" // Bisa pakai class CSS atau inline style di bawah
            style={{
              position: "absolute",
              top: writingElement.y1, // Hapus offset -3 biar presisi dulu
              left: writingElement.x1,
              font: "24px sans-serif",
              lineHeight: "30px", // PENTING: Harus match dengan drawElement
              margin: 0,
              padding: 0,
              border: 0,
              outline: 0,
              resize: "none",
              overflow: "hidden",
              whiteSpace: "pre", // Agar enter/spasi terbaca
              background: "transparent",
              zIndex: 30,
              minWidth: "50px",
              color: "#111827",
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
      className={`
        flex h-10 w-10 items-center justify-center rounded-xl text-sm
        border border-transparent
        transition-all duration-150
  
        ${active ? "bg-slate-900 text-slate-50" : "bg-slate-100 text-slate-700"}

        ring-0 ring-offset-2 ring-offset-slate-200

        hover:ring-2

        ${active ? "hover:ring-slate-900/80" : "hover:ring-slate-400/70"}

        hover:-translate-y-[1px] active:translate-y-0
      `}
    >
      {children}
    </button>
  );
}
