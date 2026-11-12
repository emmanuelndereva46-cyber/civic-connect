import { Link } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";

export default function NotFound() {
  return (
    <div>
      <Navbar />
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-3xl font-bold text-civic-navy">Page not found</h1>
        <p className="mt-2 text-civic-ink/60">The page you're looking for doesn't exist or may have moved.</p>
        <Link to="/" className="mt-6 inline-block rounded-md bg-civic-navy px-5 py-2.5 text-sm font-semibold text-white">
          Back home
        </Link>
      </div>
    </div>
  );
}
