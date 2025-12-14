import { ToolTypes } from "../constant/constants";

export function getElementBounds(el) {
  if (!el) return { x1: 0, y1: 0, x2: 0, y2: 0 };

  // pencil: bounds dari points
  if (el.type === ToolTypes.PENCIL && el.points?.length) {
    const xs = el.points.map((p) => p.x);
    const ys = el.points.map((p) => p.y);
    return {
      x1: Math.min(...xs),
      y1: Math.min(...ys),
      x2: Math.max(...xs),
      y2: Math.max(...ys),
    };
  }

  // default (text/rect/line)
  const x1 = el.x1 ?? 0;
  const y1 = el.y1 ?? 0;
  const x2 = el.x2 ?? x1;
  const y2 = el.y2 ?? y1;
  return { x1, y1, x2, y2 };
}

function drawSelectionBox(ctx, el, { color, showHandles }) {
  const { x1, y1, x2, y2 } = getElementBounds(el);
  const left = Math.min(x1, x2);
  const right = Math.max(x1, x2);
  const top = Math.min(y1, y2);
  const bottom = Math.max(y1, y2);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(left, top, right - left, bottom - top);
  ctx.setLineDash([]);

  // handles hanya untuk element yang memang kamu resize sekarang
  if (
    showHandles &&
    (el.type === ToolTypes.RECTANGLE ||
      el.type === ToolTypes.LINE ||
      el.type === ToolTypes.PENCIL)
  ) {
    const s = 8;
    const hs = s / 2;

    const pts = [
      { x: left, y: top },
      { x: right, y: top },
      { x: left, y: bottom },
      { x: right, y: bottom },
    ];

    for (const p of pts) {
      ctx.fillStyle = "white";
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(p.x - hs, p.y - hs, s, s);
      ctx.fill();
      ctx.stroke();
    }
  }

  ctx.restore();
}

export function drawSelectionOverlay(
  ctx,
  { elements, selectedId, locks, myUserId }
) {
  if (!ctx) return;

  // Remote selected (locked oleh user lain)
  for (const [id, owner] of Object.entries(locks || {})) {
    if (!id || !owner) continue;
    if (owner === myUserId) continue;

    const el = elements.find((e) => e?.id === id);
    if (el)
      drawSelectionBox(ctx, el, {
        color: "rgba(148,163,184,0.95)",
        showHandles: false,
      });
  }

  // Local selected
  if (selectedId) {
    const el = elements.find((e) => e?.id === selectedId);
    if (el)
      drawSelectionBox(ctx, el, {
        color: "rgba(59,130,246,0.95)",
        showHandles: true,
      });
  }
}
