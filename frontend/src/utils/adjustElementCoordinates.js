import { ToolTypes } from "../constant/constants";

/**
 * - RECTANGLE/TRIANGLE: memastikan x1<=x2 dan y1<=y2
 * - CIRCLE: memastikan bounding box square (w === h) + normalisasi
 *
 * LINE, PENCIL, TEXT tetap apa adanya.
 */
export function adjustElementCoordinates(element) {
  if (!element) return element;

  if (
    element.type !== ToolTypes.RECTANGLE &&
    element.type !== ToolTypes.CIRCLE &&
    element.type !== ToolTypes.TRIANGLE
  ) {
    return element;
  }

  let { x1, y1, x2, y2 } = element;

  // Untuk circle: paksa w==h (pakai max dari |dx| dan |dy|)
  if (element.type === ToolTypes.CIRCLE) {
    const x1 = element.x1 ?? 0;
    const y1 = element.y1 ?? 0;
    const x2 = element.x2 ?? x1;
    const y2 = element.y2 ?? y1;

    const dx = x2 - x1;
    const dy = y2 - y1;

    const signX = dx === 0 ? 1 : Math.sign(dx);
    const signY = dy === 0 ? 1 : Math.sign(dy);

    const d = Math.max(Math.abs(dx), Math.abs(dy)) || 1;

    const nx2 = x1 + signX * d;
    const ny2 = y1 + signY * d;

    const minX = Math.min(x1, nx2);
    const maxX = Math.max(x1, nx2);
    const minY = Math.min(y1, ny2);
    const maxY = Math.max(y1, ny2);

    return { ...element, x1: minX, y1: minY, x2: maxX, y2: maxY };
  }

  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);

  return { ...element, x1: minX, y1: minY, x2: maxX, y2: maxY };
}
