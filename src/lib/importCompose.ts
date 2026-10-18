import { parse } from "yaml";
import { DEFAULT_SERVER, type BuilderState, type Difficulty, type GameMode, type LevelType, type ServerConfig } from "./state";

export interface ImportResult {
  patch: Partial<BuilderState>;
  /** Modrinth slugs or IDs from MODRINTH_PROJECTS, without version pins. */
  modRefs: string[];
  warnings: string[];
}

type Env = Record<string, string>;

function readEnv(raw: unknown): Env {
  if (Array.isArray(raw)) {
    // List form: ["KEY=value", ...]
    return Object.fromEntries(
      raw.map(String).map((line) => {
        const i = line.indexOf("=");
        return i === -1 ? [line, ""] : [line.slice(0, i), line.slice(i + 1)];
      }),
    );
  }
  if (raw && typeof raw === "object") {
    return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v === null ? "" : String(v)]));
  }
  return {};
}

const bool = (v: string | undefined) => (v === undefined ? undefined : /^(true|yes|1|on)$/i.test(v.trim()));
const int = (v: string | undefined) => {
  const n = v === undefined ? NaN : Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
};

/** "8G", "8g", "2048M" -> gigabytes, rounded up to a whole number. */
function gigabytes(v: string | undefined) {
  const m = v?.trim().match(/^(\d+(?:\.\d+)?)\s*([gGmM])?$/);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Math.max(1, Math.ceil(m[2]?.toLowerCase() === "m" ? n / 1024 : n));
}

const oneOf = <T extends string>(v: string | undefined, allowed: readonly T[]) => {
  const lower = v?.trim().toLowerCase();
  return allowed.find((a) => a === lower);
};

/** Parses a docker-compose.yml written for itzg/minecraft-server into builder state. Throws on unreadable YAML. */
export function importCompose(text: string): ImportResult {
  const doc = parse(text) as {
    name?: string;
    services?: Record<string, { image?: string; environment?: unknown; ports?: unknown[]; volumes?: unknown[] }>;
  };
  const services = Object.values(doc?.services ?? {});
  const service = services.find((s) => String(s?.image ?? "").includes("itzg/minecraft-server")) ?? services[0];
  if (!service) throw new Error("No services found in this file.");

  const warnings: string[] = [];
  if (!String(service.image ?? "").includes("itzg/minecraft-server")) {
    warnings.push("This file does not use the itzg/minecraft-server image; only matching settings were imported.");
  }
  const env = readEnv(service.environment);
  const type = env.TYPE?.toUpperCase();
  if (type && type !== "FABRIC") warnings.push(`The server type is ${type}. This tool builds Fabric servers, so mods may need replacing.`);

  const s: Partial<ServerConfig> = {};
  const set = <K extends keyof ServerConfig>(key: K, value: ServerConfig[K] | undefined) => {
    if (value !== undefined) s[key] = value;
  };
  set("motd", env.MOTD);
  set("iconUrl", env.ICON);
  set("mode", oneOf<GameMode>(env.MODE, ["survival", "creative", "adventure", "spectator"]));
  set("difficulty", oneOf<Difficulty>(env.DIFFICULTY, ["peaceful", "easy", "normal", "hard"]));
  set("hardcore", bool(env.HARDCORE));
  set("pvp", bool(env.PVP));
  set("seed", env.SEED);
  set("levelType", oneOf<LevelType>(env.LEVEL_TYPE, ["minecraft:normal", "minecraft:flat", "minecraft:large_biomes", "minecraft:amplified"]));
  set("maxPlayers", int(env.MAX_PLAYERS));
  set("viewDistance", int(env.VIEW_DISTANCE));
  set("simulationDistance", int(env.SIMULATION_DISTANCE));
  set("onlineMode", bool(env.ONLINE_MODE));
  set("allowFlight", bool(env.ALLOW_FLIGHT));
  set("commandBlocks", bool(env.ENABLE_COMMAND_BLOCK));
  set("spawnProtection", int(env.SPAWN_PROTECTION));
  set("whitelistEnabled", bool(env.ENABLE_WHITELIST));
  set("whitelist", env.WHITELIST?.split(",").map((x) => x.trim()).filter(Boolean).join(", "));
  set("ops", env.OPS?.split(",").map((x) => x.trim()).filter(Boolean).join(", "));
  set("timezone", env.TZ);
  set("memory", gigabytes(env.MEMORY ?? env.MAX_MEMORY));

  const dataMount = (service.volumes ?? []).map(String).find((v) => v.split(":")[1] === "/data");
  if (dataMount) set("storage", /^[./~]/.test(dataMount) ? "folder" : "volume");

  const backup = services.find((x) => String(x?.image ?? "").includes("itzg/mc-backup"));
  const backupEnv = readEnv(backup?.environment);
  set("backups", backup ? true : undefined);
  set("backupInterval", backupEnv.BACKUP_INTERVAL || undefined);
  set("backupKeepDays", int(backupEnv.PRUNE_BACKUPS_DAYS));

  // "25570:25565", "25570:25565/tcp", "0.0.0.0:25570:25565"
  for (const port of service.ports ?? []) {
    const parts = String(port).split("/")[0].split(":");
    if (parts.length >= 2 && parts[parts.length - 1] === "25565") set("port", int(parts[parts.length - 2]));
  }

  const modRefs = (env.MODRINTH_PROJECTS ?? "")
    .split(/[\s,]+/)
    .map((ref) => ref.trim())
    .filter((ref) => ref && !ref.startsWith("@") && !ref.includes("/"))
    // "slug", "slug:versionId", "slug:beta", "fabric:slug" (loader prefix) -> slug
    .map((ref) => {
      const parts = ref.replace(/\?$/, "").split(":");
      return parts.length === 3 || ["fabric", "datapack"].includes(parts[0]) ? parts[1] : parts[0];
    });

  const version = env.VERSION && !/^(latest|snapshot)$/i.test(env.VERSION) ? env.VERSION : undefined;
  if (!version) warnings.push("No fixed Minecraft version in the file; pick one in the Version step.");

  return {
    patch: {
      ...(version ? { mcVersion: version } : {}),
      ...(env.FABRIC_LOADER_VERSION ? { loaderVersion: env.FABRIC_LOADER_VERSION } : {}),
      ...(env.RCON_PASSWORD ? { rconPassword: env.RCON_PASSWORD } : {}),
      ...(doc.name ? { serverName: String(doc.name) } : {}),
      server: { ...DEFAULT_SERVER, ...s },
    },
    modRefs: [...new Set(modRefs)],
    warnings,
  };
}
