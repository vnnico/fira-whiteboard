// whiteboard/utils/adjustElementCoordinates.js
import { ToolTypes } from "../constant/constants";

/**
 * Normalisasi koordinat hanya untuk RECTANGLE.
 * LINE, PENCIL, TEXT tetap apa adanya.
 */
export function adjustElementCoordinates(element) {
  if (!element) return element;

  if (element.type === ToolTypes.RECTANGLE) {
    const x1 = Math.min(element.x1, element.x2);
    const x2 = Math.max(element.x1, element.x2);
    const y1 = Math.min(element.y1, element.y2);
    const y2 = Math.max(element.y1, element.y2);
    return { ...element, x1, y1, x2, y2 };
  }

  return element;
}
