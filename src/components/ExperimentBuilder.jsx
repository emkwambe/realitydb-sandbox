import { useState } from "react";
import { PublicationMarkdown, EvidenceChart as SharedEvidenceChart } from "./ExperimentUI";
import { updateExperimentEvidence } from "../services/cloudSandboxService";

const LAB_API_URL = import.meta.env.VITE_LAB_API_URL || "https://realitydb-lab-api.eddy-078.workers.dev";
const LAB_API_KEY = import.meta.env.VITE_LAB_API_KEY || "";

function EvidenceChart({ chartType, xKey, yKey, rows, accent, dark }) {
  return (
    <SharedEvidenceChart
      chartType={chartType} xKey={xKey} yKey={yKey} rows={rows} height={260}
      accentColor={accent} gridColor={dark ? "#1e293b" : "#e2e8f0"} textColor={dark ? "#94a3b8" : "#64748b"}
    />
  );
}

export default function ExperimentBuilder({ selectedLab, accessToken, userEmail, t, dark, inputStyle, selectStyle, btnPrimary, btnGhost, Label, fire }) {
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
  const [chartTitle, setChartTitle] = useState("");
  const [chartDescription, setChartDescription] = useState("");
  const [chartTags, setChartTags] = useState("");
  const [addingChart, setAddingChart] = useState(false);

  const [findings, setFindings] = useState("");
  const [findingsPreview, setFindingsPreview] = useState(false);
  const [authors, setAuthors] = useState(userEmail || "");
  const [tags, setTags] = useState("");
  const [visibility, setVisibility] = useState("unlisted");
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState(null);

  // Authorization-sensitive endpoints derive the actor from this verified
  // Supabase JWT server-side — never from a client-supplied userId.
  const headers = { "Content-Type": "application/json", "X-API-Key": LAB_API_KEY, "Authorization": `Bearer ${accessToken}` };
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
      const title = chartTitle.trim() || `${chartType} chart: ${chartY} by ${chartX}`;
      const res = await fetch(`${LAB_API_URL}/v1/experiments/${experimentId}/evidence`, {
        method: "POST", headers,
        body: JSON.stringify({
          type: "chart",
          title,
          data: { chartType, xKey: chartX, yKey: chartY, sourceEvidenceId: chartSourceId },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { fire(data.error || `Failed to add chart (${res.status})`, "error"); setAddingChart(false); return; }
      setEvidence((prev) => [...prev, ...data.evidence]);

      // Description/tags aren't part of evidence creation — set via a
      // follow-up PATCH so the Visualization discovery lens has real
      // metadata to search/display, not just an auto-generated title.
      const chartBlock = data.evidence.find((e) => e.type === "chart");
      if (chartBlock && (chartDescription.trim() || chartTags.trim())) {
        await updateExperimentEvidence(experimentId, chartBlock.id, accessToken, {
          description: chartDescription.trim() || undefined,
          tags: chartTags.trim() || undefined,
        });
      }

      setChartTitle(""); setChartDescription(""); setChartTags("");
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
      const res = await fetch(`${LAB_API_URL}/v1/experiments/${experimentId}/publish`, {
        method: "POST", headers,
        body: JSON.stringify({ visibility }),
      });
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
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
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
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <input style={{ ...inputStyle, flex: 1, minWidth: 160 }} value={chartTitle} onChange={(e) => setChartTitle(e.target.value)} placeholder={`Title (default: "${chartType} chart: ${chartY || "y"} by ${chartX || "x"}")`} />
              <input style={{ ...inputStyle, flex: 1, minWidth: 160 }} value={chartDescription} onChange={(e) => setChartDescription(e.target.value)} placeholder="Description (optional) — shown in Visualization discovery" />
              <input style={{ ...inputStyle, flex: 1, minWidth: 140 }} value={chartTags} onChange={(e) => setChartTags(e.target.value)} placeholder="tags, comma, separated" />
              <button onClick={handleAddChart} disabled={addingChart} style={{ ...btnGhost, opacity: addingChart ? 0.6 : 1 }}>{addingChart ? "Adding…" : "Add chart"}</button>
            </div>
          </div>
        )}

        <div style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={h4Style}>Findings — what did the evidence show?</div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setFindingsPreview(false)} style={{ ...btnGhost, padding: "4px 10px", fontSize: 11, ...(!findingsPreview ? { background: t.accentBg, color: t.accent, borderColor: "transparent" } : {}) }}>Write</button>
              <button onClick={() => setFindingsPreview(true)} style={{ ...btnGhost, padding: "4px 10px", fontSize: 11, ...(findingsPreview ? { background: t.accentBg, color: t.accent, borderColor: "transparent" } : {}) }}>Preview</button>
            </div>
          </div>
          {findingsPreview ? (
            <div style={{ background: t.surface, border: `0.5px solid ${t.border}`, borderRadius: 8, padding: "12px 16px", minHeight: 100 }}>
              {findings.trim() ? <PublicationMarkdown content={findings} /> : <span style={{ fontSize: 12, color: t.hint }}>Nothing to preview yet.</span>}
            </div>
          ) : (
            <>
              <textarea style={{ ...inputStyle, width: "100%", minHeight: 100, resize: "vertical", fontFamily: "'IBM Plex Mono', monospace" }} value={findings} onChange={(e) => setFindings(e.target.value)} placeholder="Summarize what you discovered, why it matters, and any follow-up questions. Markdown supported: # headings, - lists, > callouts, `code`, tables, [links](url)." />
              <p style={{ fontSize: 10, color: t.hint, marginTop: 4 }}>Markdown supported — headings, lists, callouts, code, tables, links.</p>
            </>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <input style={{ ...inputStyle, flex: 1 }} value={authors} onChange={(e) => setAuthors(e.target.value)} placeholder="Author name" />
            <input style={{ ...inputStyle, flex: 1 }} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="tags, comma, separated" />
          </div>
        </div>

        <div style={sectionStyle}>
          <div style={h4Style}>Who can see this?</div>
          <div style={{ display: "flex", gap: 10 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: t.text, cursor: "pointer" }}>
              <input type="radio" name="visibility" checked={visibility === "unlisted"} onChange={() => setVisibility("unlisted")} />
              Unlisted — shareable via link, not listed in the gallery
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: t.text, cursor: "pointer" }}>
              <input type="radio" name="visibility" checked={visibility === "public"} onChange={() => setVisibility("public")} />
              Public — listed in the Experiment Gallery
            </label>
          </div>
          <p style={{ fontSize: 10, color: t.hint, marginTop: 8 }}>
            Private, workspace, and specific-person sharing are coming once account-verified access controls ship.
          </p>
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
      <div style={{ fontSize: 13, color: t.info, fontWeight: 600, marginBottom: 4 }}>✓ Published to the Experiment Gallery</div>
      <div style={{ fontSize: 10, color: t.hint, marginBottom: 8 }}>Visibility: {publishResult.visibility}</div>
      <a href={`#gallery/${publishResult.slug}`} style={{ fontSize: 12, color: t.info, textDecoration: "underline" }}>
        View in gallery →
      </a>
    </div>
  );
}
