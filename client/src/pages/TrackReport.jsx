import { useState } from "react";
import Navbar from "../components/Navbar.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import api from "../api/client";

function ReportLookup() {
  const [ref, setRef] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setResult(null); setLoading(true);
    try {
const { data } = await api.get(
  `/reports/track/${encodeURIComponent(ref.trim())}`
);
      setResult(data);
    } catch {
      setError("No report found with that reference number.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="CC-2026-000001"
          className="flex-1 rounded-md border border-civic-line px-3 py-2 text-sm focus:border-civic-blue" />
        <button disabled={loading} className="rounded-md bg-civic-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {loading ? "Searching…" : "Track"}
        </button>
      </form>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {result && (
        <div className="mt-6 rounded-lg border border-civic-line bg-white p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-civic-navy">{result.referenceNumber}</h3>
            <StatusBadge status={result.status} />
          </div>
<p className="mt-1 text-sm text-civic-ink/60">
  Department: {result.department ?? "Not assigned"}
</p>
          <ol className="mt-5 space-y-3 border-l border-civic-line pl-4 text-sm">
{(result.updates ?? []).length === 0 && (
  <li className="text-civic-ink/50">
    Submitted — awaiting review.
  </li>
)}
{(result.updates ?? []).map((u) => (
  <li key={u.id}>
    <span className="font-medium capitalize">
      {(u.status || "").replace(/_/g, " ").toLowerCase()}
    </span>
    {u.comment && (
      <span className="text-civic-ink/60"> — {u.comment}</span>
    )}
    <p className="text-xs text-civic-ink/50">
      {new Date(u.createdAt).toLocaleString()}
    </p>
  </li>
))}
          </ol>
        </div>
      )}
    </div>
  );
}

function PigeonholeLookup() {
  const [ref, setRef] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setResult(null); setLoading(true);
    try {
      const { data } = await api.get("/track/pigeonhole", { params: { ref: ref.trim() } });
      setResult(data);
    } catch {
      setError("No matching anonymous submission — check your reference and access code.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <p className="mb-4 text-sm text-civic-ink/60">
        Enter the reference number shown after submission. This public lookup shows only the current status and any public response.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="PG-2026-000001"
          className="w-full rounded-md border border-civic-line px-3 py-2 text-sm focus:border-civic-blue" />
        <button disabled={loading} className="w-full rounded-md bg-civic-teal px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {loading ? "Checking…" : "Check status"}
        </button>
      </form>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {result && (
        <div className="mt-6 rounded-lg border border-civic-line bg-white p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-civic-navy">{result.referenceNumber}</h3>
            <StatusBadge status={result.status} />
          </div>
          <p className="mt-3 text-sm">{result.response || "No response has been provided yet."}</p>
        </div>
      )}
    </div>
  );
}

export default function TrackReport() {
  const [tab, setTab] = useState("report");
  return (
    <div>
      <Navbar />
      <div className="mx-auto max-w-lg px-6 py-12">
        <h1 className="text-2xl font-bold text-civic-navy">Track a submission</h1>
        <div className="mt-6 flex gap-2 border-b border-civic-line">
          {[["report", "Report"], ["pigeonhole", "Pigeonhole"]].map(([value, label]) => (
            <button key={value} onClick={() => setTab(value)}
              className={`px-4 py-2 text-sm font-medium ${tab === value ? "border-b-2 border-civic-navy text-civic-navy" : "text-civic-ink/50"}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="mt-6">
          {tab === "report" ? <ReportLookup /> : <PigeonholeLookup />}
        </div>
      </div>
    </div>
  );
}
