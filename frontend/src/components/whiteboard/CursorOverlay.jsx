import React from "react";

export default function CursorOverlay({ cursors }) {
  if (!cursors?.length) return null;

  return (
    <>
      {cursors.map((c) => (
        <div
          key={c.userId}
          className="pointer-events-none absolute"
          style={{ left: c.x, top: c.y }}
        >
          <div className="h-4 w-4 rounded-full border-2 border-white bg-slate-900 shadow" />
        </div>
      ))}
    </>
  );
}
