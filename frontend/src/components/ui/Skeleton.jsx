import React from "react";

export default function Skeleton({ className = "" }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-slate-200/70 dark:bg-slate-700/40 ${className}`}
    />
  );
}
