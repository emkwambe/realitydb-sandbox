// Cloud Sandbox Service — calls the live RealityDB Lab API
// Lab API: https://realitydb-lab-api.eddy-078.workers.dev

const LAB_API_URL = import.meta.env.VITE_LAB_API_URL || 'https://realitydb-lab-api.eddy-078.workers.dev';
const LAB_API_KEY = import.meta.env.VITE_LAB_API_KEY || 'rdb_lab_mpingo_2026';

// Types matching Lab API responses
export interface CloudSandbox {
  id: string;
  user_id: string;
  name: string;
  template: string;
  rows: number;
  neon_branch_id: string;
  neon_endpoint_id: string;
  connection_string: string;
  status: string;
  created_at: string;
  expires_at: string;
  // Aliases for backward compatibility with UI
  template_id?: string;
  neon_project_id?: string;
}

export interface CreateLabResult {
  id: string;
  name: string;
  template: string;
  rows: number;
  connectionString: string;
  expiresAt: string;
  ttl: string;
  status: string;
}

function getHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-API-Key': LAB_API_KEY,
  };
}

// Authorization-sensitive Experiment endpoints derive the actor from a
// verified Supabase JWT server-side (see lab-api's verifySupabaseJWT) —
// they no longer accept a client-supplied userId. accessToken must be the
// real session.access_token from useAuth(); omit it for public reads.
function getExperimentHeaders(accessToken?: string): Record<string, string> {
  const headers = getHeaders();
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  return headers;
}

export function isCloudConfigured(): boolean {
  return !!LAB_API_URL && !!LAB_API_KEY;
}

/**
 * Create a new lab (provisions Neon branch + seeds from R2 template).
 * The Lab API handles both provisioning and seeding in a single call.
 */
export async function provisionCloudSandbox(
  templateId: string,
  rows: number = 5000,
  ttl: string = '4h'
): Promise<{
  projectId: string;
  branchId: string;
  connectionString: string;
  labId: string;
  expiresAt: string;
} | null> {
  try {
    const res = await fetch(`${LAB_API_URL}/v1/labs`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        template: templateId,
        rows,
        ttl,
        name: `sandbox-${Date.now().toString(36)}`,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('Lab creation failed:', err);
      return null;
    }

    const data: CreateLabResult = await res.json();
    return {
      projectId: data.id,
      branchId: data.id,
      connectionString: data.connectionString,
      labId: data.id,
      expiresAt: data.expiresAt,
    };
  } catch (e) {
    console.error('Lab creation error:', e);
    return null;
  }
}

/**
 * Seeding is handled by the Lab API during creation.
 * This function is kept for backward compatibility but returns
 * a synthetic success result since seeding already happened.
 */
export async function seedCloudSandbox(
  _connectionString: string,
  _templateId: string
): Promise<{ tablesCreated: number; rowsInserted: number } | null> {
  // Lab API seeds during creation — return synthetic success
  return { tablesCreated: 16, rowsInserted: 5000 };
}

/**
 * Execute SQL directly against Neon via their HTTP SQL API.
 * No proxy worker needed — queries go directly from browser to Neon.
 */
