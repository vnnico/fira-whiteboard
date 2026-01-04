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

function drawLockBadge(ctx, left, top, label) {
  const text = label && String(label).trim() ? String(label).trim() : "Locked";

  ctx.save();
  ctx.font = "12px sans-serif";

  const paddingX = 6;
  const paddingY = 3;
  const metrics = ctx.measureText(text);
  const w = Math.ceil(metrics.width + paddingX * 2);
  const h = 18;

  // posisi di atas kiri box (jangan sampai minus)
  let x = left;
  let y = top - (h + 6);
  if (y < 2) y = 2;

  ctx.fillStyle = "rgba(239,68,68,0.95)";
  ctx.beginPath();
  const r = 8;
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "white";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + paddingX, y + h / 2);

  ctx.restore();
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

  if (
    showHandles &&
    (el.type === ToolTypes.RECTANGLE ||
      el.type === ToolTypes.LINE ||
      el.type === ToolTypes.CIRCLE ||
      el.type === ToolTypes.TRIANGLE ||
      el.type === ToolTypes.PENCIL ||
      el.type === ToolTypes.TEXT)
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
  { elements, selectedId, locks, myUserId, userNameById }
) {
  if (!ctx) return;

  // Remote selected (locked oleh user lain)
  for (const [id, owner] of Object.entries(locks || {})) {
    if (!id || !owner) continue;
    if (owner === myUserId) continue;

    const el = elements.find((e) => e?.id === id);
    if (!el) continue;

    drawSelectionBox(ctx, el, {
      color: "rgba(239,68,68,0.95)",
      showHandles: false,
    });

    const b = getElementBounds(el);
    const left = Math.min(b.x1, b.x2);
    const top = Math.min(b.y1, b.y2);

    const name =
      userNameById && userNameById[String(owner)]
        ? userNameById[String(owner)]
        : null;

    const shortName = name
      ? String(name).split(" ").slice(0, 2).join(" ")
      : "Someone";
    drawLockBadge(ctx, left, top, "Edited by " + shortName);
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
