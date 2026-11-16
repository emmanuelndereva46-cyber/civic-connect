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
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

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
      setError(err.response?.data?.message || "Could not save your profile.");
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setPasswordError("");
    setPasswordMessage("");
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }
    setPasswordSaving(true);
    try {
      const { data } = await api.put("/auth/password", {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      setPasswordMessage(data.message);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      setPasswordError(err.response?.data?.message || "Could not change your password.");
    } finally {
      setPasswordSaving(false);
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
          <p className="text-xs text-civic-ink/50">The current account database stores your name and phone number. County and residential address are not stored.</p>
          <button className="rounded-md bg-civic-navy px-4 py-2 text-sm font-semibold text-white hover:bg-civic-blue">Save changes</button>
        </form>
      </div>

      <div className="mt-8 max-w-md">
        <h2 className="mb-3 font-semibold text-civic-navy">Change password</h2>
        <form onSubmit={handlePasswordSubmit} className="space-y-4 rounded-lg border border-civic-line bg-white p-6">
          {passwordError && <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{passwordError}</div>}
          {passwordMessage && <div className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{passwordMessage}</div>}
          <div>
            <label className="text-sm font-medium">Current password</label>
            <input type="password" required autoComplete="current-password" value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm((f) => ({ ...f, currentPassword: e.target.value }))}
              className="mt-1 w-full rounded-md border border-civic-line px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium">New password</label>
            <input type="password" required minLength={12} autoComplete="new-password" value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))}
              className="mt-1 w-full rounded-md border border-civic-line px-3 py-2 text-sm" />
            <p className="mt-1 text-xs text-civic-ink/50">At least 12 characters, including an uppercase letter and a number.</p>
          </div>
          <div>
            <label className="text-sm font-medium">Confirm new password</label>
            <input type="password" required autoComplete="new-password" value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm((f) => ({ ...f, confirmPassword: e.target.value }))}
              className="mt-1 w-full rounded-md border border-civic-line px-3 py-2 text-sm" />
          </div>
          <button disabled={passwordSaving} className="rounded-md bg-civic-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {passwordSaving ? "Changing…" : "Change password"}
          </button>
        </form>
      </div>
    </DashboardLayout>
  );
}
