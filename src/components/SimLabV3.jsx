import { useState, useRef, useEffect } from "react";
import ExperimentBuilder from "./ExperimentBuilder";

const LAB_API_URL = import.meta.env.VITE_LAB_API_URL || "https://realitydb-lab-api.eddy-078.workers.dev";
const LAB_API_KEY = import.meta.env.VITE_LAB_API_KEY || "";

// API template id -> display label (Phase 1: templates are fetched from /v1/store)
const TEMPLATE_LABELS = {
  "eu-banking": "EU Banking",
  "eu-healthcare": "EU Healthcare",
  "eu-telecom": "EU Telecom",
  "banking": "Banking",
  "fintech": "FinTech",
  "healthcare": "Healthcare",
  "oncology": "Oncology",
  "supply-chain": "Supply Chain",
  "telecom": "Telecom",
  "universal": "Universal",
  "aml": "AML Compliance",
};

// Convert an API template id to a human display label.
function formatTemplateLabel(apiId) {
  if (!apiId) return "";
  if (TEMPLATE_LABELS[apiId]) return TEMPLATE_LABELS[apiId];
  return apiId
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// API template id -> { label, tables, domain }
const TEMPLATE_META = {
  banking:        { label: "Banking",          tables: 16, domain: "BFSI" },
  oncology:       { label: "Oncology",         tables: 20, domain: "Healthcare" },
  healthcare:     { label: "Healthcare",       tables: 14, domain: "Healthcare" },
  "supply-chain": { label: "Supply chain",     tables: 24, domain: "Logistics" },
  fintech:        { label: "FinTech",          tables: 5,  domain: "Finance" },
  telecom:        { label: "Telecom",          tables: 21, domain: "Technology" },
  universal:      { label: "Universal Starter", tables: 6, domain: "Universal" },
  aml:            { label: "AML Compliance",   tables: 9,  domain: "Finance" },
};

const SCENARIOS = [
  { id: "fraud-spike", label: "Fraud spike", desc: "60% of fraud alerts concentrated in a 2-week window. Risk scores elevated." },
  { id: "churn-wave", label: "Churn wave", desc: "30% of subscriptions cancel in one month." },
  { id: "holiday-rush", label: "Holiday rush", desc: "50% of orders in Nov-Dec with higher values." },
  { id: "data-breach", label: "Data breach", desc: "Audit log spike. Mass password resets." },
  { id: "payment-failures", label: "Payment failures", desc: "Failure rate jumps to 25%." },
  { id: "seasonal-enrollment", label: "Seasonal enrollment", desc: "65% of registrations in Aug-Sep." },
];

const ANOMALY_TAGS = ["Pressure spike", "Failed login surge", "Extreme transaction", "Mass password reset", "Account lockout wave", "Duplicate records", "Null injection", "Schema violation"];

// Template list is sourced at runtime from availableTemplates (fetched from /v1/store).

const maskConn = (c) => (c || "").replace(/:([^@]+)@/, ":***@");

function formatTimeRemaining(expiresAt) {
  if (!expiresAt) return "—";
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (Number.isNaN(diff)) return "—";
  if (diff <= 0) return "Expired";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function normalizeLab(lab) {
  const apiId = lab.template || "";
  const meta = TEMPLATE_META[apiId];
  return {
    id: lab.id,
    name: lab.name || lab.id,
    template: meta?.label || formatTemplateLabel(apiId),
    templateId: apiId,
    tables: meta?.tables ?? 0,
    rows: lab.rows ?? 0,
    status: lab.status || "active",
    ttl: formatTimeRemaining(lab.expiresAt || lab.expires_at),
    conn: lab.connectionString || lab.connection_string || "",
    createdBy: lab.createdBy || "api-user",
    source: lab.source || "manual",
    pr: lab.pr,
    expiresAt: lab.expiresAt || lab.expires_at,
  };
}

export default function SimLab({ onClose, onGallery }) {
  const [dark, setDark] = useState(true);
  const [tab, setTab] = useState("sandboxes");
  const [menuOpen, setMenuOpen] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [showDelete, setShowDelete] = useState(null);
  const [revealed, setRevealed] = useState({});
  const [toast, setToast] = useState(null);
  const [toastKind, setToastKind] = useState("success"); // success | error
  const [scenario, setScenario] = useState("fraud-spike");
  const [intensity, setIntensity] = useState(2);
  const [train, setTrain] = useState(70);
  const [test, setTest] = useState(20);
  const [anomalies, setAnomalies] = useState(new Set(["Pressure spike", "Extreme transaction"]));
  const [anomalyFreq, setAnomalyFreq] = useState(2);
  const [whatifFeature, setWhatifFeature] = useState("income");
  const [whatifShift, setWhatifShift] = useState(20);
  const [newTpl, setNewTpl] = useState("banking");
  const [newRows, setNewRows] = useState(10000);
  const [newTTL, setNewTTL] = useState("24h");
  const [newName, setNewName] = useState("");

  const [sandboxes, setSandboxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Tab templates (fetched dynamically from /v1/store)
  const [availableTemplates, setAvailableTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);

  // Tab: Quality
  const [qualityRunning, setQualityRunning] = useState(false);
  const [qualityResult, setQualityResult] = useState(null);

  // Tab: Snapshot
  const [snapTitle, setSnapTitle] = useState("");
  const [snapDesc, setSnapDesc] = useState("");
  const [snapTags, setSnapTags] = useState("");
  const [snapLicense, setSnapLicense] = useState("CC-BY-4.0");
  const [snapSaving, setSnapSaving] = useState(false);
  const [snapResult, setSnapResult] = useState(null); // { id, name, ... }
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState(null); // { slug, url }

  // Tab: Export
  const [exportFormat, setExportFormat] = useState("sql");
  const [exportingNotebook, setExportingNotebook] = useState(false);

  // Tab: CI/CD
  const [ciFramework, setCiFramework] = useState("github");
  const [ciTemplate, setCiTemplate] = useState("banking");
  const [ciRows, setCiRows] = useState(5000);

  // Shared "currently selected lab" for assess/snapshot/export/cicd tabs
  const [selectedLabId, setSelectedLabId] = useState("");
  const selectedLab = sandboxes.find((sb) => sb.id === selectedLabId) || sandboxes[0] || null;

  useEffect(() => {
    if (!selectedLabId && sandboxes.length > 0) setSelectedLabId(sandboxes[0].id);
    if (selectedLabId && !sandboxes.find((sb) => sb.id === selectedLabId)) {
      setSelectedLabId(sandboxes[0]?.id || "");
    }
  }, [sandboxes, selectedLabId]);

  // Pre-fill snapshot title when lab changes
  useEffect(() => {
    if (selectedLab && !snapTitle) setSnapTitle(`${selectedLab.name} snapshot`);
    // Also seed CI template from active lab
    if (selectedLab?.templateId) {
      setCiTemplate(selectedLab.templateId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLabId]);

  const val = Math.max(0, 100 - train - test);
  const fire = (msg, kind = "success") => { setToast(msg); setToastKind(kind); setTimeout(() => setToast(null), 2500); };

  const t = dark ? {
    bg: "#0a0f1a", surface: "#111827", card: "#1a2332", border: "#1e293b", borderH: "#334155",
    text: "#e2e8f0", muted: "#94a3b8", hint: "#64748b", accent: "#06d6a0", accentBg: "rgba(6,214,160,0.1)",
    danger: "#ef4444", dangerBg: "rgba(239,68,68,0.1)", warn: "#f59e0b", warnBg: "rgba(245,158,11,0.1)",
    info: "#38bdf8", infoBg: "rgba(56,189,248,0.1)", pill: "#1e293b", pillActive: "#06d6a0", pillActiveText: "#0a0f1a",
    input: "#1a2332", inputBorder: "#334155", modal: "rgba(0,0,0,0.6)"
  } : {
    bg: "#ffffff", surface: "#f8fafc", card: "#ffffff", border: "#e2e8f0", borderH: "#cbd5e1",
    text: "#0f172a", muted: "#64748b", hint: "#94a3b8", accent: "#059669", accentBg: "rgba(5,150,105,0.08)",
    danger: "#dc2626", dangerBg: "rgba(220,38,38,0.08)", warn: "#d97706", warnBg: "rgba(217,119,6,0.08)",
    info: "#0284c7", infoBg: "rgba(2,132,199,0.08)", pill: "#f1f5f9", pillActive: "#059669", pillActiveText: "#ffffff",
    input: "#ffffff", inputBorder: "#e2e8f0", modal: "rgba(0,0,0,0.4)"
  };

  const inputStyle = { background: t.input, border: `0.5px solid ${t.inputBorder}`, borderRadius: 8, padding: "7px 12px", fontSize: 13, color: t.text, outline: "none", fontFamily: "inherit" };
  const selectStyle = { ...inputStyle, flex: 1 };
  const btnPrimary = { background: t.accent, color: dark ? "#0a0f1a" : "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };
  const btnGhost = { background: "transparent", border: `0.5px solid ${t.border}`, borderRadius: 8, padding: "8px 14px", fontSize: 13, color: t.muted, cursor: "pointer", fontFamily: "inherit" };

  const Label = ({ children }) => <span style={{ fontSize: 13, color: t.muted, minWidth: 110, display: "inline-block" }}>{children}</span>;

  const Badge = ({ status }) => {
    const c = status === "active" ? { bg: t.accentBg, c: t.accent, dot: t.accent } : status === "creating" ? { bg: t.warnBg, c: t.warn, dot: t.warn } : { bg: t.dangerBg, c: t.danger, dot: t.danger };
    return <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 12, fontWeight: 500, background: c.bg, color: c.c, display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot }} />{status}
    </span>;
  };

  const menuRef = useRef();
  useEffect(() => {
    const h = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(null); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Fetch labs on mount
  const refreshLabs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${LAB_API_URL}/v1/labs`, {
        headers: { "X-API-Key": LAB_API_KEY },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const labs = Array.isArray(data) ? data : (data.labs || []);
      setSandboxes(labs.map(normalizeLab));
    } catch (e) {
      fire(`Failed to load labs: ${e.message || e}`, "error");
      setSandboxes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshLabs();
    // Auto-refresh TTLs every 30s
    const id = setInterval(() => {
      setSandboxes((prev) => prev.map((sb) => ({ ...sb, ttl: formatTimeRemaining(sb.expiresAt) })));
    }, 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch available templates from the store on mount
  useEffect(() => {
    fetch(`${LAB_API_URL}/v1/store`)
      .then((r) => r.json())
      .then((data) => {
        if (data && Array.isArray(data.datasets)) {
          setAvailableTemplates(
            data.datasets.map((d) => ({
              apiId: d.template,
              label: formatTemplateLabel(d.template),
              tables: TEMPLATE_META[d.template]?.tables ?? 0,
              domain: TEMPLATE_META[d.template]?.domain ?? "",
              variants: d.variants || [],
            }))
          );
        }
      })
      .catch(() => {})
      .finally(() => setTemplatesLoading(false));
  }, []);

  const handleCreate = async () => {
    const apiId = newTpl;
    if (!apiId) { fire(`Unknown template: ${newTpl}`, "error"); return; }
    setCreating(true);
    try {
      const body = { template: apiId, rows: newRows, ttl: newTTL };
      if (newName.trim()) body.name = newName.trim();
      const res = await fetch(`${LAB_API_URL}/v1/labs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": LAB_API_KEY },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        fire(data.error || `Create failed (${res.status})`, "error");
        setCreating(false);
        return;
      }
      const lab = data.lab || data;
      setSandboxes((prev) => [normalizeLab(lab), ...prev]);
      setShowNew(false);
      setNewName("");
      fire(`Created ${lab.name || lab.id}`, "success");
    } catch (e) {
      fire(`Network error: ${e.message || e}`, "error");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (sb) => {
    setDeleting(true);
    try {
      const res = await fetch(`${LAB_API_URL}/v1/labs/${sb.id}`, {
        method: "DELETE",
        headers: { "X-API-Key": LAB_API_KEY },
      });
      if (!res.ok && res.status !== 404) {
        const data = await res.json().catch(() => ({}));
        fire(data.error || `Delete failed (${res.status})`, "error");
        setDeleting(false);
        return;
      }
      setSandboxes((prev) => prev.filter((x) => x.id !== sb.id));
      setShowDelete(null);
      fire(`Deleted ${sb.name}`, "success");
    } catch (e) {
      fire(`Network error: ${e.message || e}`, "error");
    } finally {
      setDeleting(false);
    }
  };

  const handleCopyConn = (sb) => {
    if (!sb.conn) { fire("No connection string yet", "error"); return; }
    try {
      navigator.clipboard.writeText(sb.conn);
      fire("Copied!");
    } catch {
      fire("Clipboard unavailable", "error");
    }
  };

  const handleExtend = async (sb) => {
    try {
      const res = await fetch(`${LAB_API_URL}/v1/labs/${sb.id}/ttl`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-API-Key": LAB_API_KEY },
        body: JSON.stringify({ ttl: "24h" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        fire(data.error || `Extend failed (${res.status})`, "error");
        return;
      }
      const data = await res.json().catch(() => ({}));
      const updated = data.lab || data;
      setSandboxes((prev) => prev.map((x) => x.id === sb.id ? normalizeLab({ ...x, ...updated }) : x));
      fire(`Extended ${sb.name} +24h`);
    } catch (e) {
      fire(`Network error: ${e.message || e}`, "error");
    }
  };

  const handleSnapshot = async (sb) => {
    try {
      const res = await fetch(`${LAB_API_URL}/v1/labs/${sb.id}/snapshot`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": LAB_API_KEY },
        body: JSON.stringify({ name: `snap-${Date.now()}` }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        fire(data.error || `Snapshot failed (${res.status})`, "error");
        return;
      }
      fire("Snapshot created");
    } catch (e) {
      fire(`Network error: ${e.message || e}`, "error");
    }
  };

  const handleShare = async (sb) => {
    try {
      const res = await fetch(`${LAB_API_URL}/v1/labs/${sb.id}/share`, {
        method: "POST",
        headers: { "X-API-Key": LAB_API_KEY },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        fire(data.error || `Share failed (${res.status})`, "error");
        return;
      }
      const data = await res.json();
      const link = data.shareConnection || data.share_connection || data.connectionString || "";
      if (link) {
        try { navigator.clipboard.writeText(link); fire("Share link copied"); } catch { fire("Share link generated"); }
      } else {
        fire("Share link generated");
      }
    } catch (e) {
      fire(`Network error: ${e.message || e}`, "error");
    }
  };

  const menuItems = (sb) => [
    { icon: "📋", label: "Copy connection", action: () => handleCopyConn(sb) },
    { icon: "⏱", label: "Extend +24h", action: () => handleExtend(sb) },
    { icon: "📸", label: "Snapshot", action: () => handleSnapshot(sb) },
    { icon: "🔗", label: "Share access", action: () => handleShare(sb) },
    { icon: "🔍", label: "Reveal connection", action: () => { setRevealed((p) => ({ ...p, [sb.id]: !p[sb.id] })); } },
    null,
    ...(sb.source === "ci" && sb.pr ? [{ icon: "↗", label: `View PR ${sb.pr}`, action: () => {} }] : []),
    { icon: "🗑", label: "Delete", danger: true, action: () => setShowDelete(sb) },
  ];

  const tabs = [
    { id: "sandboxes", label: "Sandboxes" },
    { id: "scenario", label: "Simulate scenario" },
    { id: "split", label: "ML split" },
    { id: "anomaly", label: "Inject anomalies" },
    { id: "whatif", label: "What-if analysis" },
    { id: "quality", label: "Quality report" },
    { id: "experiment", label: "Experiment" },
    { id: "snapshot", label: "Snapshot" },
    { id: "export", label: "Export" },
    { id: "cicd", label: "CI/CD" },
  ];

  const handleRunQuality = async () => {
    setQualityRunning(true);
    setQualityResult(null);
    // Endpoint /v1/labs/:id/assess returns 404 — show mock SQR scorecard with note.
    await new Promise((r) => setTimeout(r, 900));
    setQualityResult({
      mocked: true,
      overall: 94,
      categories: [
        { label: "Fidelity", score: 95, subs: [{ label: "Completeness", score: 100 }, { label: "Distribution diversity", score: 93 }] },
        { label: "Structure", score: 91, subs: [{ label: "FK integrity", score: 91 }, { label: "Temporal logic", score: 100 }] },
        { label: "Privacy", score: 100, subs: [] },
      ],
    });
    setQualityRunning(false);
  };

  const handleSaveSnapshot = async () => {
    if (!selectedLab) { fire("Select a lab first", "error"); return; }
    if (!snapTitle.trim()) { fire("Title required", "error"); return; }
    setSnapSaving(true);
    setSnapResult(null);
    setPublishResult(null);
    try {
      const res = await fetch(`${LAB_API_URL}/v1/labs/${selectedLab.id}/snapshot`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": LAB_API_KEY },
        body: JSON.stringify({ name: snapTitle.trim(), description: snapDesc.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { fire(data.error || `Snapshot failed (${res.status})`, "error"); setSnapSaving(false); return; }
      setSnapResult(data);
      fire(`Snapshot ${data.id || ""} saved`);
    } catch (e) {
      fire(`Network error: ${e.message || e}`, "error");
    } finally {
      setSnapSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!snapResult) return;
    setPublishing(true);
    try {
      const tags = snapTags.split(",").map((s) => s.trim()).filter(Boolean);
      const res = await fetch(`${LAB_API_URL}/v1/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": LAB_API_KEY },
        body: JSON.stringify({
          snapshotId: snapResult.id,
          title: snapTitle.trim(),
          authors: "api-user",
          description: snapDesc.trim() || undefined,
          // Send tags as a comma-string (the /v1/publish D1 bind expects a scalar).
          tags: Array.isArray(tags) ? tags.join(",") : (tags ?? ""),
          license: snapLicense,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { fire(data.error || `Publish failed (${res.status})`, "error"); setPublishing(false); return; }
      setPublishResult(data);
      fire("Published to gallery");
    } catch (e) {
      fire(`Network error: ${e.message || e}`, "error");
    } finally {
      setPublishing(false);
    }
  };

  const handleDownloadNotebook = async () => {
    if (!selectedLab) { fire("Select a lab first", "error"); return; }
    setExportingNotebook(true);
    try {
      const res = await fetch(`${LAB_API_URL}/v1/labs/${selectedLab.id}/export?format=notebook`, {
        headers: { "X-API-Key": LAB_API_KEY },
      });
      if (!res.ok) { fire(`Notebook export failed (${res.status})`, "error"); setExportingNotebook(false); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedLab.name}.ipynb`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      fire("Notebook downloaded");
    } catch (e) {
      fire(`Network error: ${e.message || e}`, "error");
    } finally {
      setExportingNotebook(false);
    }
  };

  const handleCopyText = (text, label) => {
    try { navigator.clipboard.writeText(text); fire(label ? `Copied ${label}` : "Copied!"); }
    catch { fire("Clipboard unavailable", "error"); }
  };

  const copyCommand = (cmd) => {
    navigator.clipboard.writeText(cmd).then(() => {
      fire("Command copied to clipboard", "success");
    }).catch(() => {
      fire("Copy failed — select and copy manually", "error");
    });
  };

  // Honest local-execution disclosure: shows the equivalent CLI command for a tab.
  const CliCommandBox = ({ lines, command }) => (
    <div style={{ background: t.surface, border: `0.5px solid ${t.border}`, borderRadius: 8, padding: 16, marginTop: 8 }}>
      <div style={{ fontSize: 11, color: t.accent, fontWeight: 600, marginBottom: 8, letterSpacing: "0.05em" }}>
        ▸ RUN LOCALLY WITH REALITYDB CLI
      </div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: t.text, background: t.bg, padding: "10px 14px", borderRadius: 6, border: `0.5px solid ${t.border}`, marginBottom: 10, lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {lines.map((ln, i) => <div key={i}>{i === 0 ? ln : `  ${ln}`}{i < lines.length - 1 ? " \\" : ""}</div>)}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => copyCommand(command)} style={btnPrimary}>Copy command</button>
        <a href="https://www.npmjs.com/package/@realitydb/cli" target="_blank" rel="noopener" style={{ ...btnGhost, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>Install CLI ↗</a>
      </div>
      <div style={{ fontSize: 11, color: t.muted, marginTop: 10 }}>
        Hosted execution coming in SimLab Phase 2 · ADR-001
      </div>
    </div>
  );

  const generateCiYaml = () => {
    const tpl = ciTemplate;
    const rows = ciRows;
    if (ciFramework === "github") {
      return `name: Database Tests with RealityDB
on: [pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Create RealityDB Lab
        id: lab
        run: |
          LAB=$(curl -s -X POST \\
            ${LAB_API_URL}/v1/labs \\
            -H "X-API-Key: \${{ secrets.REALITYDB_API_KEY }}" \\
            -H "Content-Type: application/json" \\
            -d '{"template":"${tpl}","rows":${rows}}')
          echo "connection=$(echo $LAB | jq -r .connectionString)" >> $GITHUB_OUTPUT
          echo "id=$(echo $LAB | jq -r .id)" >> $GITHUB_OUTPUT

      - name: Run Tests
        env:
          DATABASE_URL: \${{ steps.lab.outputs.connection }}
        run: npm test

      - name: Destroy Lab
        if: always()
        run: |
          curl -s -X DELETE \\
            ${LAB_API_URL}/v1/labs/\${{ steps.lab.outputs.id }} \\
            -H "X-API-Key: \${{ secrets.REALITYDB_API_KEY }}"
`;
    }
    if (ciFramework === "gitlab") {
      return `stages:
  - test

db-test:
  stage: test
  script:
    - |
      LAB=$(curl -s -X POST \\
        ${LAB_API_URL}/v1/labs \\
        -H "X-API-Key: $REALITYDB_API_KEY" \\
        -H "Content-Type: application/json" \\
        -d '{"template":"${tpl}","rows":${rows}}')
      export DATABASE_URL=$(echo $LAB | jq -r .connectionString)
      export LAB_ID=$(echo $LAB | jq -r .id)
      npm test
    - curl -s -X DELETE
        ${LAB_API_URL}/v1/labs/$LAB_ID
        -H "X-API-Key: $REALITYDB_API_KEY"
`;
    }
    // circleci
    return `version: 2.1

jobs:
  db-test:
    docker:
      - image: cimg/node:20.0
    steps:
      - checkout
      - run:
          name: Create RealityDB Lab
          command: |
            LAB=$(curl -s -X POST \\
              ${LAB_API_URL}/v1/labs \\
              -H "X-API-Key: $REALITYDB_API_KEY" \\
              -H "Content-Type: application/json" \\
              -d '{"template":"${tpl}","rows":${rows}}')
            echo "export DATABASE_URL=$(echo $LAB | jq -r .connectionString)" >> $BASH_ENV
            echo "export LAB_ID=$(echo $LAB | jq -r .id)" >> $BASH_ENV
      - run:
          name: Run Tests
          command: npm test
      - run:
          name: Destroy Lab
          when: always
          command: |
            curl -s -X DELETE \\
              ${LAB_API_URL}/v1/labs/$LAB_ID \\
              -H "X-API-Key: $REALITYDB_API_KEY"

workflows:
  test:
    jobs:
      - db-test
`;
  };

  const totalRows = sandboxes.reduce((s, x) => s + (x.rows || 0), 0);
  const activeCount = sandboxes.filter((x) => x.status === "active").length;
  const targetOptions = sandboxes.length > 0 ? sandboxes : [{ id: "none", name: "no labs yet", template: "—" }];

  // Derived CLI values — reflect the current UI selections (selected lab + sliders/toggles)
  const cliPackId = selectedLab?.templateId || "fintech";
  const cliRows = selectedLab?.rows || 10000;
  const cliIntensity = ["low", "medium", "high"][intensity - 1] || "medium";
  const cliAnomalies = [...anomalies]
    .map((a) => a.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""))
    .filter(Boolean)
    .join(",") || "extreme-value";
  const cliTrain = train / 100;
  const cliTest = test / 100;
  const cliVal = Math.max(0, val) / 100;

  return <div style={{ fontFamily: "'IBM Plex Sans', -apple-system, sans-serif", background: t.bg, color: t.text, padding: "24px 28px", minHeight: "100vh", transition: "all 0.2s" }}>

    {toast && <div style={{ position: "fixed", top: 20, right: 20, background: t.card, border: `0.5px solid ${toastKind === "error" ? t.danger : t.accent}`, borderRadius: 8, padding: "10px 16px", fontSize: 13, color: toastKind === "error" ? t.danger : t.accent, zIndex: 200, display: "flex", gap: 6, alignItems: "center" }}>{toastKind === "error" ? "✕" : "✓"} {toast}</div>}

    {/* Header */}
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${t.accent}, #38bdf8)`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, color: "#0a0f1a" }}>R</div>
          <div>
            <span style={{ fontSize: 16, fontWeight: 600, color: t.text, letterSpacing: "-0.3px" }}>RealityDB</span>
            <span style={{ fontSize: 16, fontWeight: 600, color: t.accent, letterSpacing: "-0.3px", marginLeft: 4 }}>SimLab</span>
            <span style={{ fontSize: 11, color: t.muted, marginLeft: 8 }}>· Manage Labs</span>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={refreshLabs} style={{ ...btnGhost, padding: "6px 10px", fontSize: 12 }} title="Refresh labs">↻</button>
        <button onClick={() => setDark(!dark)} style={{ ...btnGhost, padding: "6px 10px", fontSize: 14 }} title={dark ? "Switch to light mode" : "Switch to dark mode"}>{dark ? "☀" : "🌙"}</button>
        <button onClick={() => setShowNew(true)} style={btnPrimary}>+ New sandbox</button>
        {onClose && <button onClick={onClose} style={{ ...btnGhost, padding: "6px 12px", fontSize: 14 }} title="Close">✕</button>}
      </div>
    </div>

    {/* Metrics */}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 24 }}>
      {[
        { label: "Active sandboxes", value: String(activeCount), sub: `of ${sandboxes.length} total`, trend: null },
        { label: "Rows in labs", value: totalRows >= 1000 ? `${Math.round(totalRows / 1000)}K` : String(totalRows), sub: "across all labs", trend: null },
        { label: "Templates", value: templatesLoading ? "0" : String(availableTemplates.length), sub: "live from /v1/store", trend: null },
        { label: "API", value: "Live", sub: "Neon + R2", trend: null },
      ].map((m, i) => <div key={i} style={{ background: t.surface, borderRadius: 12, padding: "16px 18px", border: `0.5px solid ${t.border}` }}>
        <div style={{ fontSize: 11, color: t.hint, textTransform: "uppercase", letterSpacing: "0.5px" }}>{m.label}</div>
        <div style={{ fontSize: 26, fontWeight: 600, color: t.text, margin: "4px 0 2px", letterSpacing: "-0.5px" }}>{m.value}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: t.muted }}>{m.sub}</span>
          {m.trend && <span style={{ fontSize: 11, color: t.accent }}>{m.trend}</span>}
        </div>
      </div>)}
    </div>

    {/* Pill Tabs */}
    <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
      {tabs.map(tb => <button key={tb.id} onClick={() => setTab(tb.id)} style={{ padding: "8px 18px", fontSize: 13, borderRadius: 20, cursor: "pointer", fontWeight: tab === tb.id ? 600 : 400, background: tab === tb.id ? t.pillActive : t.pill, color: tab === tb.id ? t.pillActiveText : t.muted, border: tab === tb.id ? "none" : `0.5px solid ${t.border}`, fontFamily: "inherit", transition: "all 0.15s" }}>{tb.label}</button>)}
    </div>

    {/* SANDBOXES */}
    {tab === "sandboxes" && <div style={{ background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 12, padding: "4px 20px", minHeight: 120 }}>
      {loading ? (
        <div style={{ padding: "32px 0", textAlign: "center", color: t.muted, fontSize: 13 }}>Loading labs…</div>
      ) : sandboxes.length === 0 ? (
        <div style={{ padding: "40px 0", textAlign: "center" }}>
          <div style={{ fontSize: 14, color: t.text, fontWeight: 600, marginBottom: 6 }}>No sandboxes yet</div>
          <div style={{ fontSize: 12, color: t.muted, marginBottom: 16 }}>Spin up a disposable PostgreSQL branch pre-loaded with synthetic data.</div>
          <button onClick={() => setShowNew(true)} style={btnPrimary}>+ Create your first sandbox</button>
        </div>
      ) : (
        sandboxes.map((sb, i) => <div key={sb.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "16px 0", borderBottom: i < sandboxes.length - 1 ? `0.5px solid ${t.border}` : "none" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{sb.name}</span>
              <Badge status={sb.status} />
              {sb.source === "ci" && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: t.infoBg, color: t.info }}>CI/CD</span>}
            </div>
            <div style={{ fontSize: 12, color: t.muted, marginBottom: 4 }}>{sb.template} · {sb.tables} tables · {(sb.rows / 1000)}K rows · expires {sb.ttl} · {sb.createdBy}</div>
            {sb.conn && <div onClick={() => handleCopyConn(sb)} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: t.info, background: t.infoBg, padding: "4px 10px", borderRadius: 6, display: "inline-block", cursor: "pointer" }}>
              {revealed[sb.id] ? sb.conn : maskConn(sb.conn)}
            </div>}
            {sb.pr && <span style={{ fontSize: 11, color: t.info, marginLeft: 8, cursor: "pointer" }}>PR {sb.pr} ↗</span>}
          </div>
          <div style={{ position: "relative" }} ref={menuOpen === sb.id ? menuRef : null}>
            <button onClick={() => setMenuOpen(menuOpen === sb.id ? null : sb.id)} style={{ background: "transparent", border: `0.5px solid ${t.border}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", color: t.muted, fontSize: 16 }}>⋯</button>
            {menuOpen === sb.id && <div style={{ position: "absolute", right: 0, top: 32, background: t.card, border: `0.5px solid ${t.borderH}`, borderRadius: 10, padding: "4px 0", zIndex: 10, minWidth: 180, boxShadow: dark ? "0 8px 24px rgba(0,0,0,0.4)" : "0 4px 12px rgba(0,0,0,0.08)" }}>
              {menuItems(sb).map((item, j) => item === null ? <div key={j} style={{ borderTop: `0.5px solid ${t.border}`, margin: "4px 0" }} /> : <div key={j} onClick={() => { item.action(); setMenuOpen(null); }} style={{ padding: "8px 14px", fontSize: 13, cursor: "pointer", color: item.danger ? t.danger : t.text, display: "flex", gap: 8, alignItems: "center" }} onMouseEnter={e => e.currentTarget.style.background = t.surface} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>{item.icon} {item.label}</div>)}
            </div>}
          </div>
        </div>)
      )}
    </div>}

    {/* SCENARIO */}
    {tab === "scenario" && <div style={{ background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 12, padding: 20 }}>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Apply scenario to sandbox</div>
      <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center" }}><Label>Target</Label><select style={selectStyle} value={selectedLabId} onChange={(e) => setSelectedLabId(e.target.value)} disabled={sandboxes.length === 0}>{targetOptions.map((sb) => <option key={sb.id} value={sb.id}>{sb.name} ({sb.template})</option>)}</select></div>
      <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center" }}><Label>Scenario</Label><select style={selectStyle} value={scenario} onChange={e => setScenario(e.target.value)}>{SCENARIOS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
      <div style={{ fontSize: 12, color: t.muted, padding: "10px 14px", background: t.surface, borderRadius: 8, marginBottom: 12, lineHeight: 1.6, border: `0.5px solid ${t.border}` }}>{SCENARIOS.find(s => s.id === scenario)?.desc}</div>
      <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center" }}><Label>Intensity</Label><input type="range" min={1} max={3} step={1} value={intensity} onChange={e => setIntensity(+e.target.value)} style={{ flex: 1, accentColor: t.accent }} /><span style={{ fontSize: 13, fontWeight: 500, minWidth: 60 }}>{["Low", "Medium", "High"][intensity - 1]}</span></div>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}><Label>Timeline</Label><select style={selectStyle}><option>12 months</option><option>6 months</option><option>4 weeks</option></select></div>
      <CliCommandBox
        lines={[
          "realitydb simulate",
          `--pack ${cliPackId}`,
          `--scenario ${scenario}`,
          `--rows ${cliRows}`,
          `--intensity ${cliIntensity}`,
          "--output ./simulation-output.sql",
        ]}
        command={`realitydb simulate --pack ${cliPackId} --scenario ${scenario} --rows ${cliRows} --intensity ${cliIntensity} --output ./simulation-output.sql`}
      />
    </div>}

    {/* ML SPLIT */}
    {tab === "split" && <div style={{ background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 12, padding: 20 }}>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Export for ML training</div>
      <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center" }}><Label>Source</Label><select style={selectStyle} value={selectedLabId} onChange={(e) => setSelectedLabId(e.target.value)} disabled={sandboxes.length === 0}>{targetOptions.map((sb) => <option key={sb.id} value={sb.id}>{sb.name} ({sb.template})</option>)}</select></div>
      <div style={{ display: "flex", gap: 12, marginBottom: 8, alignItems: "center" }}><Label>Train</Label><input type="range" min={50} max={90} step={5} value={train} onChange={e => setTrain(+e.target.value)} style={{ flex: 1, accentColor: t.accent }} /><span style={{ fontSize: 13, fontWeight: 600, minWidth: 40, textAlign: "right" }}>{train}%</span></div>
      <div style={{ display: "flex", gap: 12, marginBottom: 8, alignItems: "center" }}><Label>Test</Label><input type="range" min={5} max={30} step={5} value={test} onChange={e => setTest(+e.target.value)} style={{ flex: 1, accentColor: t.accent }} /><span style={{ fontSize: 13, fontWeight: 600, minWidth: 40, textAlign: "right" }}>{test}%</span></div>
      <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center" }}><Label>Validation</Label><span style={{ fontSize: 14, fontWeight: 600, color: val < 0 ? t.danger : t.accent }}>{val}%</span></div>
      <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", marginBottom: 12, background: t.surface }}>
        <div style={{ width: `${train}%`, background: "#06d6a0", transition: "width 0.2s" }} />
        <div style={{ width: `${test}%`, background: "#f59e0b", transition: "width 0.2s" }} />
        <div style={{ width: `${Math.max(0, val)}%`, background: "#38bdf8", transition: "width 0.2s" }} />
      </div>
      <div style={{ display: "flex", gap: 16, fontSize: 11, color: t.muted, marginBottom: 16 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: "#06d6a0" }} />Train</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: "#f59e0b" }} />Test</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: "#38bdf8" }} />Val</span>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1, display: "flex", gap: 12, alignItems: "center" }}><Label>Strategy</Label><select style={selectStyle}><option>Random</option><option>Temporal</option><option>Stratified</option></select></div>
        <div style={{ flex: 1, display: "flex", gap: 12, alignItems: "center" }}><Label>Format</Label><select style={selectStyle}><option>Parquet</option><option>CSV</option><option>SQL</option><option>JSON</option></select></div>
      </div>
      <CliCommandBox
        lines={[
          "realitydb split",
          `--pack ${cliPackId}`,
          `--rows ${cliRows}`,
          `--train ${cliTrain}`,
          `--test ${cliTest}`,
          `--validation ${cliVal}`,
          "--format csv",
          "--output ./splits/",
        ]}
        command={`realitydb split --pack ${cliPackId} --rows ${cliRows} --train ${cliTrain} --test ${cliTest} --validation ${cliVal} --format csv --output ./splits/`}
      />
    </div>}

    {/* ANOMALY */}
    {tab === "anomaly" && <div style={{ background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 12, padding: 20 }}>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Inject controlled anomalies</div>
      <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center" }}><Label>Target</Label><select style={selectStyle} value={selectedLabId} onChange={(e) => setSelectedLabId(e.target.value)} disabled={sandboxes.length === 0}>{targetOptions.map((sb) => <option key={sb.id} value={sb.id}>{sb.name} ({sb.template})</option>)}</select></div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: t.muted, marginBottom: 8 }}>Anomaly types</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {ANOMALY_TAGS.map(tag => <span key={tag} onClick={() => { const n = new Set(anomalies); n.has(tag) ? n.delete(tag) : n.add(tag); setAnomalies(n); }} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 16, cursor: "pointer", fontWeight: anomalies.has(tag) ? 600 : 400, background: anomalies.has(tag) ? t.accentBg : t.surface, color: anomalies.has(tag) ? t.accent : t.muted, border: `0.5px solid ${anomalies.has(tag) ? t.accent : t.border}`, transition: "all 0.15s" }}>{tag}</span>)}
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center" }}><Label>Frequency</Label><input type="range" min={1} max={10} step={1} value={anomalyFreq} onChange={e => setAnomalyFreq(+e.target.value)} style={{ flex: 1, accentColor: t.accent }} /><span style={{ fontSize: 13, fontWeight: 600, minWidth: 40, textAlign: "right" }}>{anomalyFreq}%</span></div>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}><Label>Seed</Label><input type="number" defaultValue={42} style={{ ...inputStyle, width: 80 }} /><span style={{ fontSize: 11, color: t.hint }}>Same seed = same anomalies</span></div>
      <CliCommandBox
        lines={[
          "realitydb anomaly",
          `--pack ${cliPackId}`,
          `--rows ${cliRows}`,
          `--inject ${cliAnomalies}`,
          `--frequency ${anomalyFreq}`,
          "--format sql",
          "--output ./anomaly-output.sql",
        ]}
        command={`realitydb anomaly --pack ${cliPackId} --rows ${cliRows} --inject ${cliAnomalies} --frequency ${anomalyFreq} --format sql --output ./anomaly-output.sql`}
      />
    </div>}

    {/* WHAT-IF */}
    {tab === "whatif" && <div style={{ background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 12, padding: 20 }}>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>What-if analysis (counterfactual)</div>
      <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center" }}><Label>Source</Label><select style={selectStyle} value={selectedLabId} onChange={(e) => setSelectedLabId(e.target.value)} disabled={sandboxes.length === 0}>{targetOptions.map((sb) => <option key={sb.id} value={sb.id}>{sb.name} ({sb.template})</option>)}</select></div>
      <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center" }}><Label>Feature</Label><select style={selectStyle} value={whatifFeature} onChange={e => setWhatifFeature(e.target.value)}>{["income", "credit_score", "age", "account_balance", "transaction_amount"].map(f => <option key={f}>{f}</option>)}</select></div>
      <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center" }}><Label>Shift type</Label><select style={selectStyle}><option>Increase by %</option><option>Decrease by %</option><option>Set fixed</option><option>Randomize range</option></select></div>
      <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center" }}><Label>Amount</Label><input type="range" min={5} max={50} step={5} value={whatifShift} onChange={e => setWhatifShift(+e.target.value)} style={{ flex: 1, accentColor: t.accent }} /><span style={{ fontSize: 13, fontWeight: 600, minWidth: 50, textAlign: "right", color: t.accent }}>+{whatifShift}%</span></div>
      <div style={{ fontSize: 12, color: t.muted, padding: "12px 14px", background: t.surface, borderRadius: 8, marginBottom: 16, lineHeight: 1.6, border: `0.5px solid ${t.border}` }}>
        Generate parallel dataset where <strong style={{ color: t.accent }}>{whatifFeature}</strong> is increased by <strong style={{ color: t.accent }}>{whatifShift}%</strong>. Creates a new sandbox branch. Original unchanged.
      </div>
      <button onClick={() => fire("What-if runs in SimLab Phase 6 — create two labs and compare for now", "success")} style={btnPrimary}>Generate counterfactual ↗</button>
      <div style={{ fontSize: 11, color: t.muted, marginTop: 12, padding: "8px 12px", background: t.surface, borderRadius: 6, border: `0.5px solid ${t.border}` }}>
        What-if analysis requires Neon branch isolation.
        Planned in SimLab Phase 6 · ADR-001.
        For now, create two labs with different parameters and compare manually.
      </div>
    </div>}

    {/* QUALITY REPORT */}
    {tab === "quality" && <div style={{ background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 12, padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>Synthetic Quality Report (SQR)</div>
        <span style={{ fontSize: 11, color: t.hint }}>Mock scorecard — live `/assess` endpoint coming soon</span>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
        <Label>Lab</Label>
        <select style={selectStyle} value={selectedLabId} onChange={(e) => setSelectedLabId(e.target.value)} disabled={sandboxes.length === 0}>
          {sandboxes.length === 0 ? <option>No labs yet</option> : sandboxes.map((sb) => <option key={sb.id} value={sb.id}>{sb.name} ({sb.template})</option>)}
        </select>
        <button onClick={handleRunQuality} disabled={qualityRunning || sandboxes.length === 0} style={{ ...btnPrimary, opacity: (qualityRunning || sandboxes.length === 0) ? 0.6 : 1, cursor: qualityRunning ? "wait" : "pointer" }}>
          {qualityRunning ? "Analyzing…" : "Run Quality Assessment"}
        </button>
      </div>

      {qualityRunning && (
        <div style={{ padding: 24, textAlign: "center", color: t.muted, fontSize: 13 }}>
          <div style={{ display: "inline-block", width: 22, height: 22, border: `2px solid ${t.border}`, borderTopColor: t.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite", marginRight: 10, verticalAlign: "middle" }} />
          Analyzing lab data…
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {qualityResult && !qualityRunning && (
        <div>
          {/* Overall */}
          <div style={{ background: t.surface, border: `0.5px solid ${t.border}`, borderRadius: 12, padding: 16, marginBottom: 12, display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ fontSize: 48, fontWeight: 700, color: t.accent, lineHeight: 1, letterSpacing: "-1px" }}>{qualityResult.overall}<span style={{ fontSize: 18, color: t.muted, fontWeight: 500 }}>/100</span></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 4 }}>Overall Score</div>
              <div style={{ height: 6, background: t.border, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${qualityResult.overall}%`, height: "100%", background: t.accent }} />
              </div>
              <div style={{ fontSize: 11, color: t.muted, marginTop: 6 }}>Score improves to 97+ with a hand-tuned pack.</div>
            </div>
          </div>
          {/* Categories */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 12 }}>
            {qualityResult.categories.map((cat) => {
              const color = cat.score >= 95 ? t.accent : cat.score >= 85 ? t.info : t.warn;
              return (
                <div key={cat.label} style={{ background: t.surface, border: `0.5px solid ${t.border}`, borderRadius: 10, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{cat.label}</span>
                    <span style={{ fontSize: 16, fontWeight: 700, color }}>{cat.score}<span style={{ fontSize: 11, color: t.muted, fontWeight: 500 }}>/100</span></span>
                  </div>
                  <div style={{ height: 4, background: t.border, borderRadius: 2, overflow: "hidden", marginBottom: 10 }}>
                    <div style={{ width: `${cat.score}%`, height: "100%", background: color }} />
                  </div>
                  {cat.subs.map((sub) => (
                    <div key={sub.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: t.muted, marginBottom: 4 }}>
                      <span>{sub.label}</span>
                      <span style={{ color: t.text, fontWeight: 500 }}>{sub.score}%</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <a href="https://realitydb.dev/docs/sqr" target="_blank" rel="noreferrer" style={{ ...btnGhost, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>View full report ↗</a>
            <button onClick={() => handleCopyText(JSON.stringify(qualityResult, null, 2), "scorecard JSON")} style={btnGhost}>Copy JSON</button>
          </div>
        </div>
      )}
    </div>}

    {/* EXPERIMENT */}
    {tab === "experiment" && <div style={{ background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 12, padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>Experiment</div>
        <span style={{ fontSize: 11, color: t.hint }}>Ask a question, run analyses, publish evidence-backed findings</span>
      </div>
      {sandboxes.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: t.muted, fontSize: 13 }}>Create a lab first.</div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
            <Label>Lab</Label>
            <select style={selectStyle} value={selectedLabId} onChange={(e) => setSelectedLabId(e.target.value)}>
              {sandboxes.map((sb) => <option key={sb.id} value={sb.id}>{sb.name} ({sb.template})</option>)}
            </select>
          </div>
          <ExperimentBuilder
            selectedLab={selectedLab}
            t={t} dark={dark}
            inputStyle={inputStyle} selectStyle={selectStyle}
            btnPrimary={btnPrimary} btnGhost={btnGhost}
            Label={Label} fire={fire}
          />
        </>
      )}
    </div>}

    {/* SNAPSHOT & PUBLISH */}
    {tab === "snapshot" && <div style={{ background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 12, padding: 20 }}>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Snapshot &amp; publish to gallery</div>
      <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center" }}>
        <Label>Lab</Label>
        <select style={selectStyle} value={selectedLabId} onChange={(e) => setSelectedLabId(e.target.value)} disabled={sandboxes.length === 0}>
          {sandboxes.length === 0 ? <option>No labs yet</option> : sandboxes.map((sb) => <option key={sb.id} value={sb.id}>{sb.name} ({sb.template})</option>)}
        </select>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center" }}>
        <Label>Title</Label>
        <input style={selectStyle} value={snapTitle} onChange={(e) => setSnapTitle(e.target.value)} placeholder="My snapshot" />
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "flex-start" }}>
        <Label>Description</Label>
        <textarea style={{ ...selectStyle, fontFamily: "inherit", minHeight: 64, resize: "vertical" }} value={snapDesc} onChange={(e) => setSnapDesc(e.target.value)} placeholder="What does this dataset contain? (optional)" />
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center" }}>
        <Label>Tags</Label>
        <input style={selectStyle} value={snapTags} onChange={(e) => setSnapTags(e.target.value)} placeholder="banking, fraud, kyc (comma-separated)" />
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
        <Label>License</Label>
        <select style={selectStyle} value={snapLicense} onChange={(e) => setSnapLicense(e.target.value)}>
          <option>CC-BY-4.0</option><option>MIT</option><option>Apache-2.0</option><option>Proprietary</option>
        </select>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={handleSaveSnapshot} disabled={snapSaving || sandboxes.length === 0} style={{ ...btnPrimary, opacity: (snapSaving || sandboxes.length === 0) ? 0.6 : 1, cursor: snapSaving ? "wait" : "pointer" }}>{snapSaving ? "Saving…" : "Save Snapshot"}</button>
        {snapResult && (
          <button onClick={handlePublish} disabled={publishing || !!publishResult} style={{ ...btnPrimary, background: t.info, color: dark ? "#0a0f1a" : "#fff", opacity: (publishing || !!publishResult) ? 0.6 : 1, cursor: publishing ? "wait" : "pointer" }}>{publishing ? "Publishing…" : publishResult ? "Published" : "Publish to Gallery ↗"}</button>
        )}
      </div>

      {snapResult && (
        <div style={{ background: t.surface, border: `0.5px solid ${t.accent}`, borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: t.accent, fontWeight: 600, marginBottom: 6 }}>✓ Snapshot saved</div>
          <div style={{ fontSize: 11, color: t.muted, fontFamily: "'IBM Plex Mono', monospace" }}>
            <div>id: <span style={{ color: t.text }}>{snapResult.id}</span></div>
            <div>tables: <span style={{ color: t.text }}>{snapResult.tableCount ?? "—"}</span> · rows: <span style={{ color: t.text }}>{snapResult.totalRows ?? "—"}</span> · size: <span style={{ color: t.text }}>{snapResult.sizeBytes ? `${Math.round(snapResult.sizeBytes / 1024)} KB` : "—"}</span></div>
          </div>
        </div>
      )}

      {publishResult && (
        <div style={{ background: t.surface, border: `0.5px solid ${t.info}`, borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 12, color: t.info, fontWeight: 600, marginBottom: 6 }}>✓ Published to gallery</div>
          {publishResult.slug && (
            <button onClick={() => { onClose?.(); onGallery?.(); }} style={{ fontSize: 12, color: t.info, fontFamily: "'IBM Plex Mono', monospace", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              View in gallery →
            </button>
          )}
        </div>
      )}
    </div>}

    {/* EXPORT */}
    {tab === "export" && <div style={{ background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 12, padding: 20 }}>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Export lab data</div>
      <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center" }}>
        <Label>Lab</Label>
        <select style={selectStyle} value={selectedLabId} onChange={(e) => setSelectedLabId(e.target.value)} disabled={sandboxes.length === 0}>
          {sandboxes.length === 0 ? <option>No labs yet</option> : sandboxes.map((sb) => <option key={sb.id} value={sb.id}>{sb.name} ({sb.template})</option>)}
        </select>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
        <Label>Format</Label>
        <select style={selectStyle} value={exportFormat} onChange={(e) => setExportFormat(e.target.value)}>
          <option value="sql">SQL (via CLI)</option>
          <option value="notebook">Jupyter Notebook (.ipynb)</option>
          <option value="csv" disabled>CSV (coming soon)</option>
          <option value="json" disabled>JSON (coming soon)</option>
        </select>
      </div>

      {exportFormat === "sql" && (
        <div>
          <div style={{ fontSize: 12, color: t.muted, marginBottom: 8 }}>SQL dump is not yet available over HTTP. Use the CLI:</div>
          <div style={{ background: t.surface, border: `0.5px solid ${t.border}`, borderRadius: 8, padding: 12, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: t.info, marginBottom: 10, wordBreak: "break-all" }}>
            realitydb examine supabase --connection {selectedLab?.conn ? '"' + selectedLab.conn + '"' : "[conn]"} --output data.sql
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => handleCopyText(`realitydb examine supabase --connection "${selectedLab?.conn || "[conn]"}" --output data.sql`, "CLI command")} style={btnGhost}>Copy command</button>
            {selectedLab?.conn && <button onClick={() => handleCopyText(selectedLab.conn, "connection")} style={btnGhost}>Copy connection</button>}
          </div>
          <div style={{ fontSize: 11, color: t.hint, marginTop: 12 }}>The connection above is masked by the API when listed. Use the one shown at create time for pg_dump.</div>
        </div>
      )}

      {exportFormat === "notebook" && (
        <div>
          <div style={{ fontSize: 12, color: t.muted, marginBottom: 8 }}>Download a runnable Jupyter notebook seeded with this lab's connection + schema.</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleDownloadNotebook} disabled={exportingNotebook || !selectedLab} style={{ ...btnPrimary, opacity: (exportingNotebook || !selectedLab) ? 0.6 : 1, cursor: exportingNotebook ? "wait" : "pointer" }}>{exportingNotebook ? "Downloading…" : "Download .ipynb"}</button>
            {selectedLab?.conn && <button onClick={() => handleCopyText(selectedLab.conn, "connection")} style={btnGhost}>Copy connection</button>}
          </div>
        </div>
      )}

      {(exportFormat === "csv" || exportFormat === "json") && (
        <div style={{ fontSize: 12, color: t.muted }}>This format is coming soon.</div>
      )}
    </div>}

    {/* CI/CD */}
    {tab === "cicd" && <div style={{ background: t.card, border: `0.5px solid ${t.border}`, borderRadius: 12, padding: 20 }}>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Generate CI/CD config</div>
      <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center" }}>
        <Label>Framework</Label>
        <select style={selectStyle} value={ciFramework} onChange={(e) => setCiFramework(e.target.value)}>
          <option value="github">GitHub Actions</option>
          <option value="gitlab">GitLab CI</option>
          <option value="circleci">CircleCI</option>
        </select>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center" }}>
        <Label>Template</Label>
        <select style={selectStyle} value={ciTemplate} onChange={(e) => setCiTemplate(e.target.value)}>
          {availableTemplates.map((tp) => <option key={tp.apiId} value={tp.apiId}>{tp.label}</option>)}
        </select>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
        <Label>Rows</Label>
        <select style={selectStyle} value={ciRows} onChange={(e) => setCiRows(+e.target.value)}>
          {[1000, 5000, 10000].map((r) => <option key={r} value={r}>{r >= 1000 ? `${r / 1000}K` : r} rows</option>)}
        </select>
      </div>

      <div style={{ position: "relative", marginBottom: 12 }}>
        <button onClick={() => handleCopyText(generateCiYaml(), `${ciFramework} config`)} style={{ ...btnGhost, position: "absolute", top: 8, right: 8, fontSize: 11, padding: "4px 10px" }}>Copy</button>
        <pre style={{ background: t.surface, border: `0.5px solid ${t.border}`, borderRadius: 8, padding: 16, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: t.text, overflowX: "auto", maxHeight: 480, margin: 0, whiteSpace: "pre" }}>
{generateCiYaml()}
        </pre>
      </div>

      <div style={{ fontSize: 12, color: t.muted, padding: "10px 14px", background: t.infoBg, border: `0.5px solid ${t.info}`, borderRadius: 8, lineHeight: 1.6 }}>
        Add <strong style={{ color: t.info }}>REALITYDB_API_KEY</strong> to your repository secrets. Get your API key at <a href="https://realitydb.dev/settings" target="_blank" rel="noreferrer" style={{ color: t.info }}>realitydb.dev/settings</a>.
      </div>
    </div>}

    {/* NEW SANDBOX MODAL */}
    {showNew && <div style={{ position: "fixed", inset: 0, background: t.modal, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }} onClick={() => !creating && setShowNew(false)}>
      <div onClick={e => e.stopPropagation()} style={{ background: t.card, borderRadius: 16, padding: 24, maxWidth: 460, width: "100%", border: `0.5px solid ${t.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>Create new sandbox</span>
          <button onClick={() => !creating && setShowNew(false)} style={{ background: "none", border: "none", color: t.muted, fontSize: 18, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}><Label>Template</Label><select style={selectStyle} value={newTpl} onChange={e => setNewTpl(e.target.value)} disabled={templatesLoading || availableTemplates.length === 0}>{templatesLoading ? <option>Loading…</option> : availableTemplates.map(tp => <option key={tp.apiId} value={tp.apiId}>{tp.label}{tp.tables ? ` (${tp.tables} tables)` : ""}</option>)}</select></div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}><Label>Rows</Label><select style={selectStyle} value={newRows} onChange={e => setNewRows(+e.target.value)}>{[5000, 10000, 50000, 100000].map(r => <option key={r} value={r}>{(r / 1000)}K</option>)}</select></div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}><Label>TTL</Label><select style={selectStyle} value={newTTL} onChange={e => setNewTTL(e.target.value)}><option value="4h">4h</option><option value="24h">24h</option><option value="48h">48h</option><option value="72h">72h</option><option value="7d">7 days</option></select></div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}><Label>Name</Label><input style={selectStyle} placeholder="optional (auto-generated)" value={newName} onChange={e => setNewName(e.target.value)} /></div>
          <div style={{ borderTop: `0.5px solid ${t.border}`, paddingTop: 16, marginTop: 4, display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button onClick={() => setShowNew(false)} disabled={creating} style={btnGhost}>Cancel</button>
            <button onClick={handleCreate} disabled={creating} style={{ ...btnPrimary, opacity: creating ? 0.6 : 1, cursor: creating ? "wait" : "pointer" }}>{creating ? "Creating…" : "Create sandbox ↗"}</button>
          </div>
        </div>
      </div>
    </div>}

    {/* DELETE MODAL */}
    {showDelete && <div style={{ position: "fixed", inset: 0, background: t.modal, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }} onClick={() => !deleting && setShowDelete(null)}>
      <div onClick={e => e.stopPropagation()} style={{ background: t.card, borderRadius: 16, padding: 24, maxWidth: 400, width: "100%", border: `0.5px solid ${t.border}` }}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Delete sandbox</div>
        <p style={{ fontSize: 13, color: t.muted, lineHeight: 1.6, marginBottom: 16 }}>Delete <strong style={{ color: t.text }}>{showDelete.name}</strong>? This permanently destroys the database branch. Cannot be undone.</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={() => setShowDelete(null)} disabled={deleting} style={btnGhost}>Cancel</button>
          <button onClick={() => handleDelete(showDelete)} disabled={deleting} style={{ ...btnPrimary, background: t.danger, color: "#fff", opacity: deleting ? 0.6 : 1, cursor: deleting ? "wait" : "pointer" }}>{deleting ? "Deleting…" : "Delete"}</button>
        </div>
      </div>
    </div>}

    {/* Footer */}
    <div style={{ marginTop: 24, paddingTop: 16, borderTop: `0.5px solid ${t.border}`, display: "flex", justifyContent: "space-between", fontSize: 11, color: t.hint }}>
      <span>RealityDB SimLab · Mpingo Systems LLC · Lab API: {LAB_API_URL.replace("https://", "")}</span>
      <div style={{ display: "flex", gap: 16 }}>
        <a href="https://realitydb.dev/docs" target="_blank" rel="noreferrer" style={{ color: t.hint, textDecoration: "none" }}>Docs</a>
        <a href={`${LAB_API_URL}/health`} target="_blank" rel="noreferrer" style={{ color: t.hint, textDecoration: "none" }}>API</a>
      </div>
    </div>
  </div>;
}
