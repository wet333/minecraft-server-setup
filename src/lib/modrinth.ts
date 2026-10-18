// Thin client for the public Modrinth v2 API and the Fabric meta API.
// Both allow cross-origin requests, so the browser calls them directly.

const MODRINTH = "https://api.modrinth.com/v2";
const FABRIC_META = "https://meta.fabricmc.net/v2";

export type SideSupport = "required" | "optional" | "unsupported" | "unknown";

export interface SearchHit {
  project_id: string;
  slug: string;
  title: string;
  description: string;
  icon_url: string | null;
  author: string;
  downloads: number;
  follows: number;
  categories: string[];
  client_side: SideSupport;
  server_side: SideSupport;
  environment?: string[];
}

export interface SearchResult {
  hits: SearchHit[];
  total_hits: number;
}

export type SortIndex = "relevance" | "downloads" | "follows" | "newest" | "updated";

export interface GameVersion {
  version: string;
  stable: boolean;
}

export interface ResolvedVersion {
  id: string;
  versionNumber: string;
  versionType: "release" | "beta" | "alpha";
  requiredDepIds: string[];
}

export interface ProjectSummary {
  id: string;
  slug: string;
  title: string;
  icon_url: string | null;
  description?: string;
  client_side: SideSupport;
  server_side: SideSupport;
  environment?: string[];
}

export interface ResolvedDependency {
  id: string;
  slug: string;
  title: string;
  clientSide: SideSupport;
  serverSide: SideSupport;
  /** null when the dependency has no Fabric build for the game version. */
  versionId: string | null;
  versionNumber: string | null;
  versionType: string | null;
}

export interface VersionFile {
  versionId: string;
  url: string;
  filename: string;
  size: number;
  sha1: string;
  sha512: string;
}

// Loader names Modrinth mixes into `categories`; hidden when showing tags.
export const LOADER_CATEGORIES = new Set([
  "fabric", "forge", "neoforge", "quilt", "liteloader", "rift", "modloader",
  "bukkit", "spigot", "paper", "purpur", "folia", "sponge", "velocity",
  "bungeecord", "waterfall", "datapack", "minecraft", "iris", "optifine",
]);

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

const RETRIES = 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET with retries on rate limiting (429) and server errors, honouring Modrinth's reset header. */
async function fetchWithRetry(url: string, signal?: AbortSignal): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, { signal });
    } catch (e) {
      if ((e as Error).name === "AbortError" || attempt >= RETRIES) throw e;
      await sleep(500 * 2 ** attempt);
      continue;
    }
    if (res.ok) return res;
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= RETRIES) {
      throw new ApiError(
        res.status === 429 ? "Modrinth is rate limiting requests. Wait a minute and try again." : `Request failed (${res.status})`,
        res.status,
      );
    }
    const reset = Number(res.headers.get("x-ratelimit-reset"));
    await sleep(reset > 0 ? Math.min(reset, 60) * 1000 : 500 * 2 ** attempt);
  }
}

// Responses rarely change within a session, so identical GETs share one request.
const cache = new Map<string, Promise<unknown>>();

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  // Aborted requests must not poison the cache, so only unsignalled calls are cached.
  if (signal) return (await fetchWithRetry(url, signal)).json() as Promise<T>;
  const hit = cache.get(url);
  if (hit) return hit as Promise<T>;
  const pending = fetchWithRetry(url).then((r) => r.json() as Promise<T>);
  cache.set(url, pending);
  pending.catch(() => cache.delete(url));
  return pending;
}

/** Test hook. */
export function clearApiCache() {
  cache.clear();
}

const enc = (value: unknown) => encodeURIComponent(JSON.stringify(value));

export function fetchFabricGameVersions(signal?: AbortSignal) {
  return getJson<GameVersion[]>(`${FABRIC_META}/versions/game`, signal);
}

/** Newest stable Fabric loader; pinned on the server and named in the players' install steps so they match. */
export async function fetchStableFabricLoader(): Promise<string> {
  const loaders = await getJson<{ version: string; stable: boolean }[]>(`${FABRIC_META}/versions/loader`);
  const stable = loaders.find((l) => l.stable) ?? loaders[0];
  if (!stable) throw new Error("No Fabric loader versions available");
  return stable.version;
}

