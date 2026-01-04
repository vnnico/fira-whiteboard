import { Link, useNavigate } from "react-router-dom";
import Button from "../components/ui/Button";
import { useAuth } from "../hooks/useAuth";

function FeatureCard({ title, desc, icon }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-900/5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

      <div className="flex items-start gap-3">
        <div className="relative grid h-10 w-10 place-items-center rounded-xl bg-slate-900/5 ring-1 ring-slate-900/10 transition group-hover:bg-slate-900/0">
          <span className="text-slate-800">{icon}</span>
          <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-fira-primary" />
        </div>

        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <div className="mt-1 text-sm leading-relaxed text-slate-600">
            {desc}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const onGetStarted = () => {
    if (isAuthenticated) navigate("/dashboard");
    else navigate("/login");
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">
      {/* base gradient  */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-slate-50" />

      {/*  navy wash  */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-slate-900/6 via-transparent to-transparent" />

      {/* dotted canvas */}
      <div
        className="pointer-events-none absolute inset-0 bg-slate-100"
        style={{
          backgroundImage: "radial-gradient(#ddd 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          opacity: 0.65,
        }}
      />

      {/*  soft brand glow  */}
      <div className="pointer-events-none absolute -top-32 left-[18%] h-64 w-64 rounded-full bg-fira-primary/8 blur-3xl" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-slate-900/6 blur-3xl" />

      <style>{`
        @keyframes firaFadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fira-anim-1 { animation: firaFadeUp 520ms ease-out both; }
        .fira-anim-2 { animation: firaFadeUp 620ms ease-out both; }
        .fira-anim-3 { animation: firaFadeUp 720ms ease-out both; }
      `}</style>

      {/* Content wrapper */}
      <div className="relative ">
        {/* Top Bar */}
        <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/70 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="leading-none">
                <div className="text-sm font-extrabold tracking-[0.22em] text-slate-900">
                  FIRA
                </div>

                <div className="mt-1 flex items-center gap-1">
                  <div className="h-0.5 w-8 rounded-full bg-fira-primary/80" />
                  <div className="h-0.5 w-3 rounded-full bg-slate-900/30" />
                </div>
              </div>
            </div>

            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm ring-1 ring-slate-900/10 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                Dashboard
              </button>
            ) : (
              <Link
                to="/login"
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm ring-1 ring-slate-900/10 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                Login
              </Link>
            )}
          </div>
        </header>

        {/* Hero */}
        <main className="mx-auto max-w-5xl px-4">
          <section className="py-16 md:py-20">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="fira-anim-2 mt-5 text-4xl font-extrabold tracking-tight text-slate-900 md:text-6xl">
                <span className="text-slate-900">Instant Whiteboard</span>{" "}
                <span className="text-slate-700">with Built-in</span>
                <br />
                <span className="text-slate-900 mb-5">
                  <span className="relative inline-block">Voice Calls</span>
                  <span className="text-fira-primary">.</span>
                </span>
              </h1>

              <p className="fira-anim-2 mx-auto mt-7 max-w-2xl text-sm leading-relaxed text-slate-600 md:text-base">
                Your all-in-one online whiteboard with built-in voice calls —
                designed for teams, educators, and creatives who want to bring
                ideas to life in real time.
              </p>

              <div className="fira-anim-3 mt-8 flex items-center justify-center">
                <Button
                  onClick={onGetStarted}
                  className="px-7 py-2.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  Get Started
                </Button>
              </div>
            </div>

            {/* Features */}
            <div className="mt-10 md:mt-12">
              <div className="grid gap-4 md:grid-cols-3">
                <FeatureCard
                  title="Realtime Drawing"
                  desc="Draw shapes and collaborate instantly."
                  icon={
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M4 16c4-8 12-8 16 0"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      <path
                        d="M6 20h12"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  }
                />

                <FeatureCard
                  title="Voice Room"
                  desc="Join voice calls in the same room."
                  icon={
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3Z"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <path
                        d="M19 10v2a7 7 0 0 1-14 0v-2"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      <path
                        d="M12 19v2"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  }
                />

                <FeatureCard
                  title="Messaging"
                  desc="Chat as a fallback when needed."
                  icon={
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M4 5h16v11H7l-3 3V5Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M8 9h8"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      <path
                        d="M8 12h6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  }
                />
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
