import { afterEach, describe, expect, it, vi } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { dep, mod, state } from "./fixtures";
import { buildPlayerInstructions, buildPlayerModsZip, buildReadme, buildServerKit } from "./kit";
import { clearApiCache } from "./modrinth";

afterEach(() => {
  vi.unstubAllGlobals();
  clearApiCache();
});

const jarBytes = (id: string) => new TextEncoder().encode(`fake jar for ${id}`);
const sha1 = async (data: Uint8Array) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-1", data as BufferSource)), (b) => b.toString(16).padStart(2, "0")).join("");

/** Serves the Modrinth /versions lookup and the CDN jars; `tamper` breaks one file's checksum. */
function stubModrinth(opts: { tamper?: string; host?: string } = {}) {
  const fetchMock = vi.fn(async (input: string) => {
    const url = new URL(input);
    if (url.hostname === "api.modrinth.com") {
      const ids = JSON.parse(url.searchParams.get("ids")!) as string[];
      const hashes = await Promise.all(ids.map((id) => sha1(jarBytes(id))));
      return new Response(JSON.stringify(ids.map((id, i) => ({
        id,
        version_number: "1",
        version_type: "release",
        dependencies: [],
        files: [{
          url: `https://${opts.host ?? "cdn.modrinth.com"}/data/${id}.jar`,
          filename: `${id}.jar`,
          primary: true,
          size: 10,
          hashes: { sha1: hashes[i], sha512: "unused" },
        }],
      }))));
    }
    const id = url.pathname.split("/").pop()!.replace(".jar", "");
    return new Response(id === opts.tamper ? new TextEncoder().encode("corrupted") : jarBytes(id));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const unzip = async (blob: Blob) => unzipSync(new Uint8Array(await blob.arrayBuffer()));

const friends = () =>
  state({
    serverName: "Friends SMP",
    mods: [mod("xaeros-minimap", { clientSide: "required", requiredDeps: [dep("fabric-api")] }), mod("lithium")],
  });

describe("buildServerKit", () => {
  it("packs the server folder plus a players folder with the jars to paste into Minecraft", async () => {
    stubModrinth();
    const progress: string[] = [];
    const files = await unzip(await buildServerKit(friends(), (p) => progress.push(`${p.done}/${p.total}`)));
    expect(Object.keys(files).sort()).toEqual([
      "friends-smp/README.md",
      "friends-smp/docker-compose.yml",
      "friends-smp/players/HOW-TO-INSTALL.txt",
      "friends-smp/players/mods/fabric-api-v.jar",
      "friends-smp/players/mods/xaeros-minimap-v.jar",
    ]);
    expect(strFromU8(files["friends-smp/players/mods/fabric-api-v.jar"])).toBe("fake jar for fabric-api-v");
    expect(progress).toEqual(["0/2", "1/2", "2/2"]);
  });

  it("leaves the players folder out when plain Minecraft can join", async () => {
    const files = await unzip(await buildServerKit(state({ mods: [mod("lithium")] })));
    expect(Object.keys(files).some((f) => f.includes("/players/"))).toBe(false);
  });

  it("refuses a jar whose checksum does not match", async () => {
    stubModrinth({ tamper: "fabric-api-v" });
    await expect(buildServerKit(friends())).rejects.toThrow(/checksum/);
  });

  it("refuses jars that are not on Modrinth's CDN", async () => {
    stubModrinth({ host: "evil.example.com" });
    await expect(buildServerKit(friends())).rejects.toThrow(/CDN/);
  });
});

describe("buildPlayerModsZip", () => {
  it("is just the mods folder and the install steps, ready to send", async () => {
    stubModrinth();
    const files = await unzip((await buildPlayerModsZip(friends()))!);
    expect(Object.keys(files).sort()).toEqual(["HOW-TO-INSTALL.txt", "mods/fabric-api-v.jar", "mods/xaeros-minimap-v.jar"]);
  });

  it("returns nothing when players need no mods", async () => {
    expect(await buildPlayerModsZip(state({ mods: [mod("lithium")] }))).toBeNull();
  });
});

describe("buildPlayerInstructions", () => {
  it("names the Fabric version, the folder on each system and every mod", () => {
    const text = buildPlayerInstructions(friends());
    expect(text).toContain("Minecraft 1.21.1 and loader 0.16.10");
    expect(text).toContain("%appdata%\\.minecraft");
    expect(text).toContain("~/Library/Application Support/minecraft");
    expect(text).toContain("- xaeros-minimap 1.0.0  (https://modrinth.com/mod/xaeros-minimap)");
    expect(text).toContain("- fabric-api 1.0.0");
  });
});

describe("buildReadme", () => {
  it("points players to their folder and names the port to forward", () => {
    const readme = buildReadme(state({ mods: [mod("waystones", { clientSide: "required" })] }));
    expect(readme).toContain("[waystones](https://modrinth.com/mod/waystones)");
    expect(readme).toContain("`players/` folder");
    expect(readme).toContain("Forward 25565/tcp");
    expect(readme).toContain("### Windows");
  });

  it("sizes Docker Desktop's memory from the server's memory setting", () => {
    const readme = buildReadme(state({ server: { ...state().server, memory: 8 } }));
    expect(readme).toContain("set Memory to at least 10 GB");
    expect(readme).toContain("Use Docker Engine, not Docker Desktop");
  });
});
