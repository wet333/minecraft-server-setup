import { deflateSync, inflateSync, strFromU8, strToU8 } from "fflate";
import { DEFAULT_SERVER, type BuilderState, type SelectedMod } from "./state";

// A shared setup carries only what cannot be looked up again; mod versions re-resolve on open.
interface SharedSetup {
  v: 1;
  mc: string;
  name: string;
  server: Partial<BuilderState["server"]>;
  mods: Pick<SelectedMod, "projectId" | "slug" | "title" | "iconUrl" | "clientSide" | "serverSide">[];
}

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const fromBase64Url = (text: string) => {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0));
};

/** Only settings that differ from the defaults, to keep links short. */
function changedSettings(server: BuilderState["server"]) {
  return Object.fromEntries(
    Object.entries(server).filter(([key, value]) => DEFAULT_SERVER[key as keyof typeof DEFAULT_SERVER] !== value),
  ) as Partial<BuilderState["server"]>;
}

export function encodeShare(state: BuilderState): string {
  const setup: SharedSetup = {
    v: 1,
    mc: state.mcVersion,
    name: state.serverName,
    server: changedSettings(state.server),
    mods: state.mods.map(({ projectId, slug, title, iconUrl, clientSide, serverSide }) => ({
      projectId, slug, title, iconUrl, clientSide, serverSide,
    })),
  };
  return toBase64Url(deflateSync(strToU8(JSON.stringify(setup)), { level: 9 }));
}

/** Returns the state patch for a shared setup, or null when the link is damaged. */
export function decodeShare(code: string): Partial<BuilderState> | null {
  try {
    const setup = JSON.parse(strFromU8(inflateSync(fromBase64Url(code)))) as SharedSetup;
    if (setup.v !== 1 || typeof setup.mc !== "string" || !Array.isArray(setup.mods)) return null;
    return {
      mcVersion: setup.mc,
      serverName: String(setup.name ?? ""),
      server: { ...DEFAULT_SERVER, ...setup.server },
      mods: setup.mods.map((m) => ({
        ...m,
        description: "",
        status: "pending",
        resolvedFor: null,
        versionId: null,
        versionNumber: null,
        versionType: null,
        requiredDeps: [],
      })),
    };
  } catch {
    return null;
  }
}

const HASH_KEY = "#setup=";

export function shareUrl(state: BuilderState, base = `${location.origin}${location.pathname}`): string {
  return `${base}${HASH_KEY}${encodeShare(state)}`;
}

export function readSharedHash(hash: string): Partial<BuilderState> | null {
  return hash.startsWith(HASH_KEY) ? decodeShare(hash.slice(HASH_KEY.length)) : null;
}
