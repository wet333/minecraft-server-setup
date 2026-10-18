import { describe, expect, it } from "vitest";
import { mod, state } from "./fixtures";
import { decodeShare, encodeShare, readSharedHash, shareUrl } from "./share";
import { DEFAULT_SERVER } from "./state";

describe("share links", () => {
  const s = state({
    serverName: "Friends SMP",
    server: { ...DEFAULT_SERVER, difficulty: "hard", motd: "Hola ñandú 🎮" },
    mods: [mod("lithium"), mod("waystones", { clientSide: "required" })],
  });

  it("round-trips the version, name, settings and mod picks", () => {
    const patch = decodeShare(encodeShare(s))!;
    expect(patch.mcVersion).toBe("1.21.1");
    expect(patch.serverName).toBe("Friends SMP");
    expect(patch.server).toEqual({ ...DEFAULT_SERVER, difficulty: "hard", motd: "Hola ñandú 🎮" });
    expect(patch.mods!.map((m) => [m.slug, m.clientSide, m.status, m.versionId])).toEqual([
      ["lithium", "optional", "pending", null],
      ["waystones", "required", "pending", null],
    ]);
  });

  it("keeps links short enough to paste in chat", () => {
    const many = state({ mods: Array.from({ length: 30 }, (_, i) => mod(`some-mod-number-${i}`)) });
    expect(shareUrl(many, "https://x.dev/").length).toBeLessThan(2000);
  });

  it("rejects damaged links", () => {
    expect(decodeShare("not-a-real-code")).toBeNull();
    expect(readSharedHash("#other=1")).toBeNull();
    expect(readSharedHash(`#setup=${encodeShare(s)}`)?.serverName).toBe("Friends SMP");
  });
});
