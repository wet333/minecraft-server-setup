// Test fixtures shared by the unit tests.
import type { ResolvedDependency } from "./modrinth";
import { DEFAULT_STATE, type BuilderState, type SelectedMod } from "./state";

export function dep(id: string, overrides: Partial<ResolvedDependency> = {}): ResolvedDependency {
  return {
    id,
    slug: id,
    title: id,
    clientSide: "optional",
    serverSide: "optional",
    versionId: `${id}-v`,
    versionNumber: "1.0.0",
    versionType: "release",
    ...overrides,
  };
}

export function mod(slug: string, overrides: Partial<SelectedMod> = {}): SelectedMod {
  return {
    projectId: slug,
    slug,
    title: slug,
    description: "",
    iconUrl: null,
    clientSide: "optional",
    serverSide: "required",
    status: "ok",
    resolvedFor: "1.21.1",
    versionId: `${slug}-v`,
    versionNumber: "1.0.0",
    versionType: "release",
    requiredDeps: [],
    ...overrides,
  };
}

export function state(overrides: Partial<BuilderState> = {}): BuilderState {
  return { ...DEFAULT_STATE, mcVersion: "1.21.1", loaderVersion: "0.16.10", ...overrides };
}
