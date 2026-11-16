import { useEffect, useState } from "react";
import { LayoutDashboard, Bell, Inbox } from "lucide-react";
import DashboardLayout from "../components/DashboardLayout.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import api from "../api/client";

const SIDEBAR = [
  { to: "/officer", label: "Dashboard", icon: LayoutDashboard },
  { to: "/notifications", label: "Notifications", icon: Bell },
];

const REPORT_STATUSES = ["SUBMITTED", "UNDER_REVIEW", "ASSIGNED", "IN_PROGRESS", "AWAITING_INFORMATION", "RESOLVED", "CLOSED", "REJECTED"];
const PG_STATUSES = ["SUBMITTED", "RECEIVED", "UNDER_REVIEW", "ASSIGNED", "IN_PROGRESS", "RESPONSE_PROVIDED", "CLOSED"];

function StatCard({ label, value }) {
  return (
    <div className="rounded-lg border border-civic-line bg-white p-4">
      <p className="text-xs text-civic-ink/60">{label}</p>
      <p className="mt-1 text-2xl font-bold text-civic-navy">{value}</p>
    </div>
  );
}

function ReportPanel({ report, onClose, onChanged }) {
  const [status, setStatus] = useState(report.status);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setError("");
    try {
      await api.put(`/reports/${report.id}/status`, { status, comment: comment || undefined });
      await onChanged();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Could not save this report update. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-civic-navy">{report.referenceNumber}</h3>
          <StatusBadge status={report.status} />
        </div>
        <h4 className="mt-2 font-medium">{report.title}</h4>
        <p className="mt-1 text-sm text-civic-ink/70">{report.description}</p>
        <p className="mt-2 text-xs text-civic-ink/50">
          Reported by {report.citizenName || "citizen"} · {[report.location, report.ward, report.county].filter(Boolean).join(", ")}
        </p>

        {error && <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="mt-5 space-y-3">
          <div>
            <label className="text-sm font-medium">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}
              className="mt-1 w-full rounded-md border border-civic-line px-3 py-2 text-sm">
              {REPORT_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Comment / remarks</label>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3}
              className="mt-1 w-full rounded-md border border-civic-line px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-civic-line px-4 py-2 text-sm font-medium">Cancel</button>
          <button onClick={save} disabled={saving} className="rounded-md bg-civic-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {saving ? "Saving…" : "Save update"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OfficerDashboard() {
  const [tab, setTab] = useState("reports");
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  async function loadAll() {
    setLoading(true);
    setLoadError("");
    try {
      const { data } = await api.get("/reports");
      setReports(Array.isArray(data) ? data : []);
    } catch (err) {
      setLoadError(err.response?.data?.message || "Could not load department reports. Refresh and try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  const newReports = reports.filter((r) => r.status === "SUBMITTED").length;
  const inProgress = reports.filter((r) => ["ASSIGNED", "IN_PROGRESS"].includes(r.status)).length;
  const resolved = reports.filter((r) => ["RESOLVED", "CLOSED"].includes(r.status)).length;

  return (
    <DashboardLayout title="Officer dashboard" items={SIDEBAR}>
      {loadError && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700"><span>{loadError}</span><button onClick={loadAll} className="font-semibold underline">Retry</button></div>}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard label="New reports" value={newReports} />
        <StatCard label="In progress" value={inProgress} />
        <StatCard label="Resolved" value={resolved} />
      </div>

      <div className="mt-8 flex gap-2 border-b border-civic-line">
        <button onClick={() => setTab("reports")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium ${tab === "reports" ? "border-b-2 border-civic-navy text-civic-navy" : "text-civic-ink/50"}`}>
          <Inbox size={16} /> Reports
        </button>
      </div>

      {tab === "reports" && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-civic-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-civic-bg text-xs uppercase text-civic-ink/50">
              <tr>
                <th className="px-4 py-2">Reference</th><th className="px-4 py-2">Issue</th>
                <th className="px-4 py-2">Location</th><th className="px-4 py-2">Status</th><th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="px-4 py-6 text-center text-civic-ink/50">Loading…</td></tr>}
              {!loading && reports.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-civic-ink/50">No reports assigned to your department yet.</td></tr>}
              {reports.map((r) => (
                <tr key={r.id} className="border-t border-civic-line">
                  <td className="px-4 py-2 font-medium">{r.referenceNumber}</td>
                  <td className="px-4 py-2">{r.title}</td>
                  <td className="px-4 py-2">{r.location || "Not recorded"}</td>
                  <td className="px-4 py-2"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => setSelectedReport(r)} className="text-civic-blue hover:underline">Open</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}


      {selectedReport && (
        <ReportPanel report={selectedReport} onClose={() => setSelectedReport(null)} onChanged={loadAll} />
      )}
    </DashboardLayout>
  );
}
