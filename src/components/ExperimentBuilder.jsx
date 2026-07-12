import { useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

const LAB_API_URL = import.meta.env.VITE_LAB_API_URL || "https://realitydb-lab-api.eddy-078.workers.dev";
const LAB_API_KEY = import.meta.env.VITE_LAB_API_KEY || "";

const PIE_COLORS = ["#06d6a0", "#38bdf8", "#f59e0b", "#ef4444", "#a78bfa", "#f472b6", "#22d3ee", "#84cc16"];

function EvidenceChart({ chartType, xKey, yKey, rows, accent, dark }) {
  if (!rows || rows.length === 0) return null;
  const gridColor = dark ? "#1e293b" : "#e2e8f0";
  const textColor = dark ? "#94a3b8" : "#64748b";

  if (chartType === "pie") {
    return (
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie data={rows} dataKey={yKey} nameKey={xKey} cx="50%" cy="50%" outerRadius={90} label>
            {rows.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
          </Pie>
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11, color: textColor }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }
  if (chartType === "line") {
    return (
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: textColor }} />
          <YAxis tick={{ fontSize: 11, fill: textColor }} />
          <Tooltip />
          <Line type="monotone" dataKey={yKey} stroke={accent} strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={rows}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: textColor }} />
        <YAxis tick={{ fontSize: 11, fill: textColor }} />
        <Tooltip />
        <Bar dataKey={yKey} fill={accent} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function ExperimentBuilder({ selectedLab, t, dark, inputStyle, selectStyle, btnPrimary, btnGhost, Label, fire }) {
  const [experimentId, setExperimentId] = useState(null);
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [starting, setStarting] = useState(false);

  const [evidence, setEvidence] = useState([]); // local mirror: [{id,type,title,data}]
  const [sqlDraft, setSqlDraft] = useState("");
  const [running, setRunning] = useState(false);

  const [chartSourceId, setChartSourceId] = useState("");
  const [chartType, setChartType] = useState("bar");
  const [chartX, setChartX] = useState("");
  const [chartY, setChartY] = useState("");
  const [addingChart, setAddingChart] = useState(false);

  const [findings, setFindings] = useState("");
  const [authors, setAuthors] = useState("");
  const [tags, setTags] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState(null);

  const headers = { "Content-Type": "application/json", "X-API-Key": LAB_API_KEY };
  const resultTables = evidence.filter((e) => e.type === "result_table");

  const handleStart = async () => {
    if (!selectedLab) { fire("Select a lab first", "error"); return; }
    if (!title.trim()) { fire("Title required", "error"); return; }
    setStarting(true);
    try {
      const res = await fetch(`${LAB_API_URL}/v1/experiments`, {
        method: "POST", headers,
        body: JSON.stringify({ title: title.trim(), question: question.trim(), labId: selectedLab.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { fire(data.error || `Failed to start experiment (${res.status})`, "error"); setStarting(false); return; }
      setExperimentId(data.id);
      fire("Experiment started — run a query to add evidence");
    } catch (e) {
      fire(`Network error: ${e.message || e}`, "error");
    } finally {
      setStarting(false);
    }
  };

  const handleRunQuery = async () => {
    if (!sqlDraft.trim()) { fire("Enter a SQL query", "error"); return; }
    setRunning(true);
    try {
      const res = await fetch(`${LAB_API_URL}/v1/experiments/${experimentId}/evidence`, {
        method: "POST", headers,
        body: JSON.stringify({ type: "sql_query", execute: true, sql: sqlDraft.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { fire(data.error || `Query failed (${res.status})`, "error"); setRunning(false); return; }
      setEvidence((prev) => [...prev, ...data.evidence]);
      const resultBlock = data.evidence.find((e) => e.type === "result_table");
      if (resultBlock) {
        setChartSourceId(resultBlock.id);
        if (resultBlock.data.columns?.length >= 2) {
          setChartX(resultBlock.data.columns[0]);
          setChartY(resultBlock.data.columns[1]);
        }
      }
      fire(`Query returned ${resultBlock?.data.rowCount ?? 0} rows`);
      setSqlDraft("");
    } catch (e) {
      fire(`Network error: ${e.message || e}`, "error");
    } finally {
      setRunning(false);
    }
  };

  const handleAddChart = async () => {
    if (!chartSourceId || !chartX || !chartY) { fire("Pick a result, X column, and Y column", "error"); return; }
    setAddingChart(true);
    try {
      const res = await fetch(`${LAB_API_URL}/v1/experiments/${experimentId}/evidence`, {
        method: "POST", headers,
        body: JSON.stringify({
          type: "chart",
          title: `${chartType} chart: ${chartY} by ${chartX}`,
          data: { chartType, xKey: chartX, yKey: chartY, sourceEvidenceId: chartSourceId },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { fire(data.error || `Failed to add chart (${res.status})`, "error"); setAddingChart(false); return; }
      setEvidence((prev) => [...prev, ...data.evidence]);
      fire("Chart added");
    } catch (e) {
      fire(`Network error: ${e.message || e}`, "error");
    } finally {
      setAddingChart(false);
    }
  };

  const handlePublish = async () => {
    if (!findings.trim()) { fire("Write your findings before publishing", "error"); return; }
    if (evidence.length === 0) { fire("Add at least one piece of evidence before publishing", "error"); return; }
    setPublishing(true);
    try {
      await fetch(`${LAB_API_URL}/v1/experiments/${experimentId}`, {
        method: "PATCH", headers,
        body: JSON.stringify({ findings: findings.trim(), authors: authors.trim() || undefined, tags: tags.trim() || undefined }),
      });
      const res = await fetch(`${LAB_API_URL}/v1/experiments/${experimentId}/publish`, { method: "POST", headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { fire(data.error || `Publish failed (${res.status})`, "error"); setPublishing(false); return; }
      setPublishResult(data);
      fire("Experiment published to gallery");
    } catch (e) {
      fire(`Network error: ${e.message || e}`, "error");
    } finally {
      setPublishing(false);
    }
  };

  const sectionStyle = { background: t.surface, border: `0.5px solid ${t.border}`, borderRadius: 10, padding: 16, marginBottom: 14 };
  const h4Style = { fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 10 };

  // ── Step 1: not yet started ──────────────────────────────────────────────
  if (!experimentId) {
    return (
      <div>
        <p style={{ fontSize: 12, color: t.muted, marginBottom: 16, lineHeight: 1.5 }}>
          An Experiment is the permanent record of asking a question, running analyses against real data,
          and documenting what you found. Start by naming what you're investigating.
        </p>
        <div style={sectionStyle}>
          <div style={{ marginBottom: 10 }}>
            <Label>Title</Label>
            <input style={{ ...inputStyle, width: "100%", marginTop: 6 }} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Fraud rate by merchant category" />
          </div>
          <div style={{ marginBottom: 4 }}>
            <Label>Question</Label>
            <textarea style={{ ...inputStyle, width: "100%", marginTop: 6, minHeight: 60, resize: "vertical", fontFamily: "inherit" }} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="What are you trying to discover or validate?" />
          </div>
        </div>
        <button onClick={handleStart} disabled={starting || !selectedLab} style={{ ...btnPrimary, opacity: (starting || !selectedLab) ? 0.6 : 1, cursor: starting ? "wait" : "pointer" }}>
          {starting ? "Starting…" : "Start Experiment"}
        </button>
      </div>
    );
  }

  // ── Step 2: in progress ───────────────────────────────────────────────────
  if (!publishResult) {
    return (
      <div>
        <div style={sectionStyle}>
          <div style={h4Style}>Method — run a query against {selectedLab?.name}</div>
          <textarea
            style={{ ...inputStyle, width: "100%", minHeight: 80, resize: "vertical", fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}
            value={sqlDraft} onChange={(e) => setSqlDraft(e.target.value)}
            placeholder="SELECT ... FROM ... GROUP BY ..."
          />
          <button onClick={handleRunQuery} disabled={running} style={{ ...btnPrimary, marginTop: 10, opacity: running ? 0.6 : 1, cursor: running ? "wait" : "pointer" }}>
            {running ? "Running…" : "Run Query"}
          </button>
        </div>

        {evidence.length > 0 && (
          <div style={sectionStyle}>
            <div style={h4Style}>Evidence collected ({evidence.length})</div>
            {evidence.map((e) => (
              <div key={e.id} style={{ padding: "8px 0", borderBottom: `0.5px solid ${t.border}` }}>
                {e.type === "sql_query" && (
                  <div>
                    <span style={{ fontSize: 10, color: t.info, fontWeight: 600 }}>SQL</span>
                    <pre style={{ fontSize: 11, color: t.muted, margin: "4px 0 0", whiteSpace: "pre-wrap", fontFamily: "'IBM Plex Mono', monospace" }}>{e.data.sql}</pre>
                    {e.data.executionTimeMs != null && <span style={{ fontSize: 10, color: t.hint }}>{e.data.executionTimeMs}ms</span>}
                  </div>
                )}
                {e.type === "result_table" && (
                  <div>
                    <span style={{ fontSize: 10, color: t.accent, fontWeight: 600 }}>RESULT — {e.data.rowCount} rows{e.data.truncated ? " (capped at 500)" : ""}</span>
                    <div style={{ overflowX: "auto", marginTop: 6 }}>
                      <table style={{ fontSize: 11, borderCollapse: "collapse", width: "100%" }}>
                        <thead><tr>{e.data.columns.map((c) => <th key={c} style={{ textAlign: "left", padding: "4px 8px", color: t.muted, borderBottom: `0.5px solid ${t.border}` }}>{c}</th>)}</tr></thead>
                        <tbody>
                          {e.data.rows.slice(0, 8).map((r, i) => (
                            <tr key={i}>{e.data.columns.map((c) => <td key={c} style={{ padding: "4px 8px", color: t.text, borderBottom: `0.5px solid ${t.border}` }}>{String(r[c])}</td>)}</tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {e.type === "chart" && (
                  <div>
                    <span style={{ fontSize: 10, color: t.warn, fontWeight: 600 }}>CHART — {e.title}</span>
                    <EvidenceChart
                      chartType={e.data.chartType} xKey={e.data.xKey} yKey={e.data.yKey}
                      rows={evidence.find((r) => r.id === e.data.sourceEvidenceId)?.data.rows}
                      accent={t.accent} dark={dark}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {resultTables.length > 0 && (
          <div style={sectionStyle}>
            <div style={h4Style}>Add a chart from a result</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <select style={selectStyle} value={chartSourceId} onChange={(e) => { setChartSourceId(e.target.value); const rt = resultTables.find((r) => r.id === e.target.value); if (rt?.data.columns?.length >= 2) { setChartX(rt.data.columns[0]); setChartY(rt.data.columns[1]); } }}>
                {resultTables.map((r) => <option key={r.id} value={r.id}>Result {r.id.slice(-6)} ({r.data.rowCount} rows)</option>)}
              </select>
              <select style={{ ...selectStyle, flex: "none", width: 100 }} value={chartType} onChange={(e) => setChartType(e.target.value)}>
                <option value="bar">Bar</option>
                <option value="line">Line</option>
                <option value="pie">Pie</option>
              </select>
              <select style={{ ...selectStyle, flex: "none", width: 130 }} value={chartX} onChange={(e) => setChartX(e.target.value)}>
                {resultTables.find((r) => r.id === chartSourceId)?.data.columns.map((c) => <option key={c} value={c}>x: {c}</option>)}
              </select>
              <select style={{ ...selectStyle, flex: "none", width: 130 }} value={chartY} onChange={(e) => setChartY(e.target.value)}>
                {resultTables.find((r) => r.id === chartSourceId)?.data.columns.map((c) => <option key={c} value={c}>y: {c}</option>)}
              </select>
              <button onClick={handleAddChart} disabled={addingChart} style={{ ...btnGhost, opacity: addingChart ? 0.6 : 1 }}>{addingChart ? "Adding…" : "Add chart"}</button>
            </div>
          </div>
        )}

        <div style={sectionStyle}>
          <div style={h4Style}>Findings — what did the evidence show?</div>
          <textarea style={{ ...inputStyle, width: "100%", minHeight: 100, resize: "vertical" }} value={findings} onChange={(e) => setFindings(e.target.value)} placeholder="Summarize what you discovered, why it matters, and any follow-up questions." />
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <input style={{ ...inputStyle, flex: 1 }} value={authors} onChange={(e) => setAuthors(e.target.value)} placeholder="Author name" />
            <input style={{ ...inputStyle, flex: 1 }} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="tags, comma, separated" />
          </div>
        </div>

        <button onClick={handlePublish} disabled={publishing} style={{ ...btnPrimary, background: t.info, opacity: publishing ? 0.6 : 1, cursor: publishing ? "wait" : "pointer" }}>
          {publishing ? "Publishing…" : "Publish Experiment"}
        </button>
      </div>
    );
  }

  // ── Step 3: published ────────────────────────────────────────────────────
  return (
    <div style={{ ...sectionStyle, border: `0.5px solid ${t.info}` }}>
      <div style={{ fontSize: 13, color: t.info, fontWeight: 600, marginBottom: 8 }}>✓ Published to the Experiment Gallery</div>
      <a href={`#gallery/${publishResult.slug}`} style={{ fontSize: 12, color: t.info, textDecoration: "underline" }}>
        View in gallery →
      </a>
    </div>
  );
}
