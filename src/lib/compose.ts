import { Document, Scalar, YAMLMap, YAMLSeq } from "yaml";
import { APP_NAME, APP_URL } from "./brand";
import { placement } from "./sides";
import { type BuilderState, type SelectedMod, VANILLA_DEFAULTS, toProjectName } from "./state";

const IMAGE = "itzg/minecraft-server";
const BACKUP_IMAGE = "itzg/mc-backup";
const VOLUME = "mc-data";

const list = (text: string) =>
  text
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(",");

export interface PinnedProject {
  projectId: string;
  slug: string;
  title: string;
  versionId: string;
  versionNumber: string;
}

/** Ports that mods open on top of the game port. */
export const MOD_PORTS: Record<string, { port: string; label: string }> = {
  "simple-voice-chat": { port: "24454:24454/udp", label: "Simple Voice Chat" },
  "plasmo-voice": { port: "60606:60606/udp", label: "Plasmo Voice" },
  bluemap: { port: "8100:8100/tcp", label: "BlueMap web map" },
  dynmap: { port: "8123:8123/tcp", label: "Dynmap web map" },
  squaremap: { port: "8080:8080/tcp", label: "squaremap web map" },
};

const resolved = (state: BuilderState) => state.mods.filter((m) => m.status === "ok" && m.versionId);

/** Whether the server installs the mod: Modrinth's side data unless the user overrode it. */
export const installsOnServer = (m: SelectedMod) => placement(m.clientSide, m.serverSide, m.sideOverride).server;

/** Whether every player must install the mod to join. */
export const neededByPlayers = (m: SelectedMod) => placement(m.clientSide, m.serverSide, m.sideOverride).players;

const pin = (p: { id: string; slug: string; title: string; versionId: string; versionNumber: string | null }): PinnedProject => ({
  projectId: p.id, slug: p.slug, title: p.title, versionId: p.versionId, versionNumber: p.versionNumber ?? "",
});

/** Adds each mod and its pinned dependencies, once each, in selection order. */
function collect(mods: SelectedMod[]) {
  const seen = new Set<string>();
  const out: PinnedProject[] = [];
  const add = (p: PinnedProject) => {
    if (seen.has(p.projectId)) return;
    seen.add(p.projectId);
    out.push(p);
  };
  for (const m of mods) add(pin({ ...m, id: m.projectId, versionId: m.versionId! }));
  for (const m of mods) {
    for (const d of m.requiredDeps) if (d.versionId) add(pin({ ...d, versionId: d.versionId }));
  }
  return out;
}

/**
 * Server mods plus their required dependencies, each pinned to a version.
 * The image skips dependency expansion for projects listed explicitly, so pinning
 * dependencies here avoids its release-only version picking.
 */
export function pinnedProjects(state: BuilderState): PinnedProject[] {
  return collect(resolved(state).filter(installsOnServer));
}

/**
 * What every player must install to join: mods the client needs and their dependencies,
 * plus libraries of server mods that the client requires on their own.
 */
export function playerMods(state: BuilderState): PinnedProject[] {
  const mods = resolved(state);
  const out = collect(mods.filter(neededByPlayers));
  const ids = new Set(out.map((p) => p.projectId));
  for (const m of mods.filter((x) => installsOnServer(x) && !neededByPlayers(x) && !x.sideOverride)) {
    for (const d of m.requiredDeps) {
      if (d.versionId && d.clientSide === "required" && !ids.has(d.id)) {
        ids.add(d.id);
        out.push(pin({ ...d, versionId: d.versionId }));
      }
    }
  }
  return out;
}

/** Which selected mods pulled in a dependency, for "why is this here?" hints. */
export function dependencyReasons(state: BuilderState): Map<string, string[]> {
  const reasons = new Map<string, string[]>();
  for (const m of resolved(state)) {
    for (const d of m.requiredDeps) reasons.set(d.id, [...(reasons.get(d.id) ?? []), m.title]);
  }
  return reasons;
}

/** Required dependencies with no build for the game version; the server or the players' game would fail to start. */
export function missingDependencies(state: BuilderState): { mod: string; dep: string }[] {
  return state.mods
    .filter((m) => m.status === "ok")
    .flatMap((m) => m.requiredDeps.filter((d) => !d.versionId).map((d) => ({ mod: m.title, dep: d.title })));
}