export async function searchMods(opts: {
  query: string;
  mcVersion: string;
  hideClientOnly: boolean;
  sort: SortIndex;
  offset: number;
  /** Every listed category must match, as on modrinth.com. */
  categories?: string[];
  limit?: number;
  signal?: AbortSignal;
}) {
  const facets: string[][] = [
    ["categories:fabric"],
    [`versions:${opts.mcVersion}`],
    ["project_type:mod"],
  ];
  if (opts.hideClientOnly) facets.push(["server_side:required", "server_side:optional"]);
  for (const c of opts.categories ?? []) facets.push([`categories:${c}`]);

  // An empty query sorted by relevance returns noise; show popular mods instead.
  const index = !opts.query.trim() && opts.sort === "relevance" ? "downloads" : opts.sort;
  const params = [
    `query=${encodeURIComponent(opts.query.trim())}`,
    `facets=${enc(facets)}`,
    `index=${index}`,
    `offset=${opts.offset}`,
    `limit=${opts.limit ?? 20}`,
  ].join("&");
  const result = await getJson<SearchResult>(`${MODRINTH}/search?${params}`, opts.signal);
  return { ...result, hits: result.hits.map(normalizeSides) };
}

interface ApiVersion {
  id: string;
  version_number: string;
  version_type: "release" | "beta" | "alpha";
  dependencies: { project_id: string | null; dependency_type: string }[];
  files: { url: string; filename: string; primary: boolean; size: number; hashes: { sha1: string; sha512: string } }[];
}

/** Picks the newest Fabric build of a mod for a game version, preferring releases. */
export async function resolveVersion(projectId: string, mcVersion: string): Promise<ResolvedVersion | null> {
  const versions = await getJson<ApiVersion[]>(
    `${MODRINTH}/project/${projectId}/version?loaders=${enc(["fabric"])}&game_versions=${enc([mcVersion])}`,
  );
  if (versions.length === 0) return null;
  const pick = versions.find((v) => v.version_type === "release") ?? versions[0];
  return {
    id: pick.id,
    versionNumber: pick.version_number,
    versionType: pick.version_type,
    requiredDepIds: pick.dependencies
      .filter((d) => d.dependency_type === "required" && d.project_id)
      .map((d) => d.project_id!),
  };
}

/**
 * Modrinth is replacing client_side/server_side with an `environment` list
 * (e.g. "client_only", "client_and_server"). Use the old fields while present.
 */
export function normalizeSides<T extends { client_side?: SideSupport; server_side?: SideSupport; environment?: string[] }>(
  p: T,
): T & { client_side: SideSupport; server_side: SideSupport } {
  if (p.client_side && p.server_side) return p as T & { client_side: SideSupport; server_side: SideSupport };
  const env = p.environment ?? [];
  const has = (prefix: string) => env.some((e) => e.startsWith(prefix));
  let client: SideSupport = "unknown";
  let server: SideSupport = "unknown";
  if (has("client_only")) [client, server] = ["required", env.includes("client_only_server_optional") ? "optional" : "unsupported"];
  else if (has("server_only") || has("dedicated_server_only")) [client, server] = [env.includes("server_only_client_optional") ? "optional" : "unsupported", "required"];
  else if (has("client_and_server")) [client, server] = ["required", "required"];
  else if (has("client_or_server")) [client, server] = ["optional", "optional"];
  else if (has("singleplayer_only")) [client, server] = ["required", "unsupported"];
  return { ...p, client_side: client, server_side: server };
}

export async function fetchProjects(ids: string[]): Promise<ProjectSummary[]> {
  if (ids.length === 0) return [];
  const projects = await getJson<ProjectSummary[]>(`${MODRINTH}/projects?ids=${enc([...ids].sort())}`);
  return projects.map(normalizeSides);
}

