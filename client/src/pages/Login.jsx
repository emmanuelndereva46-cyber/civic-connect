import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import Navbar from "../components/Navbar.jsx";
import { useAuth } from "../context/AuthContext.jsx";

function dashboardPathFor(role) {
  if (role === "ADMIN") return "/admin";
  if (role === "OFFICER") return "/officer";
  return "/dashboard";
}

// Always convert API errors into readable text before rendering.
function getReadableError(err) {
  const candidates = [
    err?.response?.data?.message,
    err?.response?.data?.error,
    err?.userMessage,
    err?.message,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }

    if (candidate && typeof candidate === "object") {
      if (
        typeof candidate.message === "string" &&
        candidate.message.trim()
      ) {
        return candidate.message;
      }

      if (
        typeof candidate.code === "string" &&
        candidate.code.trim()
      ) {
        return `Login failed (${candidate.code}). Please try again.`;
      }
    }
  }

  return "Login failed. Please check your details and try again.";
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const data = await login(email, password);
      navigate(dashboardPathFor(data?.user?.role));
    } catch (err) {
      setError(getReadableError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen">
      <Navbar />

      <div className="mx-auto flex max-w-md flex-col px-6 py-16">
        <h1 className="text-2xl font-bold text-civic-navy">
          Login to CivicConnect
        </h1>

        <p className="mt-1 text-sm text-civic-ink/60">
          Use your citizen, officer or administrator account.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          {error && (
            <div
              role="alert"
              className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>

            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-civic-line px-3 py-2 text-sm focus:border-civic-blue"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>

              <Link
                to="/forgot-password"
                className="text-xs text-civic-blue hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            <div className="relative mt-1">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-civic-line px-3 py-2 pr-10 text-sm focus:border-civic-blue"
              />

              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-civic-ink/50"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-civic-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-civic-blue disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Logging in..." : "Log in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-civic-ink/70">
          Don't have an account?{" "}
          <Link
            to="/register"
            className="font-medium text-civic-blue hover:underline"
          >
            Register
          </Link>
        </p>

        <div className="mt-8 rounded-md border border-civic-line bg-white p-4 text-xs text-civic-ink/60">
          <p className="font-medium text-civic-ink/80">
            Demo accounts (password: Demo@12345)
          </p>
          <p className="mt-1">
            admin@demo.civicconnect.test · officer@demo.civicconnect.test ·
            citizen@demo.civicconnect.test
          </p>
        </div>
      </div>
    </div>
  );
}
