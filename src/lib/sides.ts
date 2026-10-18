import type { SideSupport } from "./modrinth";
import type { SideOverride } from "./state";

export interface Placement {
  server: boolean;
  players: boolean;
}

/** Where a mod is installed: Modrinth's side data unless the user overrode it. */
export function placement(clientSide: SideSupport, serverSide: SideSupport, override?: SideOverride | null): Placement {
  if (override) return { server: override !== "client", players: override !== "server" };
  return {
    server: serverSide !== "unsupported",
    players: clientSide === "required" || serverSide === "unsupported",
  };
}

export type PlacementKind = "both" | "server" | "players";

export const kindOf = (p: Placement): PlacementKind => (p.server && p.players ? "both" : p.server ? "server" : "players");

export const PLACEMENT_TEXT: Record<PlacementKind, { short: string; long: string }> = {
  both: { short: "Server + players", long: "Installed on the server, and every player needs it too." },
  server: { short: "Server only", long: "Runs on the server; players join with plain Minecraft." },
  players: { short: "Players only", long: "Runs in the players' game; it goes in their mods folder, not on the server." },
};
