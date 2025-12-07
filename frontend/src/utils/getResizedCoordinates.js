// whiteboard/utils/getResizedCoordinates.js
import { CursorPosition, ToolTypes } from "../constant/constants";

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

  // LINE: hanya dua titik (start/end)
  if (type === ToolTypes.LINE) {
    if (position === CursorPosition.TOP_LEFT) {
      return { x1: mouseX, y1: mouseY, x2, y2 };
    }
    if (position === CursorPosition.BOTTOM_RIGHT) {
      return { x1, y1, x2: mouseX, y2: mouseY };
    }
    return { x1, y1, x2, y2 };
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
