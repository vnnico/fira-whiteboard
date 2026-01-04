// utils/getSelectionHitPosition.js
import { CursorPosition, ToolTypes } from "../constant/constants";

function getBounds(el) {
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
  const x2 = el.x2 ?? el.x1;
  const y2 = el.y2 ?? el.y1;
  return { x1: el.x1 ?? 0, y1: el.y1 ?? 0, x2, y2 };
}

export function getSelectionHitPosition(el, x, y, pad = 8, handle = 10) {
  if (!el) return CursorPosition.OUTSIDE;

  const { x1, y1, x2, y2 } = getBounds(el);
  const left = Math.min(x1, x2) - pad;
  const right = Math.max(x1, x2) + pad;
  const top = Math.min(y1, y2) - pad;
  const bottom = Math.max(y1, y2) + pad;

  const inside = x >= left && x <= right && y >= top && y <= bottom;
  if (!inside) return CursorPosition.OUTSIDE;

  const near = (px, py) =>
    Math.abs(x - px) <= handle && Math.abs(y - py) <= handle;

  // handles (4 corners)
  if (near(left, top)) return CursorPosition.TOP_LEFT;
  if (near(right, top)) return CursorPosition.TOP_RIGHT;
  if (near(left, bottom)) return CursorPosition.BOTTOM_LEFT;
  if (near(right, bottom)) return CursorPosition.BOTTOM_RIGHT;

  if (el.type === ToolTypes.LINE) {
    return CursorPosition.INSIDE;
  }

  // (optional) edges
  if (Math.abs(x - left) <= handle) return CursorPosition.LEFT;
  if (Math.abs(x - right) <= handle) return CursorPosition.RIGHT;
  if (Math.abs(y - top) <= handle) return CursorPosition.TOP;
  if (Math.abs(y - bottom) <= handle) return CursorPosition.BOTTOM;

  return CursorPosition.INSIDE;
}
