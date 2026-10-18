import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearApiCache, normalizeSides, resolveDependencies, resolveVersion, searchMods } from "./modrinth";

type Route = (url: URL) => unknown;

function mockFetch(route: Route) {
  const fn = vi.fn(async (input: string | URL) => {
    const url = new URL(String(input));
    const body = route(url);
    if (body instanceof Response) return body;
    return new Response(JSON.stringify(body), { status: 200 });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

const version = (id: string, type: string, deps: string[] = []) => ({
  id,
  version_number: id,
  version_type: type,
  dependencies: deps.map((d) => ({ project_id: d, dependency_type: "required" })),
  files: [],
});

beforeEach(() => clearApiCache());
afterEach(() => vi.unstubAllGlobals());

describe("resolveVersion", () => {
  it("prefers the newest release but falls back to betas", async () => {
    mockFetch((url) =>
      url.pathname.includes("/project/a/") ? [version("a-beta", "beta"), version("a-rel", "release")] : [version("b-beta", "beta")],
    );
    expect((await resolveVersion("a", "1.21.1"))?.id).toBe("a-rel");
    expect((await resolveVersion("b", "1.21.1"))?.id).toBe("b-beta");
  });

  it("returns null when there is no build for the game version", async () => {
    mockFetch(() => []);
    expect(await resolveVersion("a", "1.21.1")).toBeNull();
  });

  it("retries after a rate limit response", async () => {
    vi.useFakeTimers();
    let calls = 0;
    mockFetch(() => {
      calls++;
      return calls === 1
        ? new Response("", { status: 429, headers: { "x-ratelimit-reset": "1" } })
        : [version("a-rel", "release")];
    });
    const pending = resolveVersion("a", "1.21.1");
    await vi.advanceTimersByTimeAsync(1000);
    expect((await pending)?.id).toBe("a-rel");
    expect(calls).toBe(2);
    vi.useRealTimers();
  });
});

describe("searchMods", () => {
  it("narrows by every chosen category on top of loader, version and side", async () => {
    const fetchMock = mockFetch(() => ({ hits: [], total_hits: 0 }));
    await searchMods({ query: "", mcVersion: "1.21.1", hideClientOnly: true, sort: "relevance", offset: 0, categories: ["worldgen", "adventure"] });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(JSON.parse(url.searchParams.get("facets")!)).toEqual([
      ["categories:fabric"],
      ["versions:1.21.1"],
      ["project_type:mod"],
      ["server_side:required", "server_side:optional"],
      ["categories:worldgen"],
      ["categories:adventure"],
    ]);
    // Browsing without a query sorts by popularity rather than relevance.
    expect(url.searchParams.get("index")).toBe("downloads");
  });
});

describe("normalizeSides", () => {
  it("keeps the legacy fields while Modrinth still sends them", () => {
    expect(normalizeSides({ client_side: "required", server_side: "unsupported", environment: ["client_and_server"] }))
      .toMatchObject({ client_side: "required", server_side: "unsupported" });
  });

  it.each([
    [["client_only"], "required", "unsupported"],
    [["client_only_server_optional"], "required", "optional"],
    [["server_only"], "unsupported", "required"],
    [["server_only_client_optional"], "optional", "required"],
    [["client_and_server"], "required", "required"],
    [["client_or_server_prefers_both"], "optional", "optional"],
    [["unknown"], "unknown", "unknown"],
  ])("derives sides from %j", (environment, client, server) => {
    expect(normalizeSides({ environment })).toMatchObject({ client_side: client, server_side: server });
  });
});

describe("resolveDependencies", () => {
  it("walks transitive dependencies, pins betas and flags missing builds", async () => {
    const projects: Record<string, object> = {
      voxy: { id: "voxy", slug: "voxy", title: "Voxy", client_side: "required", server_side: "unsupported" },
      sodium: { id: "sodium", slug: "sodium", title: "Sodium", client_side: "required", server_side: "unsupported" },
      gone: { id: "gone", slug: "gone", title: "Gone", client_side: "optional", server_side: "optional" },
    };
    const versions: Record<string, object[]> = {
      voxy: [version("voxy-beta", "beta", ["sodium"])],
      sodium: [version("sodium-rel", "release", ["voxy"])], // cycles must not loop forever
      gone: [],
    };
    mockFetch((url) => {
      if (url.pathname.endsWith("/projects")) {
        const ids = JSON.parse(url.searchParams.get("ids")!) as string[];
        return ids.filter((id) => id in projects).map((id) => projects[id]);
      }
      const id = url.pathname.split("/")[3];
      return versions[id] ?? [];
    });

    const deps = await resolveDependencies(["voxy", "gone", "deleted"], "26.2");
    const byId = Object.fromEntries(deps.map((d) => [d.id, d]));
    expect(Object.keys(byId).sort()).toEqual(["deleted", "gone", "sodium", "voxy"]);
    expect(byId.voxy).toMatchObject({ versionId: "voxy-beta", versionType: "beta", serverSide: "unsupported" });
    expect(byId.sodium.versionId).toBe("sodium-rel");
    expect(byId.gone.versionId).toBeNull();
    expect(byId.deleted.versionId).toBeNull();
  });
});
