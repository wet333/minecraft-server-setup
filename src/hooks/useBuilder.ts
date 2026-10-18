import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildCompose, dependencyReasons, extraPorts, installsOnServer, missingDependencies, pinnedProjects, playerMods,
  recommendMemory, vanillaClientsCanJoin,
} from "../lib/compose";
import { importCompose } from "../lib/importCompose";
import {
  fetchFabricGameVersions, fetchFabricGameVersionsOf, fetchProjects, fetchStableFabricLoader, resolveDependencies,
  resolveVersion, type GameVersion, type ProjectSummary, type SearchHit,
} from "../lib/modrinth";
import { readSharedHash } from "../lib/share";
import {
  DEFAULT_STATE, randomPassword, toProjectName, usePersistentState,
  type BuilderState, type SelectedMod, type ServerConfig, type SideOverride, type TabId,
} from "../lib/state";

export interface Issue {
  level: "error" | "warning";
  message: string;
  tab: TabId;
  /** Element to focus when the user follows the issue link. */
  field?: string;
}

const TABS: TabId[] = ["version", "mods", "server", "export"];

function newMod(p: Pick<ProjectSummary, "slug" | "title" | "icon_url" | "client_side" | "server_side" | "description"> & { id: string }): SelectedMod {
  return {
    projectId: p.id,
    slug: p.slug,
    title: p.title,
    description: p.description ?? "",
    iconUrl: p.icon_url,
    clientSide: p.client_side,
    serverSide: p.server_side,
    sideOverride: null,
    status: "pending",
    resolvedFor: null,
    versionId: null,
    versionNumber: null,
    versionType: null,
    requiredDeps: [],
  };
}

export function portError(port: number) {
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? null : "Use a whole number between 1 and 65535.";
}

export function nameError(name: string) {
  return toProjectName(name) ? null : "Use at least one letter or number.";
}

export function issuesFor(state: BuilderState): Issue[] {
  const issues: Issue[] = [];
  if (!state.mcVersion) issues.push({ level: "error", tab: "version", message: "Pick a Minecraft version." });
  if (nameError(state.serverName)) issues.push({ level: "error", tab: "server", field: "server-name", message: "Give the server a name with at least one letter or number." });
  if (portError(state.server.port)) issues.push({ level: "error", tab: "server", field: "port", message: "The port must be a whole number between 1 and 65535." });
  if (state.mods.some((m) => m.status === "loading" || m.status === "pending"))
    issues.push({ level: "error", tab: "mods", message: "Still checking mod versions. This takes a few seconds." });
  for (const { mod, dep } of missingDependencies(state))
    issues.push({ level: "error", tab: "mods", message: `${mod} needs ${dep}, which has no Fabric build for ${state.mcVersion}. Remove ${mod} or pick another version.` });
  const failed = state.mods.filter((m) => m.status === "error");
  if (failed.length)
    issues.push({ level: "error", tab: "mods", message: `Could not check ${failed.map((m) => m.title).join(", ")}. Open the mod and retry, or remove it.` });
  const skipped = state.mods.filter((m) => m.status === "incompatible");
  if (skipped.length)
    issues.push({ level: "warning", tab: "mods", message: `Left out because they have no build for ${state.mcVersion}: ${skipped.map((m) => m.title).join(", ")}.` });
  const unknownSide = state.mods.filter((m) => m.status === "ok" && !m.sideOverride && (m.serverSide === "unknown" || m.clientSide === "unknown"));
  if (unknownSide.length)
    issues.push({ level: "warning", tab: "mods", message: `Modrinth does not say where ${unknownSide.map((m) => m.title).join(", ")} must be installed. Check the mod page and set it in the mod's details.` });
  return issues;
}

const tabFromHash = () => {
  const id = location.hash.slice(1) as TabId;
  return TABS.includes(id) ? id : null;
};

