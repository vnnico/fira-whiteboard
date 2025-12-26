export default function LoadingModal({
  open,
  title = "Loading...",
  subtitle = "Please wait a moment.",
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]" />

      {/* Modal */}
      <div className="relative w-[92%] max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50">
            <svg
              className="h-5 w-5 animate-spin text-slate-500"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
          </div>

          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-800">{title}</div>
            <div className="mt-0.5 text-xs text-slate-500">{subtitle}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
