// whiteboard/utils/drawElement.js
import rough from "roughjs/bundled/rough.esm.js";
import { getStroke } from "perfect-freehand";
import { ToolTypes } from "../constant/constants";
import { getSvgPathFromStroke } from "./getSvgPathFromStroke";

const FONT_SIZE = 24;
const LINE_HEIGHT = 30; // Sedikit lebih besar dari font size (1.25x)

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

function drawLockLabel(ctx, element) {
  const { x1, y1 } = getBounds(element);
  ctx.save();
  ctx.fillStyle = "#ef4444";
  ctx.font = "10px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText("Editing...", x1 + 4, y1 - 4);
  ctx.restore();
}

export function drawElement(ctx, roughCanvas, element, opts = {}) {
  if (!element) return;

  const strokeColor = opts.strokeColor ?? element.stroke ?? "#111827";
  const seed = element.seed ?? 0;

  if (element.type === ToolTypes.RECTANGLE) {
    const { x1, y1, x2, y2 } = getBounds(element);
    roughCanvas.rectangle(x1, y1, x2 - x1, y2 - y1, {
      stroke: strokeColor,
      strokeWidth: element.strokeWidth ?? 2,
      seed,
    });
    return;
  }

  if (element.type === ToolTypes.LINE) {
    const { x1, y1, x2, y2 } = getBounds(element);
    roughCanvas.line(x1, y1, x2, y2, {
      stroke: strokeColor,
      strokeWidth: element.strokeWidth ?? 2,
      seed,
    });
    return;
  }

  if (element.type === ToolTypes.PENCIL && element.points?.length) {
    const strokePoints = getStroke(
      element.points.map((p) => [p.x, p.y]),
      {
        size: element.strokeWidth ?? 2,
        thinning: 0.5,
        smoothing: 0.6,
        streamline: 0.4,
      }
    );
    const pathData = getSvgPathFromStroke(strokePoints, false);
    const path = new Path2D(pathData);

    ctx.save();
    ctx.fillStyle = strokeColor;
    ctx.fill(path);
    ctx.restore();
    return;
  }

  if (element.type === ToolTypes.TEXT && element.text) {
    ctx.textBaseline = "top";
    ctx.font = `${FONT_SIZE}px sans-serif`;
    ctx.fillStyle = opts.strokeColor || "#111827"; // Gunakan warna dinamis

    // LOGIC BARU: Multiline Support
    const lines = element.text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      // Render per baris
      ctx.fillText(lines[i], element.x1, element.y1 + i * LINE_HEIGHT);
    }
  }
}

export function drawElements(ctx, elements, locks = {}, myUserId) {
  if (!ctx || !elements) return;
  const roughCanvas = rough.canvas(ctx.canvas);

  elements.forEach((el) => {
    if (!el) return;
    const lockedByOther = locks[el.id] && locks[el.id] !== myUserId;
    const strokeColor = lockedByOther ? "#ef4444" : el.stroke || "#111827";

    drawElement(ctx, roughCanvas, el, { strokeColor });

    if (lockedByOther) {
      drawLockLabel(ctx, el);
    }
  });
}
