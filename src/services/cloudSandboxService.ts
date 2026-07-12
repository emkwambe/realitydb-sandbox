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
 */
export async function getExperiment(slug: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${LAB_API_URL}/v1/gallery/experiments/${slug}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/**
 * Fork a published Experiment — provisions a fresh lab from the same
 * template/seed/rows and clones all evidence into a new draft.
 */
export async function forkExperiment(slug: string): Promise<{ id: string; labId: string; connectionString: string } | null> {
  try {
    const res = await fetch(`${LAB_API_URL}/v1/gallery/experiments/${slug}/fork`, {
      method: 'POST',
      headers: getHeaders(),
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
