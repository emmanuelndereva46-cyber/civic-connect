const STYLES = {
  SUBMITTED: "bg-slate-100 text-slate-700",
  RECEIVED: "bg-slate-100 text-slate-700",
  UNDER_REVIEW: "bg-amber-100 text-amber-800",
  ASSIGNED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  AWAITING_INFORMATION: "bg-amber-100 text-amber-800",
  RESOLVED: "bg-emerald-100 text-emerald-800",
  RESPONSE_PROVIDED: "bg-emerald-100 text-emerald-800",
  CLOSED: "bg-slate-200 text-slate-600",
  REJECTED: "bg-red-100 text-red-700",
  INVALID: "bg-red-100 text-red-700",
  DUPLICATE: "bg-red-100 text-red-700",
};

export default function StatusBadge({ status }) {
  const style = STYLES[status] || "bg-slate-100 text-slate-700";
  const label = String(status || "").replace(/_/g, " ").toLowerCase();
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ${style}`}>
      {label}
    </span>
  );
}
