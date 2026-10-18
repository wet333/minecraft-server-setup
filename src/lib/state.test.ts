import { describe, expect, it } from "vitest";
import { mod } from "./fixtures";
import { DEFAULT_SERVER, DEFAULT_STATE, parseSavedState, toProjectName } from "./state";

describe("parseSavedState", () => {
  it("falls back to defaults for missing or corrupt data", () => {
    expect(parseSavedState(null)).toEqual(DEFAULT_STATE);
    expect(parseSavedState("{not json")).toEqual(DEFAULT_STATE);
    expect(parseSavedState("42")).toEqual(DEFAULT_STATE);
  });

  it("fills fields added after the state was saved", () => {
    const restored = parseSavedState(JSON.stringify({ mcVersion: "1.20.1", server: { motd: "hi" } }));
    expect(restored.mcVersion).toBe("1.20.1");
    expect(restored.server).toEqual({ ...DEFAULT_SERVER, motd: "hi" });
    expect(restored.loaderVersion).toBe("");
  });

  it("queues interrupted and outdated mod lookups again", () => {
    const loading = mod("a", { status: "loading" });
    const oldDeps = { ...mod("b"), requiredDeps: [{ id: "x", slug: "x", title: "x" }] };
    const fine = mod("c");
    const restored = parseSavedState(JSON.stringify({ mods: [loading, oldDeps, fine] }));
    expect(restored.mods.map((m) => [m.slug, m.status, m.resolvedFor])).toEqual([
      ["a", "pending", null],
      ["b", "pending", null],
      ["c", "ok", "1.21.1"],
    ]);
  });
});

describe("toProjectName", () => {
  it.each([
    ["My Server", "my-server"],
    ["  --Friends SMP!!  ", "friends-smp"],
    ["survival_2024", "survival_2024"],
    ["¡¡¡", ""],
  ])("%j -> %j", (input, expected) => {
    expect(toProjectName(input)).toBe(expected);
  });
});
