import { MapPin, Megaphone, Building2, MessageSquareText, Lightbulb, Droplet, Landmark, Trash2 } from "lucide-react";

const FLOATERS = [
  { Icon: MapPin, top: "12%", left: "6%", size: 40, delay: "0s" },
  { Icon: Megaphone, top: "22%", left: "88%", size: 44, delay: "-2s" },
  { Icon: Building2, top: "58%", left: "4%", size: 46, delay: "-4s" },
  { Icon: MessageSquareText, top: "70%", left: "90%", size: 38, delay: "-1s" },
  { Icon: Lightbulb, top: "40%", left: "93%", size: 30, delay: "-3s" },
  { Icon: Droplet, top: "86%", left: "18%", size: 30, delay: "-5s" },
  { Icon: Landmark, top: "8%", left: "58%", size: 36, delay: "-6s" },
  { Icon: Trash2, top: "90%", left: "70%", size: 30, delay: "-2.5s" },
];

const STARS = Array.from({ length: 36 }, (_, i) => ({
  top: `${(i * 53) % 100}%`, left: `${(i * 37 + 11) % 100}%`, delay: `${(i % 9) * 0.5}s`,
}));

/** Fixed, non-interactive backdrop: drifting colour blobs, dotted grid, a "city map" of roads,
 *  pulsing report pins and floating civic icons. Pure CSS animation. */
export default function AnimatedBackground() {
  return (
    <div className="app-bg" aria-hidden="true">
      <div className="blob animate-drift-a" style={{ width: 520, height: 520, top: "-12%", left: "-8%", background: "rgb(var(--blob-1))" }} />
      <div className="blob animate-drift-b" style={{ width: 460, height: 460, top: "30%", right: "-10%", background: "rgb(var(--blob-2))" }} />
      <div className="blob animate-drift-a" style={{ width: 380, height: 380, bottom: "-10%", left: "30%", background: "rgb(var(--blob-3))", animationDelay: "-9s" }} />

      <div className="grid" />

      <svg className="roads absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 1000 800">
        <path className="main" d="M-20 620 C 200 560, 320 700, 520 600 S 860 480, 1020 540" />
        <path d="M120 -20 C 180 200, 80 380, 240 520 S 300 760, 260 820" />
        <path d="M-20 180 C 240 240, 400 80, 640 200 S 900 320, 1020 260" />
        <path d="M760 -20 C 700 200, 820 360, 740 520 S 800 720, 860 820" />
        <path d="M420 -20 C 460 160, 380 320, 480 440" />
      </svg>

      {[["18%", "28%"], ["62%", "74%"], ["80%", "52%"], ["34%", "82%"]].map(([l, t], i) => (
        <span key={i} className="ping" style={{ left: l, top: t, animationDelay: `${i * 0.6}s` }} />
      ))}

      {FLOATERS.map(({ Icon, top, left, size, delay }, i) => (
        <span key={i} className="floater" style={{ top, left, animationDelay: delay, animationDuration: `${6 + (i % 4)}s` }}>
          <Icon size={size} strokeWidth={1.4} />
        </span>
      ))}

      {STARS.map((s, i) => (
        <span key={i} className="star" style={{ top: s.top, left: s.left, animationDelay: s.delay }} />
      ))}
    </div>
  );
}
