// whiteboard/utils/getResizedCoordinates.js
import { CursorPosition, ToolTypes } from "../constant/constants";

const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

function getPencilBoundsFromPoints(points) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x1 = Math.min(...xs);
  const y1 = Math.min(...ys);
  const x2 = Math.max(...xs);
  const y2 = Math.max(...ys);
  return { x1, y1, x2, y2 };
}
/**
 * Hitung koordinat baru saat resize.
 * original: { x1,y1,x2,y2 } snapshot sebelum drag.
 */
export function getResizedCoordinates({
  type,
  position,
  original,
  mouseX,
  mouseY,
}) {
  const { x1, y1, x2, y2 } = original;

  // caranya: corner yang didrag akan menggerakkan endpoint yang PALING DEKAT ke corner tsb
  if (type === ToolTypes.LINE) {
    const left = Math.min(x1, x2);
    const right = Math.max(x1, x2);
    const top = Math.min(y1, y2);
    const bottom = Math.max(y1, y2);

    let cx = null;
    let cy = null;

    if (position === CursorPosition.TOP_LEFT) {
      cx = left;
      cy = top;
    } else if (position === CursorPosition.TOP_RIGHT) {
      cx = right;
      cy = top;
    } else if (position === CursorPosition.BOTTOM_LEFT) {
      cx = left;
      cy = bottom;
    } else if (position === CursorPosition.BOTTOM_RIGHT) {
      cx = right;
      cy = bottom;
    } else {
      // selain corner: jangan resize line
      return { x1, y1, x2, y2 };
    }

    const d1 = dist(x1, y1, cx, cy);
    const d2 = dist(x2, y2, cx, cy);

    // endpoint yg lebih dekat ke corner = yang akan dipindah
    if (d1 <= d2) {
      return { x1: mouseX, y1: mouseY, x2, y2 };
    }
    return { x1, y1, x2: mouseX, y2: mouseY };
  }

  // PENCIL
  if (type === ToolTypes.PENCIL) {
    const pts = original?.points || [];
    if (pts.length < 2) return {};

    const ob = getPencilBoundsFromPoints(pts);

    // old bounds (positive width/height)
    const oLeft = ob.x1;
    const oTop = ob.y1;
    const oRight = ob.x2;
    const oBottom = ob.y2;

    const oW = Math.max(1, oRight - oLeft);
    const oH = Math.max(1, oBottom - oTop);

    // new bounds start from old bounds
    let nLeft = oLeft;
    let nTop = oTop;
    let nRight = oRight;
    let nBottom = oBottom;

    switch (position) {
      case CursorPosition.TOP_LEFT:
        nLeft = mouseX;
        nTop = mouseY;
        break;
      case CursorPosition.TOP_RIGHT:
        nRight = mouseX;
        nTop = mouseY;
        break;
      case CursorPosition.BOTTOM_LEFT:
        nLeft = mouseX;
        nBottom = mouseY;
        break;
      case CursorPosition.BOTTOM_RIGHT:
        nRight = mouseX;
        nBottom = mouseY;
        break;

      case CursorPosition.LEFT:
        nLeft = mouseX;
        break;
      case CursorPosition.RIGHT:
        nRight = mouseX;
        break;
      case CursorPosition.TOP:
        nTop = mouseY;
        break;
      case CursorPosition.BOTTOM:
        nBottom = mouseY;
        break;

      default:
        // INSIDE/outside bukan resize
        return {};
    }

    // normalize new bounds (biar gak aneh kalau user “nyebrang”)
    const nnLeft = Math.min(nLeft, nRight);
    const nnRight = Math.max(nLeft, nRight);
    const nnTop = Math.min(nTop, nBottom);
    const nnBottom = Math.max(nTop, nBottom);

    const nW = Math.max(1, nnRight - nnLeft);
    const nH = Math.max(1, nnBottom - nnTop);

    const sX = nW / oW;
    const sY = nH / oH;

    const newPoints = pts.map((p) => ({
      x: nnLeft + (p.x - oLeft) * sX,
      y: nnTop + (p.y - oTop) * sY,
    }));

    //  simpan juga bbox baru
    return {
      points: newPoints,
      x1: nnLeft,
      y1: nnTop,
      x2: nnRight,
      y2: nnBottom,
    };
  }

  // RECTANGLE
  let nx1 = x1;
  let ny1 = y1;
  let nx2 = x2;
  let ny2 = y2;

  switch (position) {
    case CursorPosition.TOP_LEFT:
      nx1 = mouseX;
      ny1 = mouseY;
      break;
    case CursorPosition.TOP_RIGHT:
      nx2 = mouseX;
      ny1 = mouseY;
      break;
    case CursorPosition.BOTTOM_LEFT:
      nx1 = mouseX;
      ny2 = mouseY;
      break;
    case CursorPosition.BOTTOM_RIGHT:
      nx2 = mouseX;
      ny2 = mouseY;
      break;
    case CursorPosition.LEFT:
      nx1 = mouseX;
      break;
    case CursorPosition.RIGHT:
      nx2 = mouseX;
      break;
    case CursorPosition.TOP:
      ny1 = mouseY;
      break;
    case CursorPosition.BOTTOM:
      ny2 = mouseY;
      break;
    default:
      break;
  }

  return { x1: nx1, y1: ny1, x2: nx2, y2: ny2 };
}
