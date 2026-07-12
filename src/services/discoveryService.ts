// Knowledge Discovery layer client — one shared fetch function backing
// every discovery lens (Experiments/Visualizations/SQL/Profiles), mirroring
// the single shared query-building path on the backend (GET /v1/discover/:lens).
// Adding a new filter/sort control means changing this function's callers,
// not writing a new fetch per lens.

const LAB_API_URL = import.meta.env.VITE_LAB_API_URL || 'https://realitydb-lab-api.eddy-078.workers.dev';

export type DiscoveryLens = 'experiments' | 'visualizations' | 'sql' | 'profiles';
export type DiscoverySort = 'recent' | 'most_reproduced' | 'most_validated' | 'most_reviewed' | 'most_cited' | 'trending' | 'relevance';

export interface DiscoveryParams {
  q?: string;
  tag?: string;
  template?: string;
  chartType?: 'bar' | 'line' | 'pie';
  sort?: DiscoverySort;
  offset?: number;
}

export async function fetchDiscovery(lens: DiscoveryLens, params?: DiscoveryParams): Promise<Array<Record<string, unknown>>> {
  try {
    const searchParams = new URLSearchParams();
    if (params?.q) searchParams.set('q', params.q);
    if (params?.tag) searchParams.set('tag', params.tag);
    if (params?.template) searchParams.set('template', params.template);
    if (params?.chartType) searchParams.set('chartType', params.chartType);
    if (params?.sort) searchParams.set('sort', params.sort);
    if (params?.offset) searchParams.set('offset', String(params.offset));

    const url = `${LAB_API_URL}/v1/discover/${lens}${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return data.results ?? [];
  } catch {
    return [];
  }
}

export interface Facet {
  value: string;
  count: number;
}

export interface DiscoveryFacets {
  tags: Facet[];
  templates: Facet[];
  authors: Facet[];
}

const EMPTY_FACETS: DiscoveryFacets = { tags: [], templates: [], authors: [] };

/**
 * Distinct tag/template/author values (with counts) for a lens's published
 * population — backs real filter dropdowns instead of deriving options
 * from whatever page of results happened to already be loaded. Not
 * supported for the profiles lens (no tags/template there).
 */
export async function fetchFacets(lens: DiscoveryLens): Promise<DiscoveryFacets> {
  if (lens === 'profiles') return EMPTY_FACETS;
  try {
    const res = await fetch(`${LAB_API_URL}/v1/discover/facets?lens=${lens}`);
    if (!res.ok) return EMPTY_FACETS;
    const data = await res.json();
    return { tags: data.tags ?? [], templates: data.templates ?? [], authors: data.authors ?? [] };
  } catch {
    return EMPTY_FACETS;
  }
}

/**
 * Personalized recommendations — derived from the signed-in user's own
 * bookmark/reproduction affinity when accessToken is present; a sensible
 * global (trending) default otherwise. Never throws either way.
 */
export async function fetchRecommended(accessToken?: string, limit = 10): Promise<{ personalized: boolean; results: Array<Record<string, unknown>> }> {
  try {
    const headers: Record<string, string> = {};
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
    const res = await fetch(`${LAB_API_URL}/v1/discover/recommended?limit=${limit}`, { headers });
    if (!res.ok) return { personalized: false, results: [] };
    const data = await res.json();
    return { personalized: !!data.personalized, results: data.results ?? [] };
  } catch {
    return { personalized: false, results: [] };
  }
}

export interface PublicProfile {
  userId: string;
  published_count: number;
  stats: {
    reproduction_count: number;
    validation_count: number;
    validation_confirms_count: number;
    review_count: number;
  };
  experiments: Array<Record<string, unknown>>;
}

export async function getPublicProfile(userId: string): Promise<PublicProfile | null> {
  try {
    const res = await fetch(`${LAB_API_URL}/v1/profiles/${encodeURIComponent(userId)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
