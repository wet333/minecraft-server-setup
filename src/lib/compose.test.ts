import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import {
  buildCompose, buildEnvironment, dependencyReasons, javaTagFor, missingDependencies, pinnedProjects, playerMods,
  recommendMemory, vanillaClientsCanJoin,
} from "./compose";
import { dep, mod, state } from "./fixtures";
import { DEFAULT_SERVER } from "./state";

describe("javaTagFor", () => {
  it.each([
    ["1.16.5", "java8"],
    ["1.17.1", "java17"],
    ["1.20.4", "java17"],
    ["1.20.5", "java21"],
    ["1.21", "java21"],
    ["1.21.11", "java21"],
    ["1.21-pre1", "java21"],
    ["24w14a", "java21"],
    ["23w51b", "java17"],
    ["26.2", "java25"],
    ["26.4-snapshot-4", "java25"],
  ])("%s -> %s", (version, tag) => {
    expect(javaTagFor(version)).toBe(tag);
  });
});

describe("buildEnvironment", () => {
  it("emits the core settings and pins the Fabric loader", () => {
    const env = buildEnvironment(state({ eulaAccepted: true, server: { ...DEFAULT_SERVER, timezone: "America/Montevideo" } }));
    expect(env).toMatchObject({
      EULA: "TRUE",
      TYPE: "FABRIC",
      VERSION: "1.21.1",
      FABRIC_LOADER_VERSION: "0.16.10",
      MODE: "survival",
      DIFFICULTY: "normal",
      MEMORY: "4G",
      USE_AIKAR_FLAGS: "true",
      TZ: "America/Montevideo",
    });
  });

  it("only accepts the EULA when the user did", () => {
    expect(buildEnvironment(state()).EULA).toBe("FALSE");
  });

  it("omits settings left at the vanilla default", () => {
    const env = buildEnvironment(state({ server: { ...DEFAULT_SERVER, allowFlight: false, simulationDistance: 10 } }));
    for (const key of ["MAX_PLAYERS", "VIEW_DISTANCE", "SIMULATION_DISTANCE", "ALLOW_FLIGHT", "ONLINE_MODE", "SEED", "LEVEL_TYPE", "OPS", "MODRINTH_PROJECTS"]) {
      expect(env).not.toHaveProperty(key);
    }
  });

  it("applies the modded-server defaults", () => {
    expect(buildEnvironment(state())).toMatchObject({ ALLOW_FLIGHT: "true", SIMULATION_DISTANCE: "8" });
  });

  it("emits changed settings and normalises player lists", () => {
    const env = buildEnvironment(state({
      server: { ...DEFAULT_SERVER, maxPlayers: 8, seed: " 123 ", ops: "Steve,\n Alex ", whitelistEnabled: true, whitelist: "Steve Alex" },
    }));
    expect(env).toMatchObject({
      MAX_PLAYERS: "8", SEED: "123", OPS: "Steve,Alex", ENABLE_WHITELIST: "true", ENFORCE_WHITELIST: "true", WHITELIST: "Steve,Alex",
    });
  });

  it("lets the pinned graph stand without the image re-resolving dependencies", () => {
    const env = buildEnvironment(state({ mods: [mod("lithium")] }));
    expect(env).toMatchObject({ MODRINTH_DOWNLOAD_DEPENDENCIES: "none" });
    // The image prunes old and unlisted Modrinth files itself; wiping the folder re-downloads every jar.
    expect(env).not.toHaveProperty("REMOVE_OLD_MODS");
  });

  it("downloads the icon once instead of on every start", () => {
    const env = buildEnvironment(state({ server: { ...DEFAULT_SERVER, iconUrl: " https://example.com/icon.png " } }));
    expect(env.ICON).toBe("https://example.com/icon.png");
    expect(env).not.toHaveProperty("OVERRIDE_ICON");
  });

  it("skips the pinned loader until it is known", () => {
    expect(buildEnvironment(state({ loaderVersion: "" }))).not.toHaveProperty("FABRIC_LOADER_VERSION");
  });
});

describe("pinnedProjects", () => {
  it("lists server mods and their dependencies once, pinned", () => {
    const s = state({
      mods: [
        mod("waystones", { requiredDeps: [dep("balm"), dep("fabric-api")] }),
        mod("lithium", { requiredDeps: [dep("fabric-api")] }),
      ],
    });
    expect(pinnedProjects(s).map((p) => `${p.slug}:${p.versionId}`)).toEqual([
      "waystones:waystones-v", "lithium:lithium-v", "balm:balm-v", "fabric-api:fabric-api-v",
    ]);
    expect(buildEnvironment(s).MODRINTH_PROJECTS).toBe("waystones:waystones-v, lithium:lithium-v, balm:balm-v, fabric-api:fabric-api-v");
  });

  it("keeps client-only and unresolved mods off the server", () => {
    const s = state({
      mods: [
        mod("sodium", { serverSide: "unsupported", clientSide: "required" }),
        mod("old-mod", { status: "incompatible", versionId: null }),
        mod("lithium"),
      ],
    });
    expect(pinnedProjects(s).map((p) => p.slug)).toEqual(["lithium"]);
  });

  it("prefers the user's own pick over the same project as a dependency", () => {
    const s = state({ mods: [mod("voxy-worldgen", { requiredDeps: [dep("voxy")] }), mod("voxy", { versionId: "mine" })] });
    expect(pinnedProjects(s).find((p) => p.slug === "voxy")?.versionId).toBe("mine");
  });
});

