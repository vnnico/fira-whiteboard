// whiteboard/utils/getElementAtPosition.js
import { CursorPosition, ToolTypes } from "../constant/constants";

function distance(p1, p2) {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

function isPointNearLine(x, y, x1, y1, x2, y2, threshold = 6) {
  const A = x - x1;
  const B = y - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  const param = lenSq !== 0 ? dot / lenSq : -1;

  let xx, yy;
  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = x - xx;
  const dy = y - yy;
  return Math.hypot(dx, dy) <= threshold;
}

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
  return {
    x1: el.x1 ?? 0,
    y1: el.y1 ?? 0,
    x2: el.x2 ?? el.x1 ?? 0,
    y2: el.y2 ?? el.y1 ?? 0,
  };
}

function positionWithinRectangle(x, y, el) {
  const { x1, y1, x2, y2 } = getBounds(el);
  const left = Math.min(x1, x2);
  const right = Math.max(x1, x2);
  const top = Math.min(y1, y2);
  const bottom = Math.max(y1, y2);

  const inside = x >= left && x <= right && y >= top && y <= bottom;
  if (!inside) return CursorPosition.OUTSIDE;

  const offset = 6;
  const nearLeft = Math.abs(x - left) <= offset;
  const nearRight = Math.abs(x - right) <= offset;
  const nearTop = Math.abs(y - top) <= offset;
  const nearBottom = Math.abs(y - bottom) <= offset;

  if (nearLeft && nearTop) return CursorPosition.TOP_LEFT;
  if (nearRight && nearTop) return CursorPosition.TOP_RIGHT;
  if (nearLeft && nearBottom) return CursorPosition.BOTTOM_LEFT;
  if (nearRight && nearBottom) return CursorPosition.BOTTOM_RIGHT;

  if (nearLeft) return CursorPosition.LEFT;
  if (nearRight) return CursorPosition.RIGHT;
  if (nearTop) return CursorPosition.TOP;
  if (nearBottom) return CursorPosition.BOTTOM;

  return CursorPosition.INSIDE;
}

function positionWithinLine(x, y, el) {
  const { x1, y1, x2, y2 } = getBounds(el);
  const threshold = 6;

  const start = { x: x1, y: y1 };
  const end = { x: x2, y: y2 };
  const point = { x, y };

  if (distance(point, start) <= threshold) return CursorPosition.TOP_LEFT;
  if (distance(point, end) <= threshold) return CursorPosition.BOTTOM_RIGHT;
  if (isPointNearLine(x, y, x1, y1, x2, y2, threshold)) {
    return CursorPosition.INSIDE;
  }
  return CursorPosition.OUTSIDE;
}

function positionWithinPencil(x, y, el) {
  if (!el.points?.length) return CursorPosition.OUTSIDE;
  const threshold = 6;
  for (let i = 0; i < el.points.length - 1; i++) {
    const p1 = el.points[i];
    const p2 = el.points[i + 1];
    if (isPointNearLine(x, y, p1.x, p1.y, p2.x, p2.y, threshold)) {
      return CursorPosition.INSIDE;
    }
  }
  return CursorPosition.OUTSIDE;
}

export function getElementAtPosition(elements, x, y) {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (!el) continue;

    let position = CursorPosition.OUTSIDE;

    if (el.type === ToolTypes.RECTANGLE) {
      position = positionWithinRectangle(x, y, el);
    } else if (el.type === ToolTypes.LINE) {
      position = positionWithinLine(x, y, el);
    } else if (el.type === ToolTypes.PENCIL) {
      position = positionWithinPencil(x, y, el);
    } else if (el.type === ToolTypes.TEXT) {
      // 1. Pastikan x2/y2 valid (fallback ke x1/y1 jika belum ada)
      const x2 = el.x2 ?? el.x1;
      const y2 = el.y2 ?? el.y1;

      // 2. Hitung Bounds dengan Buffer (misal 6px) agar mudah diklik
      const pad = 6;
      const inside =
        x >= el.x1 - pad && x <= x2 + pad && y >= el.y1 - pad && y <= y2 + pad;

      // 3. FORCE RETURN INSIDE. Jangan return corner (TOP_LEFT dsb)
      // karena logika resize text belum ada, nanti malah macet.
      position = inside ? CursorPosition.INSIDE : CursorPosition.OUTSIDE;
    }

    if (position !== CursorPosition.OUTSIDE) {
      return { element: el, position };
    }
  }

  return { element: null, position: CursorPosition.OUTSIDE };
}
