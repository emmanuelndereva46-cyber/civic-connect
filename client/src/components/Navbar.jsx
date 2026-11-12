import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import ThemeToggle from "./ThemeToggle.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const LINKS = [
  { to: "/", label: "Home" },
  { to: "/#how-it-works", label: "How It Works" },
  { to: "/report/new", label: "Report an Issue" },
  { to: "/pigeonhole", label: "Pigeonhole" },
  { to: "/track", label: "Track Report" },
];

function dashboardPathFor(role) {
  if (role === "ADMIN") return "/admin";
  if (role === "OFFICER") return "/officer";
  return "/dashboard";
}

export default function Navbar() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b border-civic-line bg-civic-bg/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="text-lg font-bold tracking-tight text-civic-navy transition-transform hover:scale-105">
          CivicConnect
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {LINKS.map((l) => (
            <Link key={l.label} to={l.to} className="nav-link relative text-sm text-civic-ink/80 transition-colors hover:text-civic-navy after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-0 after:bg-civic-teal after:transition-all hover:after:w-full">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
        <ThemeToggle />
        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <button
              onClick={() => navigate(dashboardPathFor(user.role))}
              className="rounded-md bg-civic-navy px-4 py-2 text-sm font-medium text-white hover:bg-civic-blue"
            >
              My dashboard
            </button>
          ) : (
            <>
              <Link to="/login" className="text-sm font-medium text-civic-ink/80 hover:text-civic-navy">
                Login
              </Link>
              <Link
                to="/register"
                className="rounded-md bg-civic-navy px-4 py-2 text-sm font-medium text-white hover:bg-civic-blue"
              >
                Register
              </Link>
            </>
          )}
        </div>

        <button className="md:hidden" onClick={() => setOpen((v) => !v)} aria-label="Toggle menu">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
        </div>
      </div>

      {open && (
        <div className="animate-fade-up border-t border-civic-line px-6 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            {LINKS.map((l) => (
              <Link key={l.label} to={l.to} onClick={() => setOpen(false)} className="text-sm">
                {l.label}
              </Link>
            ))}
            {user ? (
              <Link to={dashboardPathFor(user.role)} onClick={() => setOpen(false)} className="text-sm font-medium">
                My dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" onClick={() => setOpen(false)} className="text-sm font-medium">Login</Link>
                <Link to="/register" onClick={() => setOpen(false)} className="text-sm font-medium">Register</Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
