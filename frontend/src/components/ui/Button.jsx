import React from "react";

export default function Button({ children, className = "", ...props }) {
  return (
    <button
      className={`
        inline-flex items-center justify-center rounded-lg
        bg-fira-primary px-4 py-2 text-sm font-semibold text-white
        shadow-sm transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-70
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
}
