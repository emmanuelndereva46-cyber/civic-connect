import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import { useAuth } from "../context/AuthContext.jsx";

function passwordScore(pw) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score; // 0-4
}

const STRENGTH_LABEL = ["Too short", "Weak", "Fair", "Good", "Strong"];
const STRENGTH_COLOR = ["bg-red-300", "bg-red-400", "bg-amber-400", "bg-blue-400", "bg-emerald-500"];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: "", email: "", phone: "", county: "", password: "", confirmPassword: "",
  });
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const strength = useMemo(() => passwordScore(form.password), [form.password]);
  const passwordsMatch = form.password && form.password === form.confirmPassword;
  const passwordValid = form.password.length >= 8 && /[A-Z]/.test(form.password) && /[0-9]/.test(form.password);
  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!passwordValid) return setError("Password needs 8+ characters, one uppercase letter and one number.");
    if (!passwordsMatch) return setError("Passwords do not match.");
    if (!agreed) return setError("Please accept the terms and conditions.");

    setSubmitting(true);
    try {
      await register({
        fullName: form.fullName, email: form.email, phone: form.phone || undefined,
        county: form.county || undefined, password: form.password,
      });
      setSuccess(true);
      setTimeout(() => navigate("/login"), 1200);
    } catch (err) {
setError(
  err.response?.data?.message ||
  err.response?.data?.error ||
  err.message ||
  "Registration failed. Please try again."
);
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div>
        <Navbar />
        <div className="mx-auto max-w-md px-6 py-24 text-center">
          <h1 className="text-2xl font-bold text-civic-navy">Account created</h1>
          <p className="mt-2 text-civic-ink/70">Taking you to the login page…</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navbar />
      <div className="mx-auto max-w-md px-6 py-16">
        <h1 className="text-2xl font-bold text-civic-navy">Create your citizen account</h1>
        <p className="mt-1 text-sm text-civic-ink/60">Registering here always creates a citizen account.</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          {error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <div>
            <label className="text-sm font-medium">Full name</label>
            <input required value={form.fullName} onChange={update("fullName")}
              className="mt-1 w-full rounded-md border border-civic-line px-3 py-2 text-sm focus:border-civic-blue" />
          </div>

          <div>
            <label className="text-sm font-medium">Email</label>
            <input required type="email" value={form.email} onChange={update("email")}
              className="mt-1 w-full rounded-md border border-civic-line px-3 py-2 text-sm focus:border-civic-blue" />
            {form.email && !emailValid && <p className="mt-1 text-xs text-red-600">Enter a valid email address.</p>}
          </div>

          <div>
            <label className="text-sm font-medium">Phone number <span className="text-civic-ink/40">(optional)</span></label>
            <input value={form.phone} onChange={update("phone")}
              className="mt-1 w-full rounded-md border border-civic-line px-3 py-2 text-sm focus:border-civic-blue" />
          </div>

          <div>
            <label className="text-sm font-medium">County / location <span className="text-civic-ink/40">(optional)</span></label>
            <input value={form.county} onChange={update("county")}
              className="mt-1 w-full rounded-md border border-civic-line px-3 py-2 text-sm focus:border-civic-blue" />
          </div>

          <div>
            <label className="text-sm font-medium">Password</label>
            <input required type="password" value={form.password} onChange={update("password")}
              className="mt-1 w-full rounded-md border border-civic-line px-3 py-2 text-sm focus:border-civic-blue" />
            {form.password && (
              <div className="mt-2">
                <div className="flex h-1.5 gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className={`flex-1 rounded-full ${i < strength ? STRENGTH_COLOR[strength] : "bg-civic-line"}`} />
                  ))}
                </div>
                <p className="mt-1 text-xs text-civic-ink/60">{STRENGTH_LABEL[strength]} — 8+ characters, one uppercase letter, one number</p>
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium">Confirm password</label>
            <input required type="password" value={form.confirmPassword} onChange={update("confirmPassword")}
              className="mt-1 w-full rounded-md border border-civic-line px-3 py-2 text-sm focus:border-civic-blue" />
            {form.confirmPassword && !passwordsMatch && <p className="mt-1 text-xs text-red-600">Passwords do not match.</p>}
          </div>

          <label className="flex items-start gap-2 text-sm text-civic-ink/70">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5" />
            I agree to the terms and conditions and the privacy notice.
          </label>

          <button type="submit" disabled={submitting}
            className="w-full rounded-md bg-civic-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-civic-blue disabled:opacity-60">
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-civic-ink/70">
          Already registered? <Link to="/login" className="font-medium text-civic-blue hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}