describe("playerMods", () => {
  it("includes client-required mods, client-only picks and what they depend on", () => {
    const s = state({
      mods: [
        mod("voxy-worldgen", { clientSide: "required", requiredDeps: [dep("voxy"), dep("sodium")] }),
        mod("xaeros-minimap", { serverSide: "unsupported", clientSide: "required" }),
        mod("lithium", { requiredDeps: [dep("fabric-api")] }),
        mod("waystones", { requiredDeps: [dep("balm", { clientSide: "required" })] }),
      ],
    });
    expect(playerMods(s).map((p) => p.slug)).toEqual(["voxy-worldgen", "xaeros-minimap", "voxy", "sodium", "balm"]);
  });
});

describe("side overrides", () => {
  it("moves a mod between the server and the players' list when the metadata is wrong", () => {
    const s = state({
      mods: [
        mod("wrongly-client-only", { serverSide: "unsupported", clientSide: "required", sideOverride: "both" }),
        mod("server-tweak", { clientSide: "required", sideOverride: "server" }),
        mod("hud", { serverSide: "optional", clientSide: "optional", sideOverride: "client" }),
      ],
    });
    expect(pinnedProjects(s).map((p) => p.slug)).toEqual(["wrongly-client-only", "server-tweak"]);
    expect(playerMods(s).map((p) => p.slug)).toEqual(["wrongly-client-only", "hud"]);
  });

  it("reports when plain clients can join", () => {
    expect(vanillaClientsCanJoin(state({ mods: [mod("lithium")] }))).toBe(true);
    expect(vanillaClientsCanJoin(state({ mods: [mod("waystones", { clientSide: "required" })] }))).toBe(false);
  });
});

describe("dependencyReasons", () => {
  it("names every mod that pulled in a dependency", () => {
    const s = state({ mods: [mod("a", { requiredDeps: [dep("fabric-api")] }), mod("b", { requiredDeps: [dep("fabric-api")] })] });
    expect(dependencyReasons(s).get("fabric-api")).toEqual(["a", "b"]);
  });
});

describe("recommendMemory", () => {
  it.each([
    [0, 10, 2],
    [12, 10, 4],
    [29, 12, 7],
    [100, 40, 11],
    [500, 500, 16],
  ])("%i mods, %i players -> %i GB", (mods, players, gb) => {
    expect(recommendMemory(mods, players).gb).toBe(gb);
  });
});

describe("missingDependencies", () => {
  it("reports required dependencies without a build", () => {
    const s = state({ mods: [mod("voxy-worldgen", { requiredDeps: [dep("voxy", { versionId: null, title: "Voxy" })] })] });
    expect(missingDependencies(s)).toEqual([{ mod: "voxy-worldgen", dep: "Voxy" }]);
  });
});

describe("buildCompose", () => {
  it("produces valid YAML where every environment value is a string", () => {
    const s = state({ serverName: "Friends SMP!", mods: [mod("simple-voice-chat")] });
    const yaml = buildCompose(s);
    const doc = parse(yaml);
    expect(doc.name).toBe("friends-smp");
    const svc = doc.services.mc;
    expect(svc.image).toBe("itzg/minecraft-server:java21");
    expect(svc.stop_grace_period).toBe("2m");
    expect(svc.ports).toEqual(["25565:25565/tcp", "24454:24454/udp"]);
    expect(svc.volumes).toEqual(["./data:/data"]);
    for (const value of Object.values(svc.environment)) expect(typeof value).toBe("string");
  });

  it("opens the ports that selected mods need", () => {
    const doc = parse(buildCompose(state({ mods: [mod("bluemap"), mod("simple-voice-chat")] })));
    expect(doc.services.mc.ports).toEqual(["25565:25565/tcp", "8100:8100/tcp", "24454:24454/udp"]);
  });

  it("uses a named volume when asked", () => {
    const doc = parse(buildCompose(state({ server: { ...DEFAULT_SERVER, storage: "volume" } })));
    expect(doc.services.mc.volumes).toEqual(["mc-data:/data"]);
    expect(doc.volumes).toEqual({ "mc-data": {} });
  });

  it("adds a backup service that shares the console password", () => {
    const doc = parse(buildCompose(state({ rconPassword: "s3cret", server: { ...DEFAULT_SERVER, backups: true, backupInterval: "12h", backupKeepDays: 3 } })));
    expect(doc.services.mc.environment.RCON_PASSWORD).toBe("s3cret");
    expect(doc.services.backups).toMatchObject({
      image: "itzg/mc-backup",
      depends_on: { mc: { condition: "service_healthy" } },
      environment: { RCON_HOST: "mc", RCON_PASSWORD: "s3cret", BACKUP_INTERVAL: "12h", PRUNE_BACKUPS_DAYS: "3" },
      volumes: ["./data:/data:ro", "./backups:/backups"],
    });
    expect(doc.services.mc.ports).not.toContain("25575:25575");
  });

  it("maps a custom host port to the container's game port", () => {
    const doc = parse(buildCompose(state({ server: { ...DEFAULT_SERVER, port: 25570 } })));
    expect(doc.services.mc.ports).toEqual(["25570:25565/tcp"]);
  });

  it("quotes values that YAML would otherwise reinterpret", () => {
    const doc = parse(buildCompose(state({ server: { ...DEFAULT_SERVER, motd: "yes: #1 server", seed: "0123" } })));
    expect(doc.services.mc.environment.MOTD).toBe("yes: #1 server");
    expect(doc.services.mc.environment.SEED).toBe("0123");
  });
});
