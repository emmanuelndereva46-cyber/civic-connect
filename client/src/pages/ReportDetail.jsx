import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { LayoutDashboard, FilePlus, MessageSquareText, Bell, UserRound } from "lucide-react";
import DashboardLayout from "../components/DashboardLayout.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import api from "../api/client";

const SIDEBAR = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/report/new", label: "Report an Issue", icon: FilePlus },
  { to: "/pigeonhole", label: "Pigeonhole", icon: MessageSquareText },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/profile", label: "Profile", icon: UserRound },
];

export default function ReportDetail() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

useEffect(() => {
  let cancelled = false;

  async function loadReport() {
    try {
      setError("");
      setReport(null);

      const { data } = await api.get(`/reports/${id}`);

      if (!cancelled) {
        setReport(data);
      }
    } catch (err) {
      if (!cancelled) {
        setError(
          err.response?.data?.message || "Report not found."
        );
      }
    }
  }

  loadReport();

  return () => {
    cancelled = true;
  };
}, [id]);
  return (
    <DashboardLayout title="Report details" items={SIDEBAR}>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!report && !error && <p className="text-civic-ink/50">Loading…</p>}
      {report && (
        <div className="max-w-2xl">
          <Link to="/dashboard" className="text-sm text-civic-blue hover:underline">← Back to dashboard</Link>
          <div className="mt-4 rounded-lg border border-civic-line bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-civic-navy">{report.referenceNumber}</h2>
              <StatusBadge status={report.status} />
            </div>
            <h3 className="mt-3 font-medium">{report.title}</h3>
            <p className="mt-1 text-sm text-civic-ink/70">{report.description}</p>

            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
             <div>
  <dt className="text-civic-ink/50">Category</dt>
  <dd>{report.category?.name ?? "Not specified"}</dd>
</div>

<div>
  <dt className="text-civic-ink/50">Department</dt>
  <dd>{report.department?.name ?? "Not assigned"}</dd>
</div>
<div>
  <dt className="text-civic-ink/50">Priority</dt>
  <dd className="capitalize">
    {report.priority?.toLowerCase() ?? "Not specified"}
  </dd>
</div>
            <div>
  <dt className="text-civic-ink/50">Location</dt>
  <dd>{report.location || "Not specified"}</dd>
</div>
            </dl>

            <h4 className="mt-6 font-medium text-civic-navy">Timeline</h4>
            <ol className="mt-3 space-y-4 border-l border-civic-line pl-4 text-sm">
              <li>
                <p className="font-medium">Submitted</p>
<p className="text-civic-ink/50">
  {report.submittedAt
    ? new Date(report.submittedAt).toLocaleString()
    : "Date unavailable"}
</p>
              </li>
{(report.updates ?? []).map((u) => (
                <li key={u.id}>
                  <p className="font-medium capitalize">{(u.status || "Comment").replace(/_/g, " ").toLowerCase()}</p>
                  {u.comment && <p className="text-civic-ink/70">{u.comment}</p>}
                  {u.actionTaken && <p className="text-civic-ink/70">Action taken: {u.actionTaken}</p>}
                  <p className="text-civic-ink/40">{new Date(u.createdAt).toLocaleString()}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
