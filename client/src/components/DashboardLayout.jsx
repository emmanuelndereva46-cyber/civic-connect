import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bell, LogOut } from "lucide-react";
import ThemeToggle from "./ThemeToggle.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function DashboardLayout({ title, items, children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-civic-line bg-white md:flex">
        <div className="border-b border-civic-line px-6 py-5">
          <Link to="/" className="text-base font-bold text-civic-navy">CivicConnect</Link>
          <p className="mt-1 text-xs text-civic-ink/60">{user?.role?.charAt(0) + user?.role?.slice(1).toLowerCase()} account</p>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {items.map((item) => {
            const active = location.pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all ${
                  active ? "bg-civic-navy text-white shadow-md" : "text-civic-ink/80 hover:translate-x-1 hover:bg-civic-teal/10"
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-civic-line p-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-civic-ink/70 hover:bg-civic-bg"
          >
            <LogOut size={18} /> Log out
          </button>
        </div>
      </aside>

      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-civic-line bg-white px-6 py-4">
          <h1 className="text-lg font-semibold text-civic-navy">{title}</h1>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link to="/notifications" className="relative text-civic-ink/70 hover:text-civic-navy" aria-label="Notifications">
              <Bell size={20} />
            </Link>
            <span className="text-sm text-civic-ink/70">{user?.fullName}</span>
          </div>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
