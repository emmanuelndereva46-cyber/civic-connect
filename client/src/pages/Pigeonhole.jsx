import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, ShieldAlert } from "lucide-react";
import Navbar from "../components/Navbar.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import api from "../api/client";

const TYPES = [
  { value: "SUGGESTION", label: "Suggestion" },
  { value: "COMPLAINT", label: "Complaint" },
  { value: "FEEDBACK", label: "Feedback" },
  { value: "CONCERN", label: "Concern" },
  { value: "COMPLIMENT", label: "Compliment" },
  { value: "OTHER", label: "Other" },
];

export default function Pigeonhole() {
  const { user } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState({
    submissionType: "SUGGESTION", subject: "", message: "", departmentId: "",
  });
  const [anonymous, setAnonymous] = useState(!user);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    api.get("/departments").then((r) => setDepartments(r.data)).catch(() => setDepartments([]));
  }, []);

  useEffect(() => {
    if (!user) setAnonymous(true);
  }, [user]);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (form.subject.trim().length < 3) return setError("Enter a short subject (at least 3 characters).");
    if (form.message.trim().length < 10) return setError("Enter a message of at least 10 characters.");
    if (!consent) return setError("Please acknowledge the privacy notice to continue.");

    setSubmitting(true);
    try {
      const { data } = await api.post("/pigeonhole", {
        submissionType: form.submissionType, subject: form.subject.trim(), message: form.message.trim(),
        departmentId: form.departmentId ? Number(form.departmentId) : null,
        anonymous, consent: true,
      });
      setResult(data);
    } catch (err) {
console.error("Pigeonhole submission failed:", err.response?.data || err);

setError(
  err.response?.data?.message ||
  err.response?.data?.error ||
  `Could not submit your feedback. ${
    err.response?.status
      ? `Server returned ${err.response.status}.`
      : "Check your server connection."
  }`
);
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div>
        <Navbar />
        <div className="mx-auto max-w-lg px-6 py-16">
          <div className="rounded-lg border border-civic-line bg-white p-8 text-center">
            <CheckCircle2 className="mx-auto text-emerald-600" size={40} />
            <h1 className="mt-4 text-xl font-semibold text-civic-navy">Your feedback has been submitted successfully.</h1>
            <p className="mt-2 text-sm text-civic-ink/60">Reference number</p>
            <p className="text-lg font-bold">{result.referenceNumber}</p>

            {result.accessCode && (
              <div className="mt-6 rounded-md bg-amber-50 p-4 text-left text-sm text-amber-900">
                <p className="flex items-center gap-2 font-medium"><ShieldAlert size={16} /> Save this access code</p>
                <p className="mt-1 font-mono text-base">{result.accessCode}</p>
                <p className="mt-2 text-xs">
                  Since this submission is anonymous, this code is the only way to check its status later.
                  It will not be shown again — write it down along with your reference number.
                </p>
              </div>
            )}

            <div className="mt-8 flex justify-center gap-3">
              <Link to="/track" className="rounded-md bg-civic-navy px-4 py-2 text-sm font-medium text-white">Check status</Link>
              <Link to="/" className="rounded-md border border-civic-line px-4 py-2 text-sm font-medium">Back home</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navbar />
      <div className="mx-auto max-w-xl px-6 py-12">
        <h1 className="text-2xl font-bold text-civic-navy">The Pigeonhole</h1>
        <p className="mt-1 text-sm text-civic-ink/60">
          A digital suggestion, complaint and feedback box — send a concern straight to the
          relevant department, with or without your name attached.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          {error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <div>
            <label className="text-sm font-medium">Submission type</label>
            <select value={form.submissionType} onChange={update("submissionType")}
              className="mt-1 w-full rounded-md border border-civic-line px-3 py-2 text-sm focus:border-civic-blue">
              {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">Subject</label>
            <input value={form.subject} onChange={update("subject")}
              className="mt-1 w-full rounded-md border border-civic-line px-3 py-2 text-sm focus:border-civic-blue"
              placeholder="A short summary" />
          </div>

          <div>
            <label className="text-sm font-medium">Message</label>
            <textarea value={form.message} onChange={update("message")} rows={5}
              className="mt-1 w-full rounded-md border border-civic-line px-3 py-2 text-sm focus:border-civic-blue"
              placeholder="Share your suggestion, complaint, or feedback in detail" />
          </div>

          <div>
            <label className="text-sm font-medium">Department</label>
            <select value={form.departmentId} onChange={update("departmentId")}
              className="mt-1 w-full rounded-md border border-civic-line px-3 py-2 text-sm focus:border-civic-blue">
              <option value="">Not sure — send to general review</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          <div className="rounded-md border border-civic-line p-4">
            <p className="text-sm font-medium">How should we handle your identity?</p>
            <div className="mt-2 space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" name="anon" checked={!anonymous} onChange={() => setAnonymous(false)} disabled={!user} />
                Include my contact information {!user && <span className="text-civic-ink/40">(log in to enable)</span>}
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="anon" checked={anonymous} onChange={() => setAnonymous(true)} />
                Submit anonymously
              </label>
            </div>
            {anonymous && (
              <p className="mt-2 text-xs text-civic-ink/50">
                Your name and contact details will not be attached. Basic security metadata (such as
                IP address) is still retained for audit purposes — this is not complete anonymity.
                You'll receive a one-time access code to check for a response later.
              </p>
            )}
          </div>

          <label className="flex items-start gap-2 text-sm text-civic-ink/70">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
            I understand how this submission will be processed, per the privacy notice.
          </label>

          <button type="submit" disabled={submitting}
            className="w-full rounded-md bg-civic-teal px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">
            {submitting ? "Submitting…" : "Submit to the Pigeonhole"}
          </button>
        </form>
      </div>
    </div>
  );
}
