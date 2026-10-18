import type { TabId } from "./state";

export interface StepMeta {
  id: TabId;
  label: string;
  title: string;
  lead: string;
}

export const STEPS: StepMeta[] = [
  {
    id: "version",
    label: "Version",
    title: "Pick your world's version",
    lead: "Only versions the Fabric loader supports are listed. Java and every mod follow this choice.",
  },
  {
    id: "mods",
    label: "Mods",
    title: "Fill your inventory",
    lead: "Search Fabric mods on Modrinth. Required dependencies are added and pinned for you.",
  },
  {
    id: "server",
    label: "Server",
    title: "Tune the server",
    lead: "Sensible defaults are already set. Change only what you care about.",
  },
  {
    id: "export",
    label: "Export",
    title: "Craft your server kit",
    lead: "Check the summary, then download one zip with everything the server and your friends need.",
  },
];

/**
 * Server-side performance mods that vanilla players can still join with. C2ME is left out on
 * purpose: it can clash with world generation mods.
 */
export const PERFORMANCE_PACK = ["lithium", "ferrite-core", "krypton"];

/** Modrinth's mod categories, most useful for servers first. Values are Modrinth's tag names. */
export const MOD_CATEGORIES = [
  { value: "optimization", label: "Optimization" },
  { value: "worldgen", label: "World gen" },
  { value: "adventure", label: "Adventure" },
  { value: "technology", label: "Technology" },
  { value: "magic", label: "Magic" },
  { value: "utility", label: "Utility" },
  { value: "decoration", label: "Decoration" },
  { value: "storage", label: "Storage" },
  { value: "mobs", label: "Mobs" },
  { value: "equipment", label: "Equipment" },
  { value: "food", label: "Food" },
  { value: "game-mechanics", label: "Game mechanics" },
  { value: "transportation", label: "Transportation" },
  { value: "management", label: "Management" },
  { value: "social", label: "Social" },
  { value: "economy", label: "Economy" },
  { value: "minigame", label: "Minigames" },
  { value: "library", label: "Libraries" },
  { value: "cursed", label: "Cursed" },
] as const;

export const EULA_URL = "https://aka.ms/MinecraftEULA";
export const MODRINTH_URL = "https://modrinth.com";
export const ITZG_DOCS = "https://docker-minecraft-server.readthedocs.io/";

export const BACKUP_INTERVALS = [
  { value: "6h", label: "Every 6 hours" },
  { value: "12h", label: "Every 12 hours" },
  { value: "24h", label: "Daily" },
];

export const LEGAL_NOTICE =
  "Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft. " +
  "Not affiliated with Modrinth or the itzg/minecraft-server project.";
