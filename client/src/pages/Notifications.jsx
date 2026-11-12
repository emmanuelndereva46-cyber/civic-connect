import { useEffect, useState } from "react";
import { LayoutDashboard, FilePlus, MessageSquareText, Bell, UserRound, CheckCheck } from "lucide-react";
import DashboardLayout from "../components/DashboardLayout.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import api from "../api/client";

const SIDEBAR_BY_ROLE = {
  CITIZEN: [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/report/new", label: "Report an Issue", icon: FilePlus },
    { to: "/pigeonhole", label: "Pigeonhole", icon: MessageSquareText },
    { to: "/notifications", label: "Notifications", icon: Bell },
    { to: "/profile", label: "Profile", icon: UserRound },
  ],
  OFFICER: [
    { to: "/officer", label: "Dashboard", icon: LayoutDashboard },
    { to: "/notifications", label: "Notifications", icon: Bell },
  ],
  ADMIN: [
    { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { to: "/notifications", label: "Notifications", icon: Bell },
  ],
};

export default function Notifications() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get("/notifications");
      setItems(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function markRead(id) {
    await api.put(`/notifications/${id}/read`);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  }

  async function markAllRead() {
    await api.put("/notifications/read-all");
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }

  const sidebar = SIDEBAR_BY_ROLE[user?.role] || SIDEBAR_BY_ROLE.CITIZEN;
  const unread = items.filter((n) => !n.isRead).length;

  return (
    <DashboardLayout title="Notifications" items={sidebar}>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-civic-ink/60">{unread} unread</p>
        {unread > 0 && (
          <button onClick={markAllRead} className="flex items-center gap-1 text-sm font-medium text-civic-blue hover:underline">
            <CheckCheck size={16} /> Mark all as read
          </button>
        )}
      </div>

      <div className="space-y-2">
        {loading && <p className="text-civic-ink/50">Loading…</p>}
        {!loading && items.length === 0 && <p className="text-civic-ink/50">No notifications yet.</p>}
        {items.map((n) => (
          <button
            key={n.id} onClick={() => !n.isRead && markRead(n.id)}
            className={`block w-full rounded-lg border px-4 py-3 text-left text-sm ${
              n.isRead ? "border-civic-line bg-white" : "border-civic-blue/40 bg-blue-50"
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="font-medium">{n.title}</p>
              <span className="text-xs text-civic-ink/40">{new Date(n.createdAt).toLocaleString()}</span>
            </div>
            <p className="mt-1 text-civic-ink/70">{n.message}</p>
          </button>
        ))}
      </div>
    </DashboardLayout>
  );
}
