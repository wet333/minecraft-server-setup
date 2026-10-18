import { useEffect, useState } from "react";
import type { ResolvedDependency, SideSupport } from "./modrinth";

export type ModStatus = "pending" | "loading" | "ok" | "incompatible" | "error";

/** Where a mod gets installed when the user overrides Modrinth's (often wrong) side metadata. */
export type SideOverride = "both" | "server" | "client";

export interface SelectedMod {
  projectId: string;
  slug: string;
  title: string;
  description: string;
  iconUrl: string | null;
  clientSide: SideSupport;
  serverSide: SideSupport;
  sideOverride?: SideOverride | null;
  status: ModStatus;
  /** Game version the fields below were resolved for. */
  resolvedFor: string | null;
  versionId: string | null;
  versionNumber: string | null;
  versionType: string | null;
  /** Required dependencies, transitive ones included, each pinned to a version. */
  requiredDeps: ResolvedDependency[];
}

export type GameMode = "survival" | "creative" | "adventure" | "spectator";
export type Difficulty = "peaceful" | "easy" | "normal" | "hard";
export type LevelType = "minecraft:normal" | "minecraft:flat" | "minecraft:large_biomes" | "minecraft:amplified";
export type Storage = "folder" | "volume";

export interface ServerConfig {
  motd: string;
  iconUrl: string;
  mode: GameMode;
  difficulty: Difficulty;
  hardcore: boolean;
  pvp: boolean;
  seed: string;
  levelType: LevelType;
  maxPlayers: number;
  /** Java heap in GB; Aikar's flags want the minimum and maximum equal. */
  memory: number;
  port: number;
  viewDistance: number;
  simulationDistance: number;
  onlineMode: boolean;
  allowFlight: boolean;
  commandBlocks: boolean;
  spawnProtection: number;
  whitelistEnabled: boolean;
  whitelist: string;
  ops: string;
  /** IANA zone for log timestamps, e.g. "America/Montevideo". */
  timezone: string;
  /** "folder" keeps files next to the compose file; "volume" suits Windows, NAS and Portainer. */
  storage: Storage;
  backups: boolean;
  /** mc-backup interval in sleep format, e.g. "24h". */
  backupInterval: string;
  backupKeepDays: number;
}

export type TabId = "version" | "mods" | "server" | "export";

export interface BuilderState {
  tab: TabId;
  mcVersion: string;
  showSnapshots: boolean;
  mods: SelectedMod[];
  server: ServerConfig;
  serverName: string;
  /** Fabric loader pinned on the server and named in the players' install steps; "" until fetched. */
  loaderVersion: string;
  /** The user's own acceptance of the Minecraft EULA; never carried in share links. */
  eulaAccepted: boolean;
  /** Shared by the server and the backup service; never carried in share links. */
  rconPassword: string;
}

// Vanilla server.properties defaults; the compose only emits values that differ.
export const VANILLA_DEFAULTS = {
  maxPlayers: 20,
  viewDistance: 10,
  simulationDistance: 10,
  onlineMode: true,
  allowFlight: false,
  commandBlocks: false,
  spawnProtection: 16,
} as const;

function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

export const DEFAULT_SERVER: ServerConfig = {
  motd: "A Fabric Minecraft Server",
  iconUrl: "",
  mode: "survival",
  difficulty: "normal",
  hardcore: false,
  pvp: true,
  seed: "",
  levelType: "minecraft:normal",
  memory: 4,
  port: 25565,
  ...VANILLA_DEFAULTS,
  // Modded movement (jetpacks, grappling hooks) trips the vanilla anti-fly kick.
  allowFlight: true,
  // Modded servers tick more per chunk; a slightly smaller simulated area keeps them smooth.
  simulationDistance: 8,
  whitelistEnabled: false,
  whitelist: "",
  ops: "",
  timezone: browserTimezone(),
  storage: "folder",
  backups: false,
  backupInterval: "24h",
  backupKeepDays: 7,
};

export const DEFAULT_STATE: BuilderState = {
  tab: "version",
  mcVersion: "",
  showSnapshots: false,
  mods: [],
  server: DEFAULT_SERVER,
  serverName: "my-server",
  loaderVersion: "",
  eulaAccepted: false,
  rconPassword: "",
};

export function randomPassword(length = 24): string {
  const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

const STORAGE_KEY = "composter:v1";
const LEGACY_STORAGE_KEY = "mc-compose-builder:v1";

/** Restores a saved state, filling fields added since it was written. Never throws. */
export function parseSavedState(raw: string | null): BuilderState {
  if (!raw) return DEFAULT_STATE;
  try {
    const saved = JSON.parse(raw) as Partial<BuilderState> & { server?: Partial<ServerConfig> & { maxMemory?: number } };
    if (typeof saved !== "object" || saved === null) return DEFAULT_STATE;
    const server = { ...DEFAULT_SERVER, ...saved.server };
    // Earlier versions had separate initial and maximum memory.
    if (saved.server && saved.server.memory === undefined && typeof saved.server.maxMemory === "number") {
      server.memory = saved.server.maxMemory;
    }
    delete (server as { initMemory?: number }).initMemory;
    delete (server as { maxMemory?: number }).maxMemory;
    return {
      ...DEFAULT_STATE,
      ...saved,
      server,
      // A reload interrupts in-flight lookups, and older saves lack dependency details; queue them again.
      mods: (Array.isArray(saved.mods) ? saved.mods : []).map((m) =>
        m.status === "loading" || !Array.isArray(m.requiredDeps) || m.requiredDeps.some((d) => !("clientSide" in d))
          ? { ...m, requiredDeps: [], status: "pending", resolvedFor: null }
          : m,
      ),
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function loadState(): BuilderState {
  try {
    return parseSavedState(localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY));
  } catch {
    return DEFAULT_STATE;
  }
}

export function usePersistentState() {
  const [state, setState] = useState<BuilderState>(loadState);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage can be unavailable (private mode); the app still works without it.
    }
  }, [state]);
  return [state, setState] as const;
}

/** Docker Compose project names: lowercase letters, digits, dashes and underscores. */
export function toProjectName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .replace(/-{2,}/g, "-");
}
