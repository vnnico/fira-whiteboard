import rough from "roughjs/bundled/rough.esm.js";
import { getStroke } from "perfect-freehand";
import { ToolTypes } from "../constant/constants";
import { getSvgPathFromStroke } from "./getSvgPathFromStroke";

const FONT_SIZE = 24;
const LINE_HEIGHT = 30; // Sedikit lebih besar dari font size (1.25x)

// Cache rough canvas untuk hindari create ulang tiap redraw
const roughCanvasCache = new WeakMap();

function getRoughCanvas(ctx) {
  const canvas = ctx?.canvas;
  if (!canvas) return rough.canvas(ctx.canvas);

  let rc = roughCanvasCache.get(canvas);
  if (!rc) {
    rc = rough.canvas(canvas);
    roughCanvasCache.set(canvas, rc);
    console.log("[WB] roughCanvas created for canvas");
  }
  return rc;
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

function drawLockLabel(ctx, element) {
  const { x1, y1 } = getBounds(element);
  ctx.save();
  ctx.fillStyle = "#ef4444";
  ctx.font = "10px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
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
      fill: element.fill ? element.fill : undefined,
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

    // x2/y2 hasil normalisasi (square)
    const nx2 = x1 + signX * d;
    const ny2 = y1 + signY * d;

    const left = Math.min(x1, nx2);
    const right = Math.max(x1, nx2);
    const top = Math.min(y1, ny2);
    const bottom = Math.max(y1, ny2);

    const cx = (left + right) / 2;
    const cy = (top + bottom) / 2;

    roughCanvas.circle(cx, cy, d, {
      stroke: strokeColor,
      strokeWidth: element.strokeWidth ?? 2,
      seed,
      fill: element.fill ? element.fill : undefined,
    });
  }

  if (element.type === ToolTypes.TRIANGLE) {
    const left = Math.min(element.x1, element.x2);
    const right = Math.max(element.x1, element.x2);
    const top = Math.min(element.y1, element.y2);
    const bottom = Math.max(element.y1, element.y2);

    const points = [
      [(left + right) / 2, top], // top middle
      [left, bottom],
      [right, bottom],
    ];

    roughCanvas.polygon(points, {
      stroke: element.stroke,
      strokeWidth: element.strokeWidth,
      fill: element.fill ? element.fill : undefined,
      seed: element.seed,
    });
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
    const fontSize = element.fontSize ?? FONT_SIZE;
    const lineHeight = element.lineHeight ?? LINE_HEIGHT;

    ctx.save();
    ctx.textBaseline = "top";
    ctx.font = `${fontSize}px sans-serif`;

    // prioritas: warna di element dulu, baru opts, lalu default
    ctx.fillStyle = element.stroke ?? opts.strokeColor ?? "#111827";

    const lines = element.text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], element.x1, element.y1 + i * lineHeight);
    }
    ctx.restore();
  }
}

export function drawElements(ctx, elements, locks = {}, myUserId) {
  if (!ctx || !elements) return;
  const roughCanvas = getRoughCanvas(ctx);

  elements.forEach((el) => {
    if (!el) return;
    const lockedByOther = locks[el.id] && locks[el.id] !== myUserId;
    const strokeColor = el.stroke || "#111827";

    drawElement(ctx, roughCanvas, el, { strokeColor });

    if (lockedByOther) {
      drawLockLabel(ctx, el);
    }
  });
}
