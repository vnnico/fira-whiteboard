import React from "react";
import { FiCheckCircle, FiAlertTriangle, FiInfo } from "react-icons/fi";

const typeStyles = {
  info: "bg-slate-900/90 text-white",
  success: "bg-emerald-500 text-white",
  error: "bg-rose-500 text-white",
  warning: "bg-amber-400 text-slate-900",
};

const icons = {
  info: FiInfo,
  success: FiCheckCircle,
  error: FiAlertTriangle,
  warning: FiAlertTriangle,
};

export default function Toast({ toast }) {
  if (!toast) return null;
  const Icon = icons[toast.type] || FiInfo;

  return (
    <div className="pointer-events-none fixed left-1/2 top-5 z-50 flex -translate-x-1/2 justify-center">
      <div
        className={`
          pointer-events-auto flex items-center gap-2 rounded-xl px-4 py-3 shadow-lg
          backdrop-blur transition-all duration-300 animate-[fadeIn_0.2s_ease-out]
          ${typeStyles[toast.type] || typeStyles.info}
        `}
      >
        <Icon className="h-4 w-4" />
        <span className="text-sm font-medium">{toast.message}</span>
      </div>
    </div>
  );
}
