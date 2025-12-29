import { useNavigate } from "react-router-dom";
import Button from "../components/ui/Button";
import { useAuth } from "../hooks/useAuth";

export default function NotFoundPage({
  title = "Page not found",
  description = "The page you are looking for does not exist or has been moved.",
  primaryCta,
  secondaryCta,
}) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const defaultPrimary = isAuthenticated
    ? { label: "Back to Dashboard", to: "/" }
    : { label: "Go to Login", to: "/login" };

  const main = primaryCta || defaultPrimary;
  const alt = secondaryCta || null;

  const go = (cta) => {
    if (!cta) return;
    if (typeof cta.onClick === "function") return cta.onClick();
    if (cta.to) return navigate(cta.to);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-xs font-semibold text-slate-500">404</div>
        <h1 className="mt-1 text-xl font-bold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">{description}</p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button className="w-full" onClick={() => go(main)}>
            {main.label}
          </Button>

          {alt ? (
            <button
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              onClick={() => go(alt)}
              type="button"
            >
              {alt.label}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
