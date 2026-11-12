import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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

function StatCard({ label, value }) {
  return (
    <div className="rounded-lg border border-civic-line bg-white p-4">
      <p className="text-xs text-civic-ink/60">{label}</p>
      <p className="mt-1 text-2xl font-bold text-civic-navy">{value}</p>
    </div>
  );
}

export default function CitizenDashboard() {
  const [reports, setReports] = useState([]);
  const [pigeonhole, setPigeonhole] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  let cancelled = false;

  async function loadDashboard() {
    const results = await Promise.allSettled([
      api.get("/reports"),
      api.get("/pigeonhole"),
      api.get("/notifications"),
    ]);

    if (cancelled) return;

    if (results[0].status === "fulfilled") {
      setReports(
        Array.isArray(results[0].value.data)
          ? results[0].value.data
          : []
      );
    } else {
      console.error("Failed to load reports:", results[0].reason);
    }

    if (results[1].status === "fulfilled") {
      setPigeonhole(
        Array.isArray(results[1].value.data)
          ? results[1].value.data
          : []
      );
    } else {
      console.error("Failed to load Pigeonhole submissions:", results[1].reason);
    }

    if (results[2].status === "fulfilled") {
      setNotifications(
        Array.isArray(results[2].value.data)
          ? results[2].value.data
          : []
      );
    } else {
      console.error("Failed to load notifications:", results[2].reason);
    }

    setLoading(false);
  }

  loadDashboard();

  return () => {
    cancelled = true;
  };
}, []);

  const pending = reports.filter((r) => r.status === "SUBMITTED" || r.status === "UNDER_REVIEW").length;
  const inProgress = reports.filter((r) => ["ASSIGNED", "IN_PROGRESS", "AWAITING_INFORMATION"].includes(r.status)).length;
  const resolved = reports.filter((r) => ["RESOLVED", "CLOSED"].includes(r.status)).length;
  const unread = notifications.filter((n) => !n.isRead).length;

  return (
    <DashboardLayout title="My dashboard" items={SIDEBAR}>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total reports" value={reports.length} />
        <StatCard label="Pending" value={pending} />
        <StatCard label="In progress" value={inProgress} />
        <StatCard label="Resolved" value={resolved} />
        <StatCard label="Pigeonhole submissions" value={pigeonhole.length} />
        <StatCard label="Unread notifications" value={unread} />
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/report/new" className="rounded-md bg-civic-navy px-4 py-2 text-sm font-medium text-white hover:bg-civic-blue">Report an Issue</Link>
        <Link to="/pigeonhole" className="rounded-md bg-civic-teal px-4 py-2 text-sm font-medium text-white hover:opacity-90">Use Pigeonhole</Link>
        <Link to="/track" className="rounded-md border border-civic-line px-4 py-2 text-sm font-medium hover:border-civic-navy">Track Reports</Link>
      </div>

      <section className="mt-10">
        <h2 className="font-semibold text-civic-navy">Recent reports</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-civic-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-civic-bg text-xs uppercase text-civic-ink/50">
              <tr>
                <th className="px-4 py-2">Reference</th>
                <th className="px-4 py-2">Issue</th>
                <th className="px-4 py-2">Department</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="px-4 py-6 text-center text-civic-ink/50">Loading…</td></tr>}
              {!loading && reports.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-civic-ink/50">No reports yet — submit your first one above.</td></tr>
              )}
              {reports.slice(0, 8).map((r) => (
                <tr key={r.id} className="border-t border-civic-line">
                  <td className="px-4 py-2 font-medium">{r.referenceNumber}</td>
                  <td className="px-4 py-2">{r.title}</td>
                  <td className="px-4 py-2 text-civic-ink/70">
  {r.department?.name ?? "Not assigned"}
</td>
                  <td className="px-4 py-2"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-2 text-right">
                    <Link to={`/reports/${r.id}`} className="text-civic-blue hover:underline">View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-semibold text-civic-navy">Recent Pigeonhole submissions</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-civic-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-civic-bg text-xs uppercase text-civic-ink/50">
              <tr>
                <th className="px-4 py-2">Reference</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Subject</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Response</th>
              </tr>
            </thead>
            <tbody>
              {!loading && pigeonhole.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-civic-ink/50">No Pigeonhole submissions yet.</td></tr>
              )}
              {pigeonhole.slice(0, 8).map((p) => (
                <tr key={p.id} className="border-t border-civic-line">
                  <td className="px-4 py-2 font-medium">{p.referenceNumber}</td>
                  <td className="px-4 py-2 capitalize">{p.submissionType.toLowerCase()}</td>
                  <td className="px-4 py-2">{p.subject}</td>
                  <td className="px-4 py-2"><StatusBadge status={p.status} /></td>
                  <td className="px-4 py-2 text-civic-ink/70">{p.response ? "Available" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardLayout>
  );
}
