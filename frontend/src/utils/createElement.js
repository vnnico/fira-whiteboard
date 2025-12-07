// whiteboard/utils/createElement.js
import { ToolTypes } from "../constant/constants";

export function createElement({ id, type, x1, y1, x2, y2, text }) {
  const base = {
    id,
    type,
    stroke: "#111827", // slate-900
    strokeWidth: 2,
    seed: Math.floor(Math.random() * 2 ** 31), // untuk roughJS konsisten
  };

  if (type === ToolTypes.PENCIL) {
    return {
      ...base,
      points: [{ x: x1, y: y1 }],
    };
  }

  if (type === ToolTypes.TEXT) {
    // return {
    //   ...base,
    //   x1,
    //   y1,
    //   text: text ?? "",
    // };
    return {
      id,
      type,
      x1,
      y1,
      x2,
      y2,
      text: text || "",
    };
  }

  // RECTANGLE & LINE
  return {
    ...base,
    x1,
    y1,
    x2,
    y2,
  };
}
