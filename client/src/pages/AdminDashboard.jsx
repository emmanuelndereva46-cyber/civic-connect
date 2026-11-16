import { useEffect, useState } from "react";
import {
  LayoutDashboard, Bell, Users, Building2, ScrollText, MessageSquareText,
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
      setError(err.response?.data?.message || err.response?.data?.error || "Could not create the account.");
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
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [routingError, setRoutingError] = useState("");
  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState("");
  const nairobiSectors = [
    ["Boroughs Administration and Personnel", "County public service, borough and sub-county administration, and personnel coordination."],
    ["Built Environment and Urban Planning Sector", "County lands administration, surveying, mapping, urban planning, development control, housing and urban renewal."],
    ["Business and Hustler Opportunities", "Trade development, markets, business licensing, enterprise and cooperative development."],
    ["Finance and Economic Planning Affairs", "County finance, revenue, budgeting, accounting, economic planning and resource management."],
    ["Green Nairobi (Environment, Water, Food and Agriculture)", "Environment, solid waste, water and sanitation, food and agriculture, forestry and natural resources."],
    ["Health Wellness and Nutrition", "County health facilities, public health, wellness, nutrition and related county health services."],
    ["Inclusivity, Public Participation And Customer Service Sector", "Citizen engagement, public participation, inclusivity, public communication and customer service."],
    ["Innovation and Digital Economy", "County ICT infrastructure, digital services, innovation, data and digital economy programmes."],
    ["Mobility and Works", "County mobility, roads, transport, public works, parking, street lighting and drainage."],
    ["Security and Compliance Sub Sector", "County inspectorate, investigations, information analysis and enforcement of county compliance."],
    ["Talents, Skills Development and Care", "Early childhood development, vocational training, sports, culture, recreation and community care."]
  ];


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
        <h3 className="font-semibold text-civic-navy">Nairobi City County departments</h3>
        <p className="mt-1 text-xs text-civic-ink/60">Official county sectors and sub-sectors. Add missing entries without duplicating existing departments.</p>
        <button type="button" disabled={seeding} onClick={async () => {
          setSeeding(true); setSeedMessage("");
          let created = 0; let existing = 0; let failed = 0;
          for (const [name, description] of nairobiSectors) {
            try { await api.post("/departments", { name, description }); created++; }
            catch (err) { if (err.response?.status === 409) existing++; else failed++; }
          }
          await load();
          setSeedMessage(`Added ${created}; already present ${existing}; failed ${failed}. Review the list before assigning officers.`);
          setSeeding(false);
        }} className="mt-3 rounded-md border border-civic-line px-3 py-2 text-sm font-medium disabled:opacity-50">
          {seeding ? "Adding county sectors…" : "Add Nairobi City County sectors"}
        </button>
        {seedMessage && <p className="mt-2 text-xs text-civic-ink/70">{seedMessage}</p>}
        <form onSubmit={addDept} className="mt-3 flex gap-2">
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
        <div className="mt-4 rounded-lg border border-civic-line bg-white p-3">
          <h4 className="text-sm font-semibold text-civic-navy">Route an existing category</h4>
          <p className="mt-1 text-xs text-civic-ink/60">Assign existing unassigned categories to the responsible department.</p>
          {routingError && <p className="mt-2 text-sm text-red-600">{routingError}</p>}
          <form className="mt-3 flex flex-wrap gap-2" onSubmit={async (e) => {
            e.preventDefault(); setRoutingError("");
            if (!selectedCategoryId || !selectedDepartmentId) return setRoutingError("Select both a category and department.");
            try {
              await api.put(`/categories/${selectedCategoryId}/department`, { departmentId: Number(selectedDepartmentId) });
              setSelectedCategoryId(""); setSelectedDepartmentId(""); await load();
            } catch (err) { setRoutingError(err.response?.data?.message || "Could not assign this category."); }
          }}>
            <select required value={selectedCategoryId} onChange={(e) => setSelectedCategoryId(e.target.value)} className="min-w-40 flex-1 rounded-md border border-civic-line px-3 py-2 text-sm">
              <option value="">Select category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}{c.departmentName ? ` — ${c.departmentName}` : " — Unassigned"}</option>)}
            </select>
            <select required value={selectedDepartmentId} onChange={(e) => setSelectedDepartmentId(e.target.value)} className="min-w-40 flex-1 rounded-md border border-civic-line px-3 py-2 text-sm">
              <option value="">Select department</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <button className="rounded-md bg-civic-navy px-3 py-2 text-sm font-medium text-white">Assign</button>
          </form>
        </div>
        <ul className="mt-3 divide-y divide-civic-line rounded-lg border border-civic-line bg-white text-sm">
          {categories.map((c) => (
            <li key={c.id} className="flex justify-between px-4 py-2">
              <span>{c.name}</span><span className="text-civic-ink/50">{c.departmentName || "Unassigned"}</span>
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


function PigeonholeTab() {
  const [items, setItems] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [responses, setResponses] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const { data } = await api.get("/pigeonhole");
      setItems(data);
      setStatuses(Object.fromEntries(data.map((item) => [item.id, item.status])));
      setResponses(Object.fromEntries(data.map((item) => [item.id, item.response || ""])));
    } catch (err) {
      setError(err.response?.data?.message || "Could not load Pigeonhole submissions.");
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function updateStatus(item) {
    setBusy(`status-${item.id}`); setError("");
    try {
      await api.put(`/pigeonhole/${item.id}/status`, { status: statuses[item.id] });
      await load();
    } catch (err) { setError(err.response?.data?.message || "Could not update the submission status."); }
    finally { setBusy(""); }
  }

  async function sendResponse(item) {
    const response = (responses[item.id] || "").trim();
    if (response.length < 2) return setError("A response must contain at least 2 characters.");
    setBusy(`response-${item.id}`); setError("");
    try {
      await api.post(`/pigeonhole/${item.id}/response`, { response });
      await load();
    } catch (err) { setError(err.response?.data?.message || "Could not send the response."); }
    finally { setBusy(""); }
  }

  const options = ["SUBMITTED", "RECEIVED", "UNDER_REVIEW", "ASSIGNED", "IN_PROGRESS", "RESPONSE_PROVIDED", "CLOSED"];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-civic-ink/60">Administrator review queue. Anonymous submitters are never identified.</p>
        <button onClick={load} className="rounded-md border border-civic-line px-3 py-2 text-sm">Refresh</button>
      </div>
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading && <p className="text-sm text-civic-ink/50">Loading submissions…</p>}
      {!loading && items.length === 0 && <p className="rounded-lg border border-civic-line bg-white p-6 text-center text-sm text-civic-ink/50">No Pigeonhole submissions yet.</p>}
      {items.map((item) => (
        <article key={item.id} className="rounded-lg border border-civic-line bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs text-civic-ink/50">{item.referenceNumber} · {item.submissionType} · {item.anonymousSubmission ? "Anonymous" : "Identified"}</p>
              <h3 className="mt-1 font-semibold text-civic-navy">{item.subject}</h3>
            </div>
            <span className="text-xs font-semibold">{item.status.replace(/_/g, " ")}</span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm text-civic-ink/80">{item.message}</p>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
            <select value={statuses[item.id] || item.status} onChange={(e) => setStatuses((v) => ({ ...v, [item.id]: e.target.value }))}
              className="rounded-md border border-civic-line px-3 py-2 text-sm">
              {options.map((status) => <option key={status} value={status}>{status.replace(/_/g, " ")}</option>)}
            </select>
            <button disabled={busy === `status-${item.id}`} onClick={() => updateStatus(item)}
              className="rounded-md border border-civic-line px-3 py-2 text-sm font-medium disabled:opacity-50">
              {busy === `status-${item.id}` ? "Saving…" : "Update status"}
            </button>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <textarea rows={2} value={responses[item.id] || ""} onChange={(e) => setResponses((v) => ({ ...v, [item.id]: e.target.value }))}
              placeholder="Write an official response" className="min-w-0 flex-1 rounded-md border border-civic-line px-3 py-2 text-sm" />
            <button disabled={busy === `response-${item.id}`} onClick={() => sendResponse(item)}
              className="self-start rounded-md bg-civic-navy px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {busy === `response-${item.id}` ? "Sending…" : "Send response"}
            </button>
          </div>
          {item.response && <p className="mt-3 rounded-md bg-civic-bg p-3 text-sm"><strong>Latest response:</strong> {item.response}</p>}
        </article>
      ))}
    </div>
  );
}

const TABS = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "users", label: "Users", icon: Users },
  { key: "departments", label: "Departments", icon: Building2 },
  { key: "pigeonhole", label: "Pigeonhole", icon: MessageSquareText },
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
        {tab === "pigeonhole" && <PigeonholeTab />}
        {tab === "audit" && <AuditTab />}
      </div>
    </DashboardLayout>
  );
}