/** Every game version a mod has a Fabric build for. */
export async function fetchFabricGameVersionsOf(projectId: string): Promise<Set<string>> {
  const versions = await getJson<{ game_versions: string[] }[]>(
    `${MODRINTH}/project/${projectId}/version?loaders=${enc(["fabric"])}&include_changelog=false`,
  );
  return new Set(versions.flatMap((v) => v.game_versions));
}

/** Primary download file of each version, for the players' mods folder. */
export async function fetchVersionFiles(versionIds: string[]): Promise<VersionFile[]> {
  if (versionIds.length === 0) return [];
  const versions = await getJson<ApiVersion[]>(`${MODRINTH}/versions?ids=${enc([...versionIds].sort())}`);
  return versions.map((v) => {
    const file = v.files.find((f) => f.primary) ?? v.files[0];
    if (!file) throw new Error(`Version ${v.id} has no files`);
    return {
      versionId: v.id,
      url: file.url,
      filename: file.filename,
      size: file.size,
      sha1: file.hashes.sha1,
      sha512: file.hashes.sha512,
    };
  });
}

// Only Modrinth's own CDN is trusted for jar downloads.
const DOWNLOAD_HOSTS = new Set(["cdn.modrinth.com"]);

async function sha1Hex(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-1", data as BufferSource);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export interface DownloadProgress {
  done: number;
  total: number;
}

/**
 * Downloads mod jars from Modrinth's CDN, a few at a time, and checks each against the SHA-1
 * Modrinth publishes so a broken or tampered file never ends up in the zip.
 * Returns file name → contents.
 */
export async function downloadVersionFiles(
  files: VersionFile[],
  onProgress?: (p: DownloadProgress) => void,
): Promise<Map<string, Uint8Array>> {
  const out = new Map<string, Uint8Array>();
  const queue = [...files];
  let done = 0;
  onProgress?.({ done, total: files.length });

  const worker = async () => {
    for (let f = queue.shift(); f; f = queue.shift()) {
      if (!DOWNLOAD_HOSTS.has(new URL(f.url).hostname)) throw new Error(`${f.filename} is not hosted on Modrinth's CDN.`);
      const data = new Uint8Array(await (await fetchWithRetry(f.url)).arrayBuffer());
      if ((await sha1Hex(data)) !== f.sha1) throw new Error(`${f.filename} did not match its checksum. Try again.`);
      // Two mods shipping the same file name would overwrite each other.
      out.set(out.has(f.filename) ? `${f.versionId}-${f.filename}` : f.filename, data);
      onProgress?.({ done: ++done, total: files.length });
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, files.length) }, worker));
  return out;
}

/**
 * Walks required dependencies (including transitive ones) and pins each to a version.
 * The compose lists them explicitly because the Docker image only picks release builds
 * when it expands dependencies itself, and fails on projects that only publish betas.
 */
export async function resolveDependencies(rootIds: string[], mcVersion: string): Promise<ResolvedDependency[]> {
  const resolved = new Map<string, ResolvedDependency>();
  let queue = [...new Set(rootIds)];

  while (queue.length > 0) {
    const projects = await fetchProjects(queue);
    const next: string[] = [];
    const results = await Promise.all(projects.map(async (p) => [p, await resolveVersion(p.id, mcVersion)] as const));

    for (const [p, version] of results) {
      resolved.set(p.id, {
        id: p.id,
        slug: p.slug,
        title: p.title,
        clientSide: p.client_side,
        serverSide: p.server_side,
        versionId: version?.id ?? null,
        versionNumber: version?.versionNumber ?? null,
        versionType: version?.versionType ?? null,
      });
      if (version) next.push(...version.requiredDepIds);
    }
    // Projects the API did not return (deleted or hidden) cannot be downloaded either.
    for (const id of queue) {
      if (!resolved.has(id)) {
        resolved.set(id, {
          id, slug: id, title: id, clientSide: "unknown", serverSide: "unknown",
          versionId: null, versionNumber: null, versionType: null,
        });
      }
    }
    queue = [...new Set(next)].filter((id) => !resolved.has(id));
  }
  return [...resolved.values()];
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
}
