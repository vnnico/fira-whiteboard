// whiteboard/utils/getSvgPathFromStroke.js

export function getSvgPathFromStroke(points, closed = false) {
  if (!points.length) return "";

  const d = points.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ["M", ...points[0], "Q"]
  );

  if (closed) d.push("Z");
  return d.join(" ");
}
