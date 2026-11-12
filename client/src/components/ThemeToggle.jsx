import { Sun, Moon } from "lucide-react";
import { useTheme } from "../context/ThemeContext.jsx";

export default function ThemeToggle({ className = "" }) {
  const { theme, toggleTheme } = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className={`theme-toggle relative grid h-9 w-9 place-items-center rounded-full border border-civic-line text-civic-navy hover:border-civic-teal hover:bg-civic-teal/10 ${className}`}
    >
      <Sun size={18} className="sun absolute" />
      <Moon size={18} className="moon absolute" />
    </button>
  );
}
