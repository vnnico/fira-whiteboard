import { ToolTypes } from "../constant/constants";

export function createElement({
  id,
  type,
  x1,
  y1,
  x2,
  y2,
  text,
  stroke,
  strokeWidth,
  fill,
}) {
  const base = {
    id,
    type,
    stroke: stroke || "#111827", // slate-900
    strokeWidth: typeof strokeWidth === "number" ? strokeWidth : 2,
    fill: fill || "",
    seed: Math.floor(Math.random() * 2 ** 31), // untuk roughJS konsisten
  };

  if (type === ToolTypes.PENCIL) {
    return {
      ...base,
      points: [{ x: x1, y: y1 }],
    };
  }

  if (type === ToolTypes.TEXT) {
    return {
      id,
      type,
      base,
      x1,
      y1,
      x2,
      y2,
      text: text ?? "",
      stroke: base.stroke,
      strokeWidth: base.strokeWidth,
      seed: base.seed,
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