export function useBuilder() {
  const [state, setState] = usePersistentState();
  const [versions, setVersions] = useState<GameVersion[] | null>(null);
  const [versionsError, setVersionsError] = useState<string | null>(null);
  const [sharedLoaded, setSharedLoaded] = useState(false);
  /** Game versions each selected mod supports, for the compatibility counts. */
  const [support, setSupport] = useState<Record<string, Set<string> | "loading" | "error">>({});
  const inFlight = useRef(new Set<string>());
  const stateRef = useRef(state);
  stateRef.current = state;

  const setMods = useCallback(
    (fn: (mods: SelectedMod[]) => SelectedMod[]) => setState((s) => ({ ...s, mods: fn(s.mods) })),
    [setState],
  );
  const patchMod = useCallback(
    (id: string, patch: Partial<SelectedMod>) => setMods((mods) => mods.map((m) => (m.projectId === id ? { ...m, ...patch } : m))),
    [setMods],
  );

  // Shared links replace the setup once; a plain #step hash restores the step (browser back works).
  useEffect(() => {
    const shared = readSharedHash(location.hash);
    if (shared) {
      setState((s) => ({ ...s, ...shared, tab: "mods" }));
      setSharedLoaded(true);
      history.replaceState(null, "", `${location.pathname}${location.search}#mods`);
    } else {
      const tab = tabFromHash();
      if (tab) setState((s) => ({ ...s, tab }));
      else history.replaceState(null, "", `${location.pathname}${location.search}#${stateRef.current.tab}`);
    }
    const onPop = () => {
      const tab = tabFromHash();
      if (tab) setState((s) => ({ ...s, tab }));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // Runs once on load; reading the initial step from stateRef avoids re-running on every step change.
  }, [setState]);

  const loadVersions = useCallback(() => {
    setVersionsError(null);
    fetchFabricGameVersions()
      .then((list) => {
        setVersions(list);
        setState((s) => (s.mcVersion ? s : { ...s, mcVersion: list.find((v) => v.stable)?.version ?? "" }));
      })
      .catch((e: Error) => setVersionsError(e.message));
  }, [setState]);

  useEffect(loadVersions, [loadVersions]);

  useEffect(() => {
    if (state.loaderVersion) return;
    fetchStableFabricLoader()
      .then((loaderVersion) => setState((s) => (s.loaderVersion ? s : { ...s, loaderVersion })))
      .catch(() => {
        // Without a pinned loader the image picks the newest one, which still works.
      });
  }, [state.loaderVersion, setState]);

  // The backup service and the server share a generated console password.
  useEffect(() => {
    if (state.server.backups && !state.rconPassword) setState((s) => ({ ...s, rconPassword: randomPassword() }));
  }, [state.server.backups, state.rconPassword, setState]);

  // Resolve each selected mod to a concrete version for the chosen game version.
  useEffect(() => {
    const version = state.mcVersion;
    if (!version) return;
    for (const mod of state.mods) {
      const key = `${mod.projectId}@${version}`;
      if (mod.resolvedFor === version || mod.status === "error" || inFlight.current.has(key)) continue;
      inFlight.current.add(key);
      patchMod(mod.projectId, { status: "loading" });

      (async () => {
        try {
          const resolved = await resolveVersion(mod.projectId, version);
          const deps = resolved ? await resolveDependencies(resolved.requiredDepIds, version) : [];
          patchMod(mod.projectId, {
            resolvedFor: version,
            status: resolved ? "ok" : "incompatible",
            versionId: resolved?.id ?? null,
            versionNumber: resolved?.versionNumber ?? null,
            versionType: resolved?.versionType ?? null,
            requiredDeps: deps,
          });
        } catch {
          patchMod(mod.projectId, { resolvedFor: version, status: "error" });
        } finally {
          inFlight.current.delete(key);
        }
      })();
    }
  }, [state.mods, state.mcVersion, patchMod]);

  // Side data was captured when each mod was added and authors fix it over time; refresh it once
  // per session in one request. Pinned versions are left alone so an existing server never shifts.
  const refreshed = useRef(new Set<string>());
  useEffect(() => {
    const stale = state.mods.map((m) => m.projectId).filter((id) => !refreshed.current.has(id));
    if (!stale.length) return;
    stale.forEach((id) => refreshed.current.add(id));
    fetchProjects(stale)
      .then((projects) =>
        setMods((mods) =>
          mods.map((m) => {
            const p = projects.find((x) => x.id === m.projectId);
            return p ? { ...m, clientSide: p.client_side, serverSide: p.server_side, iconUrl: p.icon_url, title: p.title } : m;
          }),
        ),
      )
      .catch(() => stale.forEach((id) => refreshed.current.delete(id)));
  }, [state.mods, setMods]);

  // Learn which game versions each selected mod supports (cached per session).
  useEffect(() => {
    for (const mod of state.mods) {
      if (support[mod.projectId]) continue;
      setSupport((s) => ({ ...s, [mod.projectId]: "loading" }));
      fetchFabricGameVersionsOf(mod.projectId)
        .then((set) => setSupport((s) => ({ ...s, [mod.projectId]: set })))
        .catch(() => setSupport((s) => ({ ...s, [mod.projectId]: "error" })));
    }
  }, [state.mods, support]);

  const compatibility = useMemo(() => {
    const known = state.mods.map((m) => support[m.projectId]).filter((s): s is Set<string> => s instanceof Set);
    const ready = state.mods.length > 0 && known.length === state.mods.length;
    return {
      ready,
      total: state.mods.length,
      count: (version: string) => known.filter((s) => s.has(version)).length,
      unsupported: (version: string) => state.mods.filter((m) => {
        const s = support[m.projectId];
        return s instanceof Set && !s.has(version);
      }),
    };
  }, [state.mods, support]);

  const actions = useMemo(() => ({
    goTo: (tab: TabId) => {
      setState((s) => ({ ...s, tab }));
      if (location.hash !== `#${tab}`) history.pushState(null, "", `${location.pathname}${location.search}#${tab}`);
      window.scrollTo({ top: 0 });
    },
    setVersion: (mcVersion: string, removeIds: string[] = []) =>
      setState((s) => ({ ...s, mcVersion, mods: s.mods.filter((m) => !removeIds.includes(m.projectId)) })),
    setShowSnapshots: (showSnapshots: boolean) => setState((s) => ({ ...s, showSnapshots })),
    setServerName: (serverName: string) => setState((s) => ({ ...s, serverName })),
    setEula: (eulaAccepted: boolean) => setState((s) => ({ ...s, eulaAccepted })),
    patchServer: (patch: Partial<ServerConfig>) => setState((s) => ({ ...s, server: { ...s.server, ...patch } })),
    addMod: (hit: SearchHit) =>
      setMods((mods) => (mods.some((m) => m.projectId === hit.project_id) ? mods : [...mods, newMod({ ...hit, id: hit.project_id })])),
    /** Adds mods by slug (e.g. a starter pack). Returns how many were new. */
    addBySlugs: async (slugs: string[]) => {
      const projects = await fetchProjects(slugs);
      const have = new Set(stateRef.current.mods.map((m) => m.projectId));
      const fresh = projects.filter((p) => !have.has(p.id));
      setMods((mods) => [...mods, ...fresh.filter((p) => !mods.some((m) => m.projectId === p.id)).map(newMod)]);
      return fresh.length;
    },
    /** Removes a mod and returns a function that puts it back where it was. */
    removeMod: (id: string) => {
      let removed: { mod: SelectedMod; index: number } | null = null;
      setMods((mods) => {
        const index = mods.findIndex((m) => m.projectId === id);
        if (index >= 0) removed = { mod: mods[index], index };
        return mods.filter((m) => m.projectId !== id);
      });
      return () =>
        setMods((mods) => {
          if (!removed || mods.some((m) => m.projectId === id)) return mods;
          const next = [...mods];
          next.splice(removed.index, 0, removed.mod);
          return next;
        });
    },
    setSideOverride: (id: string, sideOverride: SideOverride | null) => patchMod(id, { sideOverride }),
    retryMod: (id: string) => patchMod(id, { status: "pending", resolvedFor: null }),
    /** Re-resolves every mod to its newest build. Only on request, so an existing server never shifts by itself. */
    checkForUpdates: () => setMods((mods) => mods.map((m) => ({ ...m, status: "pending", resolvedFor: null }))),
    reset: () =>
      setState({
        ...DEFAULT_STATE,
        mcVersion: versions?.find((v) => v.stable)?.version ?? "",
        loaderVersion: state.loaderVersion,
        eulaAccepted: state.eulaAccepted,
      }),
    retryVersions: loadVersions,
    /** Loads an existing compose file. Returns warnings to show; throws when the file cannot be read. */
    importFile: async (text: string) => {
      const { patch, modRefs, warnings } = importCompose(text);
      const projects: ProjectSummary[] = await fetchProjects(modRefs);
      const found = new Set(projects.flatMap((p) => [p.id, p.slug]));
      const missing = modRefs.filter((r) => !found.has(r));
      if (missing.length) warnings.push(`Not found on Modrinth: ${missing.join(", ")}.`);
      setState((s) => ({ ...s, ...patch, tab: "mods", mods: projects.map(newMod) }));
      history.pushState(null, "", `${location.pathname}${location.search}#mods`);
      return warnings;
    },
  }), [setState, setMods, patchMod, versions, state.loaderVersion, state.eulaAccepted, loadVersions]);

  const derived = useMemo(() => {
    const server = pinnedProjects(state);
    return {
      yaml: buildCompose(state),
      issues: issuesFor(state),
      serverProjects: server,
      serverModCount: state.mods.filter((m) => m.status === "ok" && installsOnServer(m)).length,
      players: playerMods(state),
      vanillaOk: vanillaClientsCanJoin(state),
      ports: extraPorts(state),
      reasons: dependencyReasons(state),
      memoryAdvice: recommendMemory(server.length, state.server.maxPlayers),
      projectName: toProjectName(state.serverName),
    };
  }, [state]);

  return {
    state, versions, versionsError, compatibility, sharedLoaded,
    dismissShared: () => setSharedLoaded(false), actions, ...derived,
  };
}

export type Builder = ReturnType<typeof useBuilder>;