export async function queryCloud(
  connectionString: string,
  sql: string
): Promise<{
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  duration: number;
  error?: string;
}> {
  const start = performance.now();

  try {
    // Parse connection string to extract host and credentials
    const connUrl = new URL(connectionString.replace('postgresql://', 'https://'));
    const neonHost = connUrl.hostname;

    const res = await fetch(`https://${neonHost}/sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Neon-Connection-String': connectionString,
        'Neon-Raw-Text-Output': 'false',
        'Neon-Array-Mode': 'false',
      },
      body: JSON.stringify({
        queries: [{ query: sql, params: [] }],
      }),
    });

    const duration = Math.round(performance.now() - start);

    if (!res.ok) {
      const errText = await res.text();
      return { columns: [], rows: [], rowCount: 0, duration, error: `Query failed: ${errText}` };
    }

    const data = await res.json();

    // Neon HTTP SQL API returns an array of results (one per query)
    const result = data.results?.[0] ?? data[0];
    if (!result) {
      return { columns: [], rows: [], rowCount: 0, duration };
    }

    // Extract column names from fields
    const columns: string[] = (result.fields ?? []).map((f: { name: string }) => f.name);

    // Convert rows from array of objects or arrays
    let rows: Record<string, unknown>[] = [];
    if (result.rows && result.rows.length > 0) {
      if (Array.isArray(result.rows[0])) {
        // Array mode: convert to objects
        rows = result.rows.map((row: unknown[]) => {
          const obj: Record<string, unknown> = {};
          columns.forEach((col, i) => { obj[col] = row[i]; });
          return obj;
        });
      } else {
        rows = result.rows;
      }
    }

    return {
      columns,
      rows,
      rowCount: result.rowCount ?? rows.length,
      duration,
    };
  } catch (e) {
    const duration = Math.round(performance.now() - start);
    return {
      columns: [],
      rows: [],
      rowCount: 0,
      duration,
      error: e instanceof Error ? e.message : 'Cloud query failed',
    };
  }
}

/**
 * Delete a lab (destroys Neon branch + marks as deleted in D1).
 */
export async function destroyCloudSandbox(labId: string): Promise<boolean> {
  try {
    const res = await fetch(`${LAB_API_URL}/v1/labs/${labId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * List all active labs from the Lab API.
 */
export async function getMyCloudSandboxes(): Promise<CloudSandbox[]> {
  try {
    const res = await fetch(`${LAB_API_URL}/v1/labs`, {
      headers: getHeaders(),
    });

    if (!res.ok) return [];

    const data = await res.json();
    const labs = data.labs ?? [];

    // Map Lab API response to CloudSandbox shape
    return labs.map((lab: Record<string, unknown>) => ({
      ...lab,
      // Aliases for backward compatibility with CloudSandbox component
      template_id: lab.template,
      neon_project_id: lab.id,
    }));
  } catch {
    return [];
  }
}

/**
 * Get details of a specific lab.
 */
export async function getLabDetails(labId: string): Promise<CloudSandbox | null> {
  try {
    const res = await fetch(`${LAB_API_URL}/v1/labs/${labId}`, {
      headers: getHeaders(),
    });
    if (!res.ok) return null;
    const lab = await res.json();
    return { ...lab, template_id: lab.template, neon_project_id: lab.id };
  } catch {
    return null;
  }
}

/**
 * Extend a lab's TTL.
 */
export async function extendLabTTL(labId: string, ttl: string): Promise<boolean> {
  try {
    const res = await fetch(`${LAB_API_URL}/v1/labs/${labId}/ttl`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ ttl }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Get a shareable connection for a lab.
 */
export async function shareLabConnection(labId: string): Promise<string | null> {
  try {
    const res = await fetch(`${LAB_API_URL}/v1/labs/${labId}/share`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.connectionString;
  } catch {
    return null;
  }
}

/**
 * Save a query to a lab.
 */
export async function saveLabQuery(
  labId: string,
  name: string,
  sql: string,
  executionTimeMs?: number,
  rowCount?: number
): Promise<boolean> {
  try {
    const res = await fetch(`${LAB_API_URL}/v1/labs/${labId}/queries`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name, sql, executionTimeMs, rowCount }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * List saved queries for a lab.
 */
export async function getLabQueries(labId: string): Promise<Array<{ id: string; name: string; sql_text: string; created_at: string }>> {
  try {
    const res = await fetch(`${LAB_API_URL}/v1/labs/${labId}/queries`, {
      headers: getHeaders(),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.queries ?? [];
  } catch {
    return [];
  }
}

/**
 * Create a snapshot of a lab.
 */
export async function createLabSnapshot(
  labId: string,
  name: string,
  description?: string
): Promise<{ id: string; tableCount: number; totalRows: number } | null> {
  try {
    const res = await fetch(`${LAB_API_URL}/v1/labs/${labId}/snapshot`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name, description }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/**
 * Browse published labs in the gallery.
 */
export async function browseGallery(params?: {
  tag?: string;
  template?: string;
  q?: string;
}): Promise<Array<Record<string, unknown>>> {
  try {
    const searchParams = new URLSearchParams();
    if (params?.tag) searchParams.set('tag', params.tag);
    if (params?.template) searchParams.set('template', params.template);
    if (params?.q) searchParams.set('q', params.q);

    const url = `${LAB_API_URL}/v1/gallery${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return data.labs ?? [];
  } catch {
    return [];
  }
}

/**
 * Get a single published lab from the gallery by slug.
 */
export async function getGalleryLab(slug: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${LAB_API_URL}/v1/gallery/${slug}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/**
 * Browse published Experiments (the Experiment Gallery).
 */
export async function browseExperiments(params?: {
  tag?: string;
  template?: string;
  q?: string;
}): Promise<Array<Record<string, unknown>>> {
  try {
    const searchParams = new URLSearchParams();
    if (params?.tag) searchParams.set('tag', params.tag);
    if (params?.template) searchParams.set('template', params.template);
    if (params?.q) searchParams.set('q', params.q);

    const url = `${LAB_API_URL}/v1/gallery/experiments${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return data.experiments ?? [];
  } catch {
    return [];
  }
}

/**
 * Get a single published Experiment (with full evidence) by slug.
 * Pass a verified accessToken to view non-public visibility the caller
 * has access to, and to get back the caller's bookmark state / resolved
 * access level. Omit it for a plain public read.
 */
export async function getExperiment(slug: string, accessToken?: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${LAB_API_URL}/v1/gallery/experiments/${slug}`, { headers: getExperimentHeaders(accessToken) });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/**
 * Related Experiments — same template/author/tag-overlap heuristic,
 * scoped to a single Experiment's landing page. Public read.
 */
export async function getRelatedExperiments(slug: string): Promise<Array<Record<string, unknown>>> {
  try {
    const res = await fetch(`${LAB_API_URL}/v1/gallery/experiments/${slug}/related`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.related ?? [];
  } catch {
    return [];
  }
}

/**
 * Citation graph for an Experiment — citedBy (other experiments citing
 * this one) and cites (experiments this one cites), each row carrying the
 * other experiment's title/slug already joined in server-side.
 */
export async function getExperimentReferences(experimentId: string, accessToken?: string): Promise<{ citedBy: Array<Record<string, unknown>>; cites: Array<Record<string, unknown>> }> {
  try {
    const res = await fetch(`${LAB_API_URL}/v1/experiments/${experimentId}/references`, { headers: getExperimentHeaders(accessToken) });
    if (!res.ok) return { citedBy: [], cites: [] };
    return await res.json();
  } catch {
    return { citedBy: [], cites: [] };
  }
}

/**
 * Attach a citation — "sourceExperimentId builds upon targetExperimentId".
 * This is an edit to the SOURCE experiment, so sourceExperimentId is the
 * one whose editor-or-above access is checked server-side. Rejects
 * self-references and duplicates (same source+target pair).
 */
export async function addExperimentReference(sourceExperimentId: string, accessToken: string, fields: { targetExperimentId: string; note?: string }): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${LAB_API_URL}/v1/experiments/${sourceExperimentId}/references`, {
      method: 'POST',
      headers: getExperimentHeaders(accessToken),
      body: JSON.stringify(fields),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || `Failed (${res.status})` };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error' };
  }
}

/**
 * Remove a citation — same authorization as creating one: editor-or-above
 * on the reference's source experiment.
 */
export async function removeExperimentReference(sourceExperimentId: string, referenceId: string, accessToken: string): Promise<boolean> {
  try {
    const res = await fetch(`${LAB_API_URL}/v1/experiments/${sourceExperimentId}/references/${referenceId}`, {
      method: 'DELETE',
      headers: getExperimentHeaders(accessToken),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Edit an evidence block's title/description/tags (e.g. give a chart a
 * real title and description instead of its auto-generated one). Requires
 * editor-or-above access on the parent experiment, enforced server-side.
 */
export async function updateExperimentEvidence(
  experimentId: string,
  evidenceId: string,
  accessToken: string,
  fields: { title?: string; description?: string; tags?: string }
): Promise<boolean> {
  try {
    const res = await fetch(`${LAB_API_URL}/v1/experiments/${experimentId}/evidence/${evidenceId}`, {
      method: 'PATCH',
      headers: getExperimentHeaders(accessToken),
      body: JSON.stringify(fields),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Bookmark / un-bookmark an Experiment. Idempotent. Requires a verified
 * session — the actor is derived server-side from the token, not sent by
 * the client.
 */
export async function setExperimentBookmark(experimentId: string, accessToken: string, bookmarked: boolean): Promise<boolean> {
  try {
    const res = await fetch(
      `${LAB_API_URL}/v1/experiments/${experimentId}/bookmark`,
      { method: bookmarked ? 'POST' : 'DELETE', headers: getExperimentHeaders(accessToken) }
    );
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Report a reproduction — "I re-ran this and got a matching (or not)
 * result."
 */
export async function submitReproduction(experimentId: string, accessToken: string, matched: boolean, notes?: string): Promise<boolean> {
  try {
    const res = await fetch(`${LAB_API_URL}/v1/experiments/${experimentId}/reproductions`, {
      method: 'POST',
      headers: getExperimentHeaders(accessToken),
      body: JSON.stringify({ matched, notes }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * List structured peer reviews for an Experiment.
 */
export async function getExperimentReviews(experimentId: string, accessToken?: string): Promise<Array<Record<string, unknown>>> {
  try {
    const res = await fetch(`${LAB_API_URL}/v1/experiments/${experimentId}/reviews`, { headers: getExperimentHeaders(accessToken) });
    if (!res.ok) return [];
    const data = await res.json();
    return data.reviews ?? [];
  } catch {
    return [];
  }
}

/**
 * Submit a structured peer review — a suggestion, question, concern, or
 * endorsement, optionally anchored to a specific evidence block.
 */
export async function submitExperimentReview(
  experimentId: string,
  accessToken: string,
  reviewType: 'suggestion' | 'question' | 'concern' | 'endorsement',
  content: string,
  evidenceId?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${LAB_API_URL}/v1/experiments/${experimentId}/reviews`, {
      method: 'POST',
      headers: getExperimentHeaders(accessToken),
      body: JSON.stringify({ reviewType, content, evidenceId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: data.error || `Failed (${res.status})` };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error' };
  }
}

/**
 * Withdraw your own review.
 */
export async function withdrawExperimentReview(experimentId: string, reviewId: string, accessToken: string): Promise<boolean> {
  try {
    const res = await fetch(`${LAB_API_URL}/v1/experiments/${experimentId}/reviews/${reviewId}`, {
      method: 'DELETE',
      headers: getExperimentHeaders(accessToken),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Owner/editor marks a review addressed or dismissed.
 */
export async function resolveExperimentReview(experimentId: string, reviewId: string, accessToken: string, status: 'addressed' | 'dismissed'): Promise<boolean> {
  try {
    const res = await fetch(`${LAB_API_URL}/v1/experiments/${experimentId}/reviews/${reviewId}`, {
      method: 'PATCH',
      headers: getExperimentHeaders(accessToken),
      body: JSON.stringify({ status }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Fork a published Experiment — provisions a fresh lab from the same
 * template/seed/rows and clones all evidence into a new draft.
 */
export async function forkExperiment(slug: string, accessToken: string): Promise<{ id: string; labId: string; connectionString: string } | null> {
  try {
    const res = await fetch(`${LAB_API_URL}/v1/gallery/experiments/${slug}/fork`, {
      method: 'POST',
      headers: getExperimentHeaders(accessToken),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/**
 * Fork a published lab from the gallery.
 */
export async function forkGalleryLab(slug: string, name?: string): Promise<CreateLabResult | null> {
  try {
    const res = await fetch(`${LAB_API_URL}/v1/gallery/${slug}/fork`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/**
 * Available row count options for templates.
 */
export const ROW_OPTIONS = [
  { value: 5000, label: '5K rows', tier: 'free' },
  { value: 10000, label: '10K rows', tier: 'core' },
  { value: 50000, label: '50K rows', tier: 'core' },
  { value: 100000, label: '100K rows', tier: 'compliance' },
] as const;

/**
 * Create a student branch lab (for classroom mode).
 * Creates a new lab named after the student.
 */
export async function createStudentBranch(
  _projectId: string,
  studentId: string,
  template: string = 'banking'
): Promise<{ branchId: string; connectionString: string } | null> {
  // In the Lab API model, a student branch is just a new lab
  const result = await provisionCloudSandbox(template, 5000, '4h');
  if (!result) return null;
  return {
    branchId: result.labId,
    connectionString: result.connectionString,
  };
}

/**
 * Available templates (currently only banking has R2 SQL files).
 */
export const AVAILABLE_TEMPLATES = [
  { id: 'banking', name: 'Retail Banking', tables: 16, description: 'Full banking schema with accounts, transactions, loans, and compliance data' },
] as const;

// ── Professional Profile ────────────────────────────────────────────────
// What a signed-in user OWNS (drafts + published) and what they've DONE
// (bookmarks, reproductions, reviews, validations) across all experiments.
// Deliberately per-user, not per-workspace, so this is the foundation a
// public researcher/org profile can build on later without a route change.

export async function getMyExperiments(accessToken: string): Promise<Array<Record<string, unknown>>> {
  try {
    const res = await fetch(`${LAB_API_URL}/v1/experiments`, { headers: getExperimentHeaders(accessToken) });
    if (!res.ok) return [];
    const data = await res.json();
    return data.experiments ?? [];
  } catch {
    return [];
  }
}

export async function getMyBookmarks(accessToken: string): Promise<Array<Record<string, unknown>>> {
  try {
    const res = await fetch(`${LAB_API_URL}/v1/experiments/bookmarks/mine`, { headers: getExperimentHeaders(accessToken) });
    if (!res.ok) return [];
    const data = await res.json();
    return data.bookmarks ?? [];
  } catch {
    return [];
  }
}

export async function getMyReproductions(accessToken: string): Promise<Array<Record<string, unknown>>> {
  try {
    const res = await fetch(`${LAB_API_URL}/v1/experiments/reproductions/mine`, { headers: getExperimentHeaders(accessToken) });
    if (!res.ok) return [];
    const data = await res.json();
    return data.reproductions ?? [];
  } catch {
    return [];
  }
}

export async function getMyReviewsAuthored(accessToken: string): Promise<Array<Record<string, unknown>>> {
  try {
    const res = await fetch(`${LAB_API_URL}/v1/experiments/reviews/mine`, { headers: getExperimentHeaders(accessToken) });
    if (!res.ok) return [];
    const data = await res.json();
    return data.reviews ?? [];
  } catch {
    return [];
  }
}

export async function getMyValidations(accessToken: string): Promise<Array<Record<string, unknown>>> {
  try {
    const res = await fetch(`${LAB_API_URL}/v1/experiments/validations/mine`, { headers: getExperimentHeaders(accessToken) });
    if (!res.ok) return [];
    const data = await res.json();
    return data.validations ?? [];
  } catch {
    return [];
  }
}
