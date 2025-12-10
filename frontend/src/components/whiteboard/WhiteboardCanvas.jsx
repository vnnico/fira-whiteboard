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

const CANVAS_SIZE = 8000;

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

  // For accessing zoom and pan
  const transformRef = useRef(null);
  // TEXT mode: simpan ID element TEXT yang sedang "ditulis"
  const [writingElementId, setWritingElementId] = useState(null);
  const textAreaRef = useRef(null);

  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [scale, setScale] = useState(1);

  const interactionRef = useRef({
    originX: 0,
    originY: 0,
    originalElement: null,
  });

  useEffect(() => {
    const handleWheel = (e) => {
      // Jika user menekan Ctrl (atau Meta di Mac) saat scroll
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault(); // disable zoom browser bawaan
      }
    };

    // supaya preventDefault bekerja
    window.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      window.removeEventListener("wheel", handleWheel);
    };
  }, []);

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = CANVAS_SIZE;
      canvas.height = CANVAS_SIZE;

      // Render awal
      const ctx = canvas.getContext("2d");
      drawElements(ctx, elements, locks, myUserId);
    }
  }, []); // Run once

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
    const rect = canvasRef.current.getBoundingClientRect();

    // buat Ambil scale, default ke 1 jika error/null/0
    let currentScale = transformRef.current?.instance.transformState.scale || 1;
    if (currentScale <= 0 || isNaN(currentScale)) currentScale = 1;

    return {
      x: (e.clientX - rect.left) / currentScale,
      y: (e.clientY - rect.top) / currentScale,
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
      e.stopPropagation();
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
      e.stopPropagation(); // agar wrapper tidak berpikir mau drag canvas

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

    // HAND (pan canvas) b
    // if (action === ActionTypes.NONE && currentTool === ToolTypes.HAND) {
    //   canvas.style.cursor = "grabbing";
    // }
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
      } else if (currentTool === ToolTypes.HAND) {
        canvas.style.cursor = "grab";
        // }
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

  // Shortcut
  const handleShortcutAction = useCallback(
    (action) => {
      switch (action) {
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
    [transformRef, setCurrentTool, setAction]
  );
  useKeyboardShortcuts(handleShortcutAction);

  const handleResetZoom = () => {
    if (transformRef.current) {
      // centerView(scale, duration, animationType)
      // Ini akan mereset zoom ke 1 (100%) DAN memusatkan view ke tengah canvas
      transformRef.current.centerView(1, 300, "easeOut");
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e) => {
      if (!transformRef.current) return;
      if (e.ctrlKey || e.metaKey) return; // Biarkan Ctrl+Scroll untuk Zoom

      e.preventDefault();
      e.stopPropagation();

      const { instance } = transformRef.current;
      const { scale, positionX, positionY } = instance.transformState;
      const wrapperRect = instance.wrapperComponent.getBoundingClientRect();

      // Tentukan Delta (Geser seberapa jauh)
      const scrollSpeed = 1;
      let deltaX = e.deltaX;
      let deltaY = e.deltaY;

      // Support Shift + Scroll untuk Horizontal Pan
      if (e.shiftKey && deltaY !== 0 && deltaX === 0) {
        deltaX = deltaY;
        deltaY = 0;
      }

      //  Hitung Calon Posisi Baru
      let newX = positionX - deltaX * scrollSpeed;
      let newY = positionY - deltaY * scrollSpeed;

      // Clamping manual
      // Ukuran Wrapper (Jendela Tampilan)
      const wrapperWidth = wrapperRect.width;
      const wrapperHeight = wrapperRect.height;

      // Ukuran Canvas saat ini (Original * Scale)
      const contentWidth = CANVAS_SIZE * scale;
      const contentHeight = CANVAS_SIZE * scale;

      // A. Hitung Batas Bawah (Minimum X/Y)
      // Rumus: Jendela - Konten.
      // Jika konten lebih besar dari jendela, hasilnya minus (artinya batas geser kiri/atas).
      // Jika konten lebih kecil (zoom out jauh), hasilnya positif.
      const minX = wrapperWidth - contentWidth;
      const minY = wrapperHeight - contentHeight;

      // B. Hitung Batas Atas (Maksimum X/Y)
      // Biasanya 0. Tapi jika konten lebih kecil dari jendela, kita mau dia mentok di 0 (kiri)
      // atau logika lain. Default library biasanya max 0.
      const maxX = 0;
      const maxY = 0;

      // C. Terapkan Pagar
      // Jika Konten > Wrapper (Normal Zoom):
      //    newX tidak boleh > 0 (agar gak bolong kiri)
      //    newX tidak boleh < minX (agar gak bolong kanan)

      // Safety Check: Hanya clamp jika konten memang lebih besar dari wrapper
      if (contentWidth > wrapperWidth) {
        newX = Math.min(maxX, Math.max(minX, newX));
      } else {
        // Jika konten kekecilan (Zoom Out ekstrem), paksa tengah atau kiri (0)
        // Pilih 0 biar konsisten dengan limitToBounds library
        newX = (wrapperWidth - contentWidth) / 2; // Opsi A: Center
        // newX = 0; // Opsi B: Pojok Kiri
      }

      if (contentHeight > wrapperHeight) {
        newY = Math.min(maxY, Math.max(minY, newY));
      } else {
        newY = (wrapperHeight - contentHeight) / 2; // Center Vertikal
      }

      transformRef.current.setTransform(newX, newY, scale, 0);
    };

    container.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      container.removeEventListener("wheel", onWheel);
    };
  }, [CANVAS_SIZE]);
  return (
    <div
      ref={containerRef}
      className="relative h-full w-full bg-slate-50 overflow-hidden"
    >
      <TransformWrapper
        ref={transformRef}
        initialScale={1}
        minScale={0.1}
        maxScale={10}
        centerOnInit={true} // otomatis tengah
        limitToBounds={true} // geser infinitely
        //  Matikan Panning kalau user sedang TIDAK pegang Hand Tool
        // Agar user bisa draw (Pencil) tanpa canvasnya ikut geser
        panning={{
          disabled: currentTool !== ToolTypes.HAND,
          velocityDisabled: false,
          velocityAnimation: {
            sensitivity: 0.5, // Default biasanya 1, Turunkan biar gak gampang "terlempar" jauh.
            animationTime: 250, // Default ribuan ms. Set pendek (200-300ms) biar cepat berhenti.
            animationType: "easeOutQuart", // Tipe rem yang halus tapi tegas di akhir.
          },
        }}
        wheel={{
          step: 0.05,
          smoothStep: 0.002,
          activationKeys: ["Control", "Meta"],
        }} // Zoom pakai scroll mouse
        doubleClick={{ disabled: true }}
        onTransformed={(instance) => {
          setScale(instance.state.scale);
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
            />

            {writingElement && (
              <textarea
                ref={textAreaRef}
                onBlur={handleTextareaBlur}
                style={{
                  position: "absolute",
                  top: writingElement.y1,
                  left: writingElement.x1,
                  font: "24px sans-serif",
                  lineHeight: "30px",
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
                  color: "#111827",
                }}
              />
            )}
            <CursorOverlay cursors={cursors} />
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
              {Math.max(10, Math.round(scale * 100))}%{" "}
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
        e.currentTarget.blur(); // lepas focus setelah klik biar ga ad border sisa
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
