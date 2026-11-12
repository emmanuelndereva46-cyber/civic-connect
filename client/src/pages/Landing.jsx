import { Link } from "react-router-dom";
import {
  Construction, Lightbulb, Trash2, Droplet, Waves, Building2, Leaf, MoreHorizontal,
  MessageSquareText, ShieldCheck, Eye, Route, Archive, Landmark,
} from "lucide-react";
import Navbar from "../components/Navbar.jsx";
import Reveal from "../components/Reveal.jsx";
import StatusBadge from "../components/StatusBadge.jsx";

const CATEGORIES = [
  { icon: Construction, label: "Roads" },
  { icon: Lightbulb, label: "Streetlights" },
  { icon: Trash2, label: "Waste Management" },
  { icon: Droplet, label: "Water" },
  { icon: Waves, label: "Drainage" },
  { icon: Building2, label: "Public Facilities" },
  { icon: Leaf, label: "Environment" },
  { icon: MoreHorizontal, label: "Other" },
];

const STEPS = [
  { n: "1", title: "Report", body: "Describe the issue, add its location and a photo." },
  { n: "2", title: "Review", body: "The system routes it to the right department automatically." },
  { n: "3", title: "Respond", body: "An officer reviews it and takes action." },
  { n: "4", title: "Track", body: "You follow every status change until it's resolved." },
];

const BENEFITS = [
  { icon: Route, title: "Faster routing", body: "Reports reach the responsible department without manual sorting." },
  { icon: Eye, title: "Transparent tracking", body: "Follow a report's status from submission to resolution." },
  { icon: ShieldCheck, title: "Confidential feedback", body: "Share concerns anonymously through the Pigeonhole when needed." },
  { icon: Archive, title: "Centralized records", body: "Every report and submission is kept in one searchable system." },
  { icon: Landmark, title: "Government accountability", body: "Officers record actions taken, visible to the citizen who reported it." },
  { icon: MessageSquareText, title: "Easy reporting", body: "A short guided form takes you from issue to reference number." },
];

export default function Landing() {
  return (
    <div>
      <Navbar />

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 md:grid-cols-2 md:py-24">
        <div>
          <span className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-civic-line bg-white px-3 py-1 text-xs font-medium text-civic-teal">
            <span className="relative flex h-2 w-2"><span className="absolute inset-0 animate-pulse-ring rounded-full bg-civic-teal" /><span className="relative h-2 w-2 rounded-full bg-civic-teal" /></span>
            Citizens &amp; government, connected
          </span>
          <h1 className="animate-fade-up mt-4 text-4xl font-bold leading-tight text-civic-navy md:text-5xl" style={{ animationDelay: ".1s" }}>
            <span className="gradient-text">Report. Speak up. Track.</span> Improve your community.
          </h1>
          <p className="animate-fade-up mt-5 max-w-md text-civic-ink/75" style={{ animationDelay: ".2s" }}>
            CivicConnect gives citizens a centralized way to report public issues, submit
            feedback and suggestions, and track how government departments respond.
          </p>
          <div className="animate-fade-up mt-8 flex flex-wrap gap-3" style={{ animationDelay: ".3s" }}>
            <Link to="/report/new" className="rounded-md bg-civic-navy px-5 py-3 text-sm font-semibold text-white hover:bg-civic-blue">
              Report an Issue
            </Link>
            <Link to="/pigeonhole" className="rounded-md bg-civic-teal px-5 py-3 text-sm font-semibold text-white hover:opacity-90">
              Submit Pigeonhole Feedback
            </Link>
            <Link to="/track" className="rounded-md border border-civic-line px-5 py-3 text-sm font-semibold text-civic-ink hover:border-civic-navy">
              Track a Report
            </Link>
          </div>
        </div>

        <div className="animate-fade-up" style={{ animationDelay: ".35s" }}>
        <div className="animate-float-y rounded-lg border border-civic-line bg-white p-5 shadow-xl shadow-civic-blue/10">
          <p className="text-xs font-medium uppercase tracking-wide text-civic-ink/50">Reference CC-2026-000418</p>
          <h3 className="mt-1 font-semibold text-civic-navy">Pothole on Kenyatta Avenue</h3>
          <div className="mt-3"><StatusBadge status="IN_PROGRESS" /></div>
          <ol className="mt-5 space-y-3 border-l border-civic-line pl-4 text-sm">
            <li className="text-civic-ink/60">Submitted — routed to Roads &amp; Transport</li>
            <li className="text-civic-ink/60">Under review — assigned to a field officer</li>
            <li className="font-medium text-civic-navy">In progress — repair crew scheduled</li>
          </ol>
        </div>
        </div>
      </section>

      {/* Categories */}
      <section className="border-t border-civic-line bg-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal><h2 className="text-2xl font-semibold text-civic-navy">What can you report?</h2></Reveal>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {CATEGORIES.map(({ icon: Icon, label }, i) => (
              <Reveal key={label} delay={i * 60}>
              <Link
                to="/report/new"
                className="card-lift flex flex-col items-center gap-3 rounded-lg border border-civic-line px-4 py-6 text-center hover:border-civic-navy"
              >
                <Icon className="text-civic-teal" size={26} />
                <span className="text-sm font-medium">{label}</span>
              </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-16">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal><h2 className="text-2xl font-semibold text-civic-navy">How it works</h2></Reveal>
          <div className="mt-8 grid gap-6 sm:grid-cols-4">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 120} className="card-lift rounded-lg border border-civic-line bg-white p-5">
                <span className="text-2xl font-bold text-civic-teal">{s.n}</span>
                <h3 className="mt-2 font-semibold text-civic-navy">{s.title}</h3>
                <p className="mt-1 text-sm text-civic-ink/70">{s.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Pigeonhole */}
      <section className="relative overflow-hidden border-y border-civic-line bg-civic-navy py-16 text-white">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 animate-drift-a rounded-full bg-civic-teal/30 blur-3xl" />
        <Reveal className="relative mx-auto max-w-6xl px-6 md:flex md:items-center md:justify-between">
          <div className="max-w-xl">
            <h2 className="text-2xl font-semibold">Have a suggestion, complaint or concern?</h2>
            <p className="mt-3 text-white/75">
              Send it straight to the relevant department through the digital Pigeonhole —
              a suggestion box that works the way a citizen actually communicates. Submit
              with your contact details, or anonymously when you'd rather not.
            </p>
          </div>
          <Link
            to="/pigeonhole"
            className="mt-6 inline-block rounded-md bg-civic-teal px-6 py-3 text-sm font-semibold hover:opacity-90 md:mt-0"
          >
            Use the Pigeonhole
          </Link>
        </Reveal>
      </section>

      {/* Benefits */}
      <section className="py-16">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal><h2 className="text-2xl font-semibold text-civic-navy">Why CivicConnect</h2></Reveal>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map(({ icon: Icon, title, body }, i) => (
              <Reveal key={title} delay={(i % 3) * 120} className="card-lift rounded-lg border border-civic-line bg-white p-5">
                <Icon className="text-civic-blue" size={22} />
                <h3 className="mt-3 font-semibold text-civic-navy">{title}</h3>
                <p className="mt-1 text-sm text-civic-ink/70">{body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-civic-line bg-white py-10 text-center text-sm text-civic-ink/60">
        <p>CivicConnect is a university system-development project and is not an official government service.</p>
        <p className="mt-1">Demo build · {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