export function extraPorts(state: BuilderState) {
  return pinnedProjects(state).flatMap((p) => (MOD_PORTS[p.slug] ? [MOD_PORTS[p.slug]] : []));
}

/** True when nothing has to be installed on the players' side. */
export const vanillaClientsCanJoin = (state: BuilderState) => playerMods(state).length === 0;

/**
 * Image tag with the Java version Mojang requires for a game version, so a restart never
 * jumps Java and breaks with "class file version" errors. See the itzg image's Java table.
 */
export function javaTagFor(mcVersion: string): string {
  const release = mcVersion.match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
  if (release) {
    const [major, minor, patch] = [Number(release[1]), Number(release[2]), Number(release[3] ?? 0)];
    // Since 26.1 versions are year-based and need Java 25.
    if (major !== 1) return "java25";
    if (minor <= 16) return "java8";
    if (minor < 20 || (minor === 20 && patch < 5)) return "java17";
    return "java21";
  }
  // Weekly snapshots like "24w14a": 24w and 25w are the 1.20.5–1.21.x cycle.
  const weekly = mcVersion.match(/^(\d\d)w/);
  if (weekly) return Number(weekly[1]) >= 26 ? "java25" : Number(weekly[1]) >= 24 ? "java21" : "java17";
  return "java25";
}

/** Environment variables understood by the itzg/minecraft-server image. */
export function buildEnvironment(state: BuilderState): Record<string, string> {
  const s = state.server;
  const env: Record<string, string> = {
    // Only the user can accept the EULA; without it the image refuses to start, which is correct.
    EULA: state.eulaAccepted ? "TRUE" : "FALSE",
    TYPE: "FABRIC",
    VERSION: state.mcVersion,
  };
  if (state.loaderVersion) env.FABRIC_LOADER_VERSION = state.loaderVersion;
  env.MOTD = s.motd;

  // Downloaded once: the image keeps an existing server-icon.png, so a host that later blocks or
  // expires the link cannot fail every restart. Delete data/server-icon.png to change it.
  if (s.iconUrl.trim()) env.ICON = s.iconUrl.trim();

  env.MODE = s.mode;
  env.DIFFICULTY = s.difficulty;
  if (s.hardcore) env.HARDCORE = "true";
  env.PVP = String(s.pvp);
  if (s.seed.trim()) env.SEED = s.seed.trim();
  if (s.levelType !== "minecraft:normal") env.LEVEL_TYPE = s.levelType;

  if (s.maxPlayers !== VANILLA_DEFAULTS.maxPlayers) env.MAX_PLAYERS = String(s.maxPlayers);
  if (s.viewDistance !== VANILLA_DEFAULTS.viewDistance) env.VIEW_DISTANCE = String(s.viewDistance);
  if (s.simulationDistance !== VANILLA_DEFAULTS.simulationDistance)
    env.SIMULATION_DISTANCE = String(s.simulationDistance);
  if (s.onlineMode !== VANILLA_DEFAULTS.onlineMode) env.ONLINE_MODE = String(s.onlineMode);
  if (s.allowFlight !== VANILLA_DEFAULTS.allowFlight) env.ALLOW_FLIGHT = String(s.allowFlight);
  if (s.commandBlocks !== VANILLA_DEFAULTS.commandBlocks) env.ENABLE_COMMAND_BLOCK = String(s.commandBlocks);
  if (s.spawnProtection !== VANILLA_DEFAULTS.spawnProtection) env.SPAWN_PROTECTION = String(s.spawnProtection);

  if (s.whitelistEnabled) {
    env.ENABLE_WHITELIST = "true";
    // Kicks online players who are no longer listed when the whitelist changes.
    env.ENFORCE_WHITELIST = "true";
    if (list(s.whitelist)) env.WHITELIST = list(s.whitelist);
  }
  if (list(s.ops)) env.OPS = list(s.ops);

  const projects = pinnedProjects(state);
  if (projects.length > 0) {
    env.MODRINTH_PROJECTS = projects.map((p) => `${p.slug}:${p.versionId}`).join(", ");
    // The full dependency graph is pinned above, so the image must not pick versions itself.
    // No REMOVE_OLD_MODS: the image already removes old versions and unlisted projects, and wiping
    // the folder would re-download every jar on each start.
    env.MODRINTH_DOWNLOAD_DEPENDENCIES = "none";
  }

  env.MEMORY = `${s.memory}G`;
  // Well-tested garbage collector tuning for Minecraft servers.
  env.USE_AIKAR_FLAGS = "true";
  if (s.timezone.trim()) env.TZ = s.timezone.trim();
  // The backup service needs to know the console password; the console port itself stays private.
  if (s.backups && state.rconPassword) env.RCON_PASSWORD = state.rconPassword;
  return env;
}

