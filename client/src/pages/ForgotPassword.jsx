import { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import api from "../api/client";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      setMessage(data.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Navbar />
      <div className="mx-auto max-w-md px-6 py-16">
        <h1 className="text-2xl font-bold text-civic-navy">Reset your password</h1>
        <p className="mt-1 text-sm text-civic-ink/60">Enter your account email.</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          {message && <div className="rounded-md bg-blue-50 px-4 py-3 text-sm text-civic-blue">{message}</div>}
          <div>
            <label className="text-sm font-medium">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-civic-line px-3 py-2 text-sm focus:border-civic-blue" />
          </div>
          <button disabled={submitting} className="w-full rounded-md bg-civic-navy px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            {submitting ? "Sending…" : "Send reset instructions"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm">
          <Link to="/login" className="text-civic-blue hover:underline">Back to login</Link>
        </p>
      </div>
    </div>
  );
}
