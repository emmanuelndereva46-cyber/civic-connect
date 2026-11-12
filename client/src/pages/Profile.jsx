import { useState } from "react";
import { LayoutDashboard, FilePlus, MessageSquareText, Bell, UserRound } from "lucide-react";
import DashboardLayout from "../components/DashboardLayout.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import api from "../api/client";

const SIDEBAR = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/report/new", label: "Report an Issue", icon: FilePlus },
  { to: "/pigeonhole", label: "Pigeonhole", icon: MessageSquareText },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/profile", label: "Profile", icon: UserRound },
];

export default function Profile() {
  const { user, refresh } = useAuth();
  const [form, setForm] = useState({
    fullName: user?.fullName || "", phone: user?.phone || "",
    county: user?.county || "", location: user?.location || "",
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setSaved(false);
    try {
      await api.put("/auth/me", form);
      await refresh();
      setSaved(true);
    } catch (err) {
      setError(err.response?.data?.error || "Could not save your profile.");
    }
  }

  return (
    <DashboardLayout title="My profile" items={SIDEBAR}>
      <div className="max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-civic-line bg-white p-6">
          {error && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          {saved && <div className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Profile updated.</div>}

          <div>
            <label className="text-sm font-medium">Email</label>
            <input disabled value={user?.email || ""} className="mt-1 w-full rounded-md border border-civic-line bg-civic-bg px-3 py-2 text-sm text-civic-ink/50" />
          </div>
          <div>
            <label className="text-sm font-medium">Full name</label>
            <input value={form.fullName} onChange={update("fullName")} className="mt-1 w-full rounded-md border border-civic-line px-3 py-2 text-sm focus:border-civic-blue" />
          </div>
          <div>
            <label className="text-sm font-medium">Phone</label>
            <input value={form.phone} onChange={update("phone")} className="mt-1 w-full rounded-md border border-civic-line px-3 py-2 text-sm focus:border-civic-blue" />
          </div>
          <div>
            <label className="text-sm font-medium">County</label>
            <input value={form.county} onChange={update("county")} className="mt-1 w-full rounded-md border border-civic-line px-3 py-2 text-sm focus:border-civic-blue" />
          </div>
          <div>
            <label className="text-sm font-medium">Location</label>
            <input value={form.location} onChange={update("location")} className="mt-1 w-full rounded-md border border-civic-line px-3 py-2 text-sm focus:border-civic-blue" />
          </div>
          <button className="rounded-md bg-civic-navy px-4 py-2 text-sm font-semibold text-white hover:bg-civic-blue">Save changes</button>
        </form>
      </div>
    </DashboardLayout>
  );
}