export function buildCompose(state: BuilderState): string {
  const s = state.server;
  const ports = [`${s.port}:25565/tcp`, ...extraPorts(state).map((p) => p.port)];
  const data = s.storage === "volume" ? VOLUME : "./data";

  const services: Record<string, unknown> = {
    mc: {
      image: `${IMAGE}:${javaTagFor(state.mcVersion)}`,
      restart: "unless-stopped",
      // The image saves the world for up to 60 s on shutdown; Docker would kill it after 10 s.
      stop_grace_period: "2m",
      tty: true,
      stdin_open: true,
      ports,
      environment: buildEnvironment(state),
      volumes: [`${data}:/data`],
    },
  };
  if (s.backups) {
    services.backups = {
      image: BACKUP_IMAGE,
      restart: "unless-stopped",
      depends_on: { mc: { condition: "service_healthy" } },
      environment: {
        RCON_HOST: "mc",
        RCON_PASSWORD: state.rconPassword,
        BACKUP_INTERVAL: s.backupInterval,
        PRUNE_BACKUPS_DAYS: String(s.backupKeepDays),
        // No point archiving an unchanged world.
        PAUSE_IF_NO_PLAYERS: "true",
        ...(s.timezone.trim() ? { TZ: s.timezone.trim() } : {}),
      },
      volumes: [`${data}:/data:ro`, "./backups:/backups"],
    };
  }

  const doc = new Document({
    name: toProjectName(state.serverName) || "minecraft",
    services,
    ...(s.storage === "volume" ? { volumes: { [VOLUME]: {} } } : {}),
  });

  doc.commentBefore = ` Generated by ${APP_NAME} (${APP_URL})\n Start it with: docker compose up -d`;

  // Identifiers read better unquoted; every other string stays double-quoted.
  const plain = [["name"], ["services", "mc", "image"], ["services", "mc", "restart"], ["services", "mc", "stop_grace_period"]];
  if (s.backups) plain.push(["services", "backups", "image"], ["services", "backups", "restart"], ["services", "backups", "depends_on", "mc", "condition"]);
  for (const path of plain) (doc.getIn(path, true) as Scalar).type = Scalar.PLAIN;
  if (s.storage === "volume") ((doc.get("volumes") as YAMLMap).items[0].value as YAMLMap).flow = true;

  const portSeq = doc.getIn(["services", "mc", "ports"]) as YAMLSeq<Scalar>;
  portSeq.items[0].commentBefore = " Game port";
  extraPorts(state).forEach((p, i) => (portSeq.items[i + 1].commentBefore = ` ${p.label}`));

  return doc.toString({ defaultStringType: "QUOTE_DOUBLE", defaultKeyType: "PLAIN", lineWidth: 0 });
}

/**
 * Suggested Java heap. Modded servers need more as the mod count grows; each extra
 * handful of players adds loaded chunks. Capped where more memory stops helping.
 */
export function recommendMemory(serverModCount: number, maxPlayers: number): { gb: number; reason: string } {
  const base = serverModCount === 0 ? 2 : serverModCount <= 20 ? 4 : serverModCount <= 60 ? 6 : 8;
  const extra = Math.max(0, Math.ceil((maxPlayers - 10) / 10));
  const gb = Math.min(base + extra, 16);
  const mods = serverModCount === 0 ? "no mods" : `${serverModCount} mod${serverModCount === 1 ? "" : "s"}`;
  return { gb, reason: `${gb} GB suits ${mods} and up to ${maxPlayers} players.` };
}
