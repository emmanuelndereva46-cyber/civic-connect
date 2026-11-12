import { useEffect, useState } from "react";
import {
  LayoutDashboard, Bell, Users, Building2, ScrollText,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { useTheme } from "../context/ThemeContext.jsx";
import DashboardLayout from "../components/DashboardLayout.jsx";
import api from "../api/client";

const SIDEBAR = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/notifications", label: "Notifications", icon: Bell },
];

function StatCard({ label, value }) {
  return (
    <div className="rounded-lg border border-civic-line bg-white p-4">
      <p className="text-xs text-civic-ink/60">{label}</p>
      <p className="mt-1 text-2xl font-bold text-civic-navy">{value}</p>
    </div>
  );
}

function ChartCard({ title, data }) {
  const dark = useTheme().theme === "dark";
  const axis = dark ? "#94a3b8" : "#475569";
  return (
    <div className="rounded-lg border border-civic-line bg-white p-4">
      <h3 className="text-sm font-semibold text-civic-navy">{title}</h3>
      <div className="mt-2 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={dark ? "#2a3a4c" : "#DFE3E6"} />
            <XAxis dataKey="key" tick={{ fontSize: 11, fill: axis }} interval={0} angle={-20} textAnchor="end" height={50} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: axis }} />
            <Tooltip contentStyle={{ background: dark ? "#111c2a" : "#fff", border: `1px solid ${dark ? "#2a3a4c" : "#DFE3E6"}`, borderRadius: 8, color: dark ? "#e2e8f0" : "#16202B" }} cursor={{ fill: dark ? "#ffffff10" : "#00000008" }} />
            <Bar dataKey="count" fill={dark ? "#6eafe2" : "#1D5C86"} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function OverviewTab() {
  const [stats, setStats] = useState(null);

  useEffect(() => { api.get("/admin/stats").then((r) => setStats(r.data)); }, []);

  if (!stats) return <p className="text-civic-ink/50">Loading statistics…</p>;

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total users" value={stats.totalUsers} />
        <StatCard label="Citizens" value={stats.totalCitizens} />
        <StatCard label="Officers" value={stats.totalOfficers} />
        <StatCard label="Total reports" value={stats.totalReports} />
        <StatCard label="Pigeonhole submissions" value={stats.totalPigeonhole} />
      </div>
      <p className="mt-2 text-xs text-civic-ink/50">{stats.pigeonholeAnonymous} of those Pigeonhole submissions are anonymous.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ChartCard title="Reports by status" data={stats.reportsByStatus} />
        <ChartCard title="Reports by category" data={stats.reportsByCategory} />
        <ChartCard title="Pigeonhole by status" data={stats.pigeonholeByStatus} />
        <ChartCard title="Pigeonhole by type" data={stats.pigeonholeByType} />
      </div>
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ fullName: "", email: "", role: "OFFICER", departmentId: "" });
  const [createdInfo, setCreatedInfo] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    const { data } = await api.get("/admin/users", { params: { search: search || undefined, role: role || undefined } });
    setUsers(data);
  }

  useEffect(() => { load(); }, [role]);
  useEffect(() => { api.get("/departments").then((r) => setDepartments(r.data)); }, []);

  async function toggleStatus(user) {
    const next = user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    await api.put(`/admin/users/${user.id}/status`, { status: next });
    load();
  }

  async function createUser(e) {
    e.preventDefault();
    setError(""); setCreatedInfo(null);
    try {
      const { data } = await api.post("/admin/users", {
        ...newUser, departmentId: newUser.departmentId ? Number(newUser.departmentId) : undefined,
      });
      setCreatedInfo(data);
      setNewUser({ fullName: "", email: "", role: "OFFICER", departmentId: "" });
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Could not create the account.");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()}
          placeholder="Search by name or email" className="rounded-md border border-civic-line px-3 py-2 text-sm" />
        <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded-md border border-civic-line px-3 py-2 text-sm">
          <option value="">All roles</option>
          <option value="CITIZEN">Citizen</option>
          <option value="OFFICER">Officer</option>
          <option value="ADMIN">Admin</option>
        </select>
        <button onClick={load} className="rounded-md border border-civic-line px-3 py-2 text-sm font-medium">Search</button>
        <button onClick={() => setShowCreate((v) => !v)} className="ml-auto rounded-md bg-civic-navy px-4 py-2 text-sm font-medium text-white">
          {showCreate ? "Cancel" : "Create officer / admin"}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={createUser} className="mt-4 grid gap-3 rounded-lg border border-civic-line bg-white p-4 sm:grid-cols-2">
          {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
          {createdInfo && (
            <p className="col-span-2 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">
              Account created for {createdInfo.email}. Temporary password: <span className="font-mono">{createdInfo.temporaryPassword}</span>
              {" "}(share this securely — no email provider is configured to send it automatically).
            </p>
          )}
          <input required placeholder="Full name" value={newUser.fullName}
            onChange={(e) => setNewUser((u) => ({ ...u, fullName: e.target.value }))}
            className="rounded-md border border-civic-line px-3 py-2 text-sm" />
          <input required type="email" placeholder="Email" value={newUser.email}
            onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))}
            className="rounded-md border border-civic-line px-3 py-2 text-sm" />
          <select value={newUser.role} onChange={(e) => setNewUser((u) => ({ ...u, role: e.target.value }))}
            className="rounded-md border border-civic-line px-3 py-2 text-sm">
            <option value="OFFICER">Officer</option>
            <option value="ADMIN">Administrator</option>
          </select>
          {newUser.role === "OFFICER" && (
            <select required value={newUser.departmentId} onChange={(e) => setNewUser((u) => ({ ...u, departmentId: e.target.value }))}
              className="rounded-md border border-civic-line px-3 py-2 text-sm">
              <option value="">Assign department</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
          <button className="col-span-2 rounded-md bg-civic-navy px-4 py-2 text-sm font-semibold text-white">Create account</button>
        </form>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-civic-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-civic-bg text-xs uppercase text-civic-ink/50">
            <tr><th className="px-4 py-2">Name</th><th className="px-4 py-2">Email</th><th className="px-4 py-2">Role</th><th className="px-4 py-2">Status</th><th className="px-4 py-2"></th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-civic-line">
                <td className="px-4 py-2 font-medium">{u.fullName}</td>
                <td className="px-4 py-2 text-civic-ink/70">{u.email}</td>
                <td className="px-4 py-2 capitalize">{u.role.toLowerCase()}</td>
                <td className="px-4 py-2">{u.status === "ACTIVE" ? <span className="text-emerald-700">Active</span> : <span className="text-red-600">Inactive</span>}</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => toggleStatus(u)} className="text-civic-blue hover:underline">
                    {u.status === "ACTIVE" ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DepartmentsTab() {
  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [newDept, setNewDept] = useState("");
  const [newCat, setNewCat] = useState({ name: "", departmentId: "" });

  async function load() {
    const [d, c] = await Promise.all([api.get("/departments"), api.get("/categories")]);
    setDepartments(d.data); setCategories(c.data);
  }
  useEffect(() => { load(); }, []);

  async function addDept(e) {
    e.preventDefault();
    if (!newDept.trim()) return;
    await api.post("/departments", { name: newDept.trim() });
    setNewDept(""); load();
  }

  async function addCat(e) {
    e.preventDefault();
    if (!newCat.name.trim() || !newCat.departmentId) return;
    await api.post("/categories", { name: newCat.name.trim(), departmentId: Number(newCat.departmentId) });
    setNewCat({ name: "", departmentId: "" }); load();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <h3 className="font-semibold text-civic-navy">Departments</h3>
        <form onSubmit={addDept} className="mt-2 flex gap-2">
          <input value={newDept} onChange={(e) => setNewDept(e.target.value)} placeholder="New department name"
            className="flex-1 rounded-md border border-civic-line px-3 py-2 text-sm" />
          <button className="rounded-md bg-civic-navy px-3 py-2 text-sm font-medium text-white">Add</button>
        </form>
        <ul className="mt-3 divide-y divide-civic-line rounded-lg border border-civic-line bg-white text-sm">
          {departments.map((d) => <li key={d.id} className="px-4 py-2">{d.name}</li>)}
        </ul>
      </div>
      <div>
        <h3 className="font-semibold text-civic-navy">Categories &amp; routing</h3>
        <form onSubmit={addCat} className="mt-2 flex flex-wrap gap-2">
          <input value={newCat.name} onChange={(e) => setNewCat((c) => ({ ...c, name: e.target.value }))} placeholder="Category name"
            className="flex-1 rounded-md border border-civic-line px-3 py-2 text-sm" />
          <select value={newCat.departmentId} onChange={(e) => setNewCat((c) => ({ ...c, departmentId: e.target.value }))}
            className="rounded-md border border-civic-line px-3 py-2 text-sm">
            <option value="">Routes to…</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <button className="rounded-md bg-civic-navy px-3 py-2 text-sm font-medium text-white">Add</button>
        </form>
        <ul className="mt-3 divide-y divide-civic-line rounded-lg border border-civic-line bg-white text-sm">
          {categories.map((c) => (
            <li key={c.id} className="flex justify-between px-4 py-2">
              <span>{c.name}</span><span className="text-civic-ink/50">{c.departmentName}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function AuditTab() {
  const [logs, setLogs] = useState([]);
  useEffect(() => { api.get("/admin/audit-logs").then((r) => setLogs(r.data)); }, []);
  return (
    <div className="overflow-x-auto rounded-lg border border-civic-line bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-civic-bg text-xs uppercase text-civic-ink/50">
          <tr><th className="px-4 py-2">When</th><th className="px-4 py-2">Action</th><th className="px-4 py-2">Entity</th><th className="px-4 py-2">Detail</th><th className="px-4 py-2">IP</th></tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id} className="border-t border-civic-line">
              <td className="px-4 py-2 text-civic-ink/60">{new Date(l.createdAt).toLocaleString()}</td>
              <td className="px-4 py-2 font-medium">{l.action}</td>
              <td className="px-4 py-2">{l.entityType}{l.entityId ? ` #${l.entityId}` : ""}</td>
              <td className="px-4 py-2 text-civic-ink/70">{l.description}</td>
              <td className="px-4 py-2 text-civic-ink/50">{l.ipAddress}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TABS = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "users", label: "Users", icon: Users },
  { key: "departments", label: "Departments", icon: Building2 },
  { key: "audit", label: "Audit logs", icon: ScrollText },
];

export default function AdminDashboard() {
  const [tab, setTab] = useState("overview");
  return (
    <DashboardLayout title="Administrator dashboard" items={SIDEBAR}>
      <div className="flex gap-2 border-b border-civic-line">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium ${tab === key ? "border-b-2 border-civic-navy text-civic-navy" : "text-civic-ink/50"}`}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>
      <div className="mt-4">
        {tab === "overview" && <OverviewTab />}
        {tab === "users" && <UsersTab />}
        {tab === "departments" && <DepartmentsTab />}
        {tab === "audit" && <AuditTab />}
      </div>
    </DashboardLayout>
  );
}


