import React, { useEffect, useRef, useState } from "react";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import { useAuth } from "../hooks/useAuth";
import { useLocation, useNavigate } from "react-router-dom";
import { useToast } from "../hooks/useToast";
import { FiEye, FiEyeOff } from "react-icons/fi";
import LoadingModal from "../components/ui/LoadingModal";

export default function LoginPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { login } = useAuth();
  const [form, setForm] = useState({ username: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const location = useLocation();

  // Avoid setting state after unmount (e.g., navigate away mid-request)
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

      showToast("Welcome to Fira", "success");

      // Cek apakah ada tiket "titipan" (from)
      // Kalau ada, kembalikan ke sana. Kalau tidak, ke dashboard ('/')
      const from = location.state?.from?.pathname || "/";
      navigate(from, { replace: true });
    } catch (err) {
      showToast("Invalid username or password", "error");
      if (isMountedRef.current) setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800">
      <LoadingModal title="Login..." open={submitting}></LoadingModal>
      <div className="mx-4 w-full max-w-md rounded-3xl bg-white/95 p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="text-xs font-semibold tracking-[0.3em] text-fira-primary">
            FIRA
          </div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-slate-400">
            Collaborative Whiteboard
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
              className="absolute right-3 top-7 text-slate-400"
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? <FiEyeOff /> : <FiEye />}
            </button>
          </div>

          <Button type="submit" className="w-full mt-2" disabled={submitting}>
            {submitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
