import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import LoadingModal from "../components/ui/LoadingModal";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import { FiEye, FiEyeOff } from "react-icons/fi";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const { login } = useAuth();

  const [form, setForm] = useState({ username: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    const username = form.username.trim();
    const password = form.password;

    if (!username || !password) {
      showToast("Username and password are required", "error");
      return;
    }

    try {
      setSubmitting(true);
      await login(username, password);

      const from = location.state?.from?.pathname || "/dashboard";
      navigate(from, { replace: true });
    } catch (err) {
      const msg = err?.response?.data?.message || "Login failed";
      showToast(msg, "error");
      if (isMountedRef.current) setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">
      <LoadingModal title="Signing in..." open={submitting} />

      {/* base */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-slate-50" />
      {/* navy wash */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-slate-900/6 via-transparent to-transparent" />
      {/* dotted canvas  */}
      <div
        className="pointer-events-none absolute inset-0 bg-slate-100"
        style={{
          backgroundImage: "radial-gradient(#ddd 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          opacity: 0.65,
        }}
      />
      {/* subtle glow */}
      <div className="pointer-events-none absolute -top-32 left-[18%] h-64 w-64 rounded-full bg-fira-primary/8 blur-3xl" />

      <style>{`
        @keyframes firaFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .fira-anim { animation: firaFadeUp 520ms ease-out both; }
      `}</style>

      <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-3">
            <div className="leading-none">
              <div className="text-sm font-extrabold tracking-[0.22em] text-slate-900">
                FIRA
              </div>
              <div className="mt-1 flex items-center gap-1">
                <div className="h-0.5 w-8 rounded-full bg-fira-primary/80" />
                <div className="h-0.5 w-3 rounded-full bg-slate-900/30" />
              </div>
            </div>
          </Link>

          <Link
            to="/"
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm ring-1 ring-slate-900/10 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            Go to Landing Page
          </Link>
        </div>
      </header>

      {/* content */}
      <main className="relative mx-auto flex min-h-[calc(100vh-80px)] max-w-5xl items-center justify-center px-4 py-10">
        <div className="fira-anim w-full max-w-md">
          <div className="rounded-3xl border border-slate-200 bg-white/90 p-7 shadow-sm ring-1 ring-slate-900/5 backdrop-blur">
            <div className="mb-6 ">
              <div className="mt-2 text-center text-2xl font-extrabold tracking-tight text-slate-900">
                Sign In
              </div>
              <div className="mt-1 text-sm text-center text-slate-600">
                Enter your username and password to continue.
              </div>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <Input
                label="Username"
                name="username"
                value={form.username}
                onChange={handleChange}
                autoComplete="username"
              />

              <div className="relative">
                <Input
                  label="Password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-7 text-slate-400 hover:text-slate-600"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Signing in..." : "Login"}
              </Button>

              <div className="pt-2 text-center text-xs text-slate-500">
                Don&apos;t have an account?{" "}
                <Link
                  to="/register"
                  className="font-semibold text-fira-primary"
                >
                  Create one
                </Link>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
