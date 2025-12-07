import React from "react";

export default function Input({ label, type = "text", ...props }) {
  return (
    <label className="block text-sm">
      {label && (
        <span className="mb-1 block text-xs font-medium text-gray-600">
          {label}
        </span>
      )}
      <input
        type={type}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-fira-primary focus:ring-1 focus:ring-fira-primary"
        {...props}
      />
    </label>
  );
}
