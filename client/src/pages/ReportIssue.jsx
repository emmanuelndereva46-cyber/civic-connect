import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { LocateFixed, X, CheckCircle2 } from "lucide-react";
import Navbar from "../components/Navbar.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import api from "../api/client";

const MAX_FILE_MB = 5;
const ACCEPTED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const STEP_LABELS = ["Issue information", "Location", "Evidence", "Review", "Done"];

function Stepper({ step }) {
  return (
    <ol className="mb-8 flex flex-wrap gap-x-6 gap-y-2 text-sm">
      {STEP_LABELS.slice(0, 4).map((label, i) => (
        <li key={label} className={`flex items-center gap-2 ${i + 1 <= step ? "text-civic-navy" : "text-civic-ink/40"}`}>
          <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
            i + 1 <= step ? "bg-civic-navy text-white" : "bg-civic-line text-civic-ink/50"
          }`}>{i + 1}</span>
          {label}
        </li>
      ))}
    </ol>
  );
}

export default function ReportIssue() {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    title: "", description: "", categoryId: "", dateObserved: "", priority: "MEDIUM",
    county: "", subCounty: "", ward: "", location: "", latitude: null, longitude: null,
  });
  const [images, setImages] = useState([]); // { file, previewUrl }


useEffect(() => {
  let cancelled = false;

  async function loadCategories() {
    try {
      const { data } = await api.get("/categories");

      if (!cancelled) {
        setCategories(Array.isArray(data) ? data : (data.categories ?? []));
      }
    } catch (err) {
      if (!cancelled) {
        setCategories([]);
        setError(
          err.response?.data?.message ||
          "Unable to load report categories. Please try again."
        );
      }
    }
  }

  loadCategories();

  return () => {
    cancelled = true;
  };
}, []);


  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function useMyLocation() {
    if (!navigator.geolocation) return setError("Your browser does not support geolocation.");
    navigator.geolocation.getCurrentPosition(
      (pos) => setForm((f) => ({ ...f, latitude: pos.coords.latitude, longitude: pos.coords.longitude })),
      () => setError("Could not get your location. You can still enter it manually below."),
    );
  }

  function handleFiles(fileList) {
    setError("");
    const next = [...images];
    for (const file of Array.from(fileList)) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError("Only JPG, PNG and WebP images are supported.");
        continue;
      }
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        setError(`Each image must be under ${MAX_FILE_MB}MB.`);
        continue;
      }
      next.push({ file, previewUrl: URL.createObjectURL(file) });
    }
    setImages(next.slice(0, 4));
  }

  function removeImage(i) {
    setImages((imgs) => imgs.filter((_, idx) => idx !== i));
  }

  function validateStep1() {
    if (form.title.trim().length < 3) return "Enter a short issue title (at least 3 characters).";
    if (form.description.trim().length < 10) return "Describe the issue in at least 10 characters.";
    if (!form.categoryId) return "Select a category.";
    return "";
  }

  function goNext() {
    if (step === 1) {
      const msg = validateStep1();
      if (msg) return setError(msg);
    }
    setError("");
    setStep((s) => Math.min(s + 1, 4));
  }


async function handleSubmit() {
  const location = [
    form.location.trim(),
    form.ward.trim(),
    form.subCounty.trim(),
    form.county.trim(),
  ]
    .filter(Boolean)
    .join(", ");

  if (!location) {
    setError(
      "Enter at least an area, street, landmark, ward, sub-county, or county."
    );
    setStep(2);
    return;
  }

  setSubmitting(true);
  setError("");

  try {
    const { data } = await api.post("/reports", {
      title: form.title.trim(),
      description: form.description.trim(),
      categoryId: Number(form.categoryId),
      location,
      latitude: form.latitude ?? undefined,
      longitude: form.longitude ?? undefined,
    });

    setResult(data);
    setStep(5);
  } catch (err) {
    setError(
      err.response?.data?.message ||
      "Could not submit the report. Please try again."
    );
  } finally {
    setSubmitting(false);
  }
}

  if (!user) {
    return (
      <div>
        <Navbar />
        <div className="mx-auto max-w-lg px-6 py-20 text-center">
          <h1 className="text-xl font-semibold text-civic-navy">Log in to report an issue</h1>
          <p className="mt-2 text-civic-ink/60">Reports are tied to your account so you can track their progress.</p>
          <Link to="/login" className="mt-6 inline-block rounded-md bg-civic-navy px-5 py-2.5 text-sm font-semibold text-white">Log in</Link>
        </div>
      </div>
    );
  }

  const selectedCategory = categories.find((c) => String(c.id) === String(form.categoryId));

  return (
    <div>
      <Navbar />
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-2xl font-bold text-civic-navy">Report an issue</h1>
        <p className="mt-1 text-sm text-civic-ink/60">A few short steps get your report to the right department.</p>

        {step <= 4 && <div className="mt-8"><Stepper step={step} /></div>}
        {error && <div className="mb-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Issue title</label>
              <input value={form.title} onChange={update("title")}
                className="mt-1 w-full rounded-md border border-civic-line px-3 py-2 text-sm focus:border-civic-blue"
                placeholder="e.g. Large pothole near the market" />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <textarea value={form.description} onChange={update("description")} rows={4}
                className="mt-1 w-full rounded-md border border-civic-line px-3 py-2 text-sm focus:border-civic-blue"
                placeholder="What is the issue, and how is it affecting the community?" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Category</label>
                <select value={form.categoryId} onChange={update("categoryId")}
                  className="mt-1 w-full rounded-md border border-civic-line px-3 py-2 text-sm focus:border-civic-blue">
                  <option value="">Select a category</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {selectedCategory && (
                  <p className="mt-1 text-xs text-civic-ink/50">Routes to {selectedCategory.departmentName ?? "Unassigned department"}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium">Priority</label>
                <select value={form.priority} onChange={update("priority")}
                  className="mt-1 w-full rounded-md border border-civic-line px-3 py-2 text-sm focus:border-civic-blue">
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Date observed <span className="text-civic-ink/40">(optional)</span></label>
              <input type="date" value={form.dateObserved} onChange={update("dateObserved")}
                className="mt-1 w-full rounded-md border border-civic-line px-3 py-2 text-sm focus:border-civic-blue" />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <button type="button" onClick={useMyLocation}
              className="flex items-center gap-2 rounded-md border border-civic-line px-3 py-2 text-sm font-medium text-civic-blue hover:border-civic-blue">
              <LocateFixed size={16} /> Use my location
            </button>
            {form.latitude && (
              <p className="text-xs text-civic-ink/50">
                Captured: {form.latitude.toFixed(5)}, {form.longitude.toFixed(5)} (kept private, used for internal routing only)
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">County</label>
                <input value={form.county} onChange={update("county")}
                  className="mt-1 w-full rounded-md border border-civic-line px-3 py-2 text-sm focus:border-civic-blue" />
              </div>
              <div>
                <label className="text-sm font-medium">Sub-county</label>
                <input value={form.subCounty} onChange={update("subCounty")}
                  className="mt-1 w-full rounded-md border border-civic-line px-3 py-2 text-sm focus:border-civic-blue" />
              </div>
              <div>
                <label className="text-sm font-medium">Ward</label>
                <input value={form.ward} onChange={update("ward")}
                  className="mt-1 w-full rounded-md border border-civic-line px-3 py-2 text-sm focus:border-civic-blue" />
              </div>
              <div>
                <label className="text-sm font-medium">Area / street / landmark</label>
                <input value={form.location} onChange={update("location")}
                  className="mt-1 w-full rounded-md border border-civic-line px-3 py-2 text-sm focus:border-civic-blue" />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer rounded-lg border-2 border-dashed border-civic-line bg-white p-8 text-center text-sm text-civic-ink/60 hover:border-civic-blue"
            >
              Click to upload photos (JPG, PNG, WebP · up to {MAX_FILE_MB}MB each, max 4)
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden
                onChange={(e) => handleFiles(e.target.files)} />
            </div>
            {images.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {images.map((img, i) => (
                  <div key={i} className="group relative overflow-hidden rounded-md border border-civic-line">
                    <img src={img.previewUrl} alt="" className="h-24 w-full object-cover" />
                    <button type="button" onClick={() => removeImage(i)}
                      className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-civic-ink/50">
              Evidence is optional. Photo storage isn't wired up in this demo build yet — previews here
              are local only and are not uploaded to the server. See the README for adding a storage backend.
            </p>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4 text-sm">
            <div className="rounded-lg border border-civic-line bg-white p-5">
              <dl className="space-y-3">
                <div><dt className="text-civic-ink/50">Title</dt><dd className="font-medium">{form.title}</dd></div>
                <div><dt className="text-civic-ink/50">Description</dt><dd>{form.description}</dd></div>
                <div><dt className="text-civic-ink/50">Category</dt><dd>{selectedCategory?.name} → {selectedCategory?.departmentName ?? "Unassigned department"}</dd></div>
                <div><dt className="text-civic-ink/50">Priority</dt><dd className="capitalize">{form.priority.toLowerCase()}</dd></div>
                <div><dt className="text-civic-ink/50">Location</dt><dd>{[form.location, form.ward, form.subCounty, form.county].filter(Boolean).join(", ") || "Not provided"}</dd></div>
                <div><dt className="text-civic-ink/50">Photos attached</dt><dd>{images.length}</dd></div>
              </dl>
            </div>
          </div>
        )}

        {step === 5 && result && (
          <div className="rounded-lg border border-civic-line bg-white p-8 text-center">
            <CheckCircle2 className="mx-auto text-emerald-600" size={40} />
            <h2 className="mt-4 text-xl font-semibold text-civic-navy">Your report has been submitted successfully.</h2>
            <dl className="mx-auto mt-6 max-w-xs space-y-2 text-left text-sm">
              <div className="flex justify-between"><dt className="text-civic-ink/50">Reference</dt><dd className="font-semibold">{result.referenceNumber}</dd></div>
              <div className="flex justify-between"><dt className="text-civic-ink/50">Department</dt><dd>{result.department ?? "Not assigned"}</dd></div>
              <div className="flex justify-between"><dt className="text-civic-ink/50">Status</dt><dd className="capitalize">{result.status.toLowerCase()}</dd></div>
            </dl>
            <div className="mt-8 flex justify-center gap-3">
              <Link to="/dashboard" className="rounded-md bg-civic-navy px-4 py-2 text-sm font-medium text-white">Go to dashboard</Link>
              <Link to="/track" className="rounded-md border border-civic-line px-4 py-2 text-sm font-medium">Track this report</Link>
            </div>
          </div>
        )}

        {step <= 4 && (
          <div className="mt-8 flex justify-between">
            <button type="button" onClick={() => setStep((s) => Math.max(s - 1, 1))} disabled={step === 1}
              className="rounded-md border border-civic-line px-4 py-2 text-sm font-medium disabled:opacity-40">
              Back
            </button>
            {step < 4 ? (
              <button type="button" onClick={goNext} className="rounded-md bg-civic-navy px-5 py-2 text-sm font-semibold text-white hover:bg-civic-blue">
                Continue
              </button>
            ) : (
              <button type="button" onClick={handleSubmit} disabled={submitting}
                className="rounded-md bg-civic-navy px-5 py-2 text-sm font-semibold text-white hover:bg-civic-blue disabled:opacity-60">
                {submitting ? "Submitting…" : "Submit report"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
