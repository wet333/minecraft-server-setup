import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, FileUp, Loader2, RefreshCw, Search, Sparkles } from "lucide-react";
import type { Builder } from "../../hooks/useBuilder";
import { STEPS } from "../../lib/content";
import type { GameVersion } from "../../lib/modrinth";
import type { SelectedMod } from "../../lib/state";
import { Button, Dialog, TextInput, Toggle, buttonClass, cx } from "../ui/core";

// The first step shown after page load keeps the browser's natural focus; later steps take it.
let firstStepShown = false;

export function StepHeader({ id }: { id: string }) {
  const index = STEPS.findIndex((s) => s.id === id);
  const step = STEPS[index];
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (firstStepShown) heading.current?.focus({ preventScroll: true });
    firstStepShown = true;
  }, [id]);
  return (
    <div className="mb-6">
      <p className="font-mono text-xs tracking-wider text-faint uppercase">Step {index + 1} of {STEPS.length}</p>
      <h1 ref={heading} tabIndex={-1} className="display-heading mt-1 text-[clamp(28px,4vw,40px)] leading-[1.1] font-semibold focus:outline-none">{step.title}</h1>
      <p className="mt-2 max-w-2xl text-muted">{step.lead}</p>
    </div>
  );
}

/** "1.21.4" -> "1.21.x", "26.3" -> "26.x"; snapshots in their own group. */
function groupKey(v: GameVersion) {
  if (!v.stable) return "Snapshots and pre-releases";
  const [major, minor] = v.version.split(".");
  return major === "1" ? `1.${minor}.x` : `${major}.x`;
}

export function VersionStep({ builder, onImport }: { builder: Builder; onImport: () => void }) {
  const { state, versions, versionsError, compatibility, actions } = builder;
  const [filter, setFilter] = useState("");
  const [pending, setPending] = useState<{ version: string; affected: SelectedMod[] } | null>(null);
  const latest = versions?.find((v) => v.stable)?.version;
  const showCounts = compatibility.total > 0;

  const groups = useMemo(() => {
    const map = new Map<string, GameVersion[]>();
    for (const v of versions ?? []) {
      if (!v.stable && !state.showSnapshots) continue;
      if (filter.trim() && !v.version.includes(filter.trim())) continue;
      map.set(groupKey(v), [...(map.get(groupKey(v)) ?? []), v]);
    }
    return [...map.entries()];
  }, [versions, state.showSnapshots, filter]);

  // Highest stable version that every picked mod supports.
  const best = useMemo(() => {
    if (!compatibility.ready) return null;
    return versions?.find((v) => v.stable && compatibility.count(v.version) === compatibility.total)?.version ?? null;
  }, [versions, compatibility]);

  const suggested = showCounts ? best : latest;

  const choose = (version: string) => {
    if (version === state.mcVersion) return;
    const affected = compatibility.unsupported(version);
    if (affected.length) setPending({ version, affected });
    else actions.setVersion(version);
  };

  return (
    <div>
      <StepHeader id="version" />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="pixel flex flex-col gap-2 card p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-muted">
            <Sparkles aria-hidden className="h-4 w-4 text-copper-ink" />
            {showCounts ? "Best match for your mods" : "Recommended"}
          </p>
          {showCounts && !compatibility.ready ? (
            <p className="flex items-center gap-2 text-muted"><Loader2 aria-hidden className="h-4 w-4 animate-spin" /> Checking your mods…</p>
          ) : (
            <>
              <p className="display-heading text-3xl font-semibold text-ink">{suggested ?? "—"}</p>
              <p className="text-sm text-muted">
                {showCounts
                  ? best
                    ? `All ${compatibility.total} of your mods have a build for it.`
                    : "No single version fits every mod. Pick the one with the most, then swap the others."
                  : "The newest stable release. Brand-new versions can have fewer mods; you can change this any time."}
              </p>
              {suggested && suggested !== state.mcVersion && (
                <Button size="sm" className="mt-1 self-start" onClick={() => choose(suggested)}>
                  Use {suggested}
                </Button>
              )}
              {suggested === state.mcVersion && (
                <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald"><Check aria-hidden className="h-4 w-4" /> Selected</p>
              )}
            </>
          )}
        </div>
        <div className="pixel flex flex-col gap-2 border-2 border-dashed border-line p-4">
          <p className="text-sm font-semibold text-muted">Already running a server?</p>
          <p className="text-sm text-muted">Import its docker-compose.yml to update mods or settings without starting from scratch.</p>
          <button type="button" onClick={onImport} className={buttonClass("secondary", "sm", "mt-1 self-start")}>
            <FileUp aria-hidden className="h-4 w-4" /> Import compose file
          </button>
        </div>
      </div>

      <section aria-labelledby="all-versions" className="pixel mt-6 card p-4 sm:p-5">
        <div className="flex flex-col gap-3">
          <h2 id="all-versions" className="text-lg font-semibold">All versions</h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
            <div className="relative sm:w-56">
              <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-faint" />
              <label htmlFor="version-filter" className="sr-only">Filter versions</label>
              <TextInput id="version-filter" placeholder="Filter, e.g. 1.21" value={filter} onChange={(e) => setFilter(e.target.value)} className="pl-9" />
            </div>
            <div className="sm:w-52">
              <Toggle id="snapshots" label="Show snapshots" checked={state.showSnapshots} onChange={actions.setShowSnapshots} />
            </div>
          </div>
        </div>
        {showCounts && compatibility.ready && (
          <p className="mt-3 text-sm text-muted">
            The number on each version is how many of your {compatibility.total} mods support it.
          </p>
        )}

        <div className="mt-4 flex flex-col gap-5">
          {versionsError && (
            <div role="alert" className="pixel flex flex-wrap items-center gap-3 bg-redstone-soft p-3 text-sm text-redstone">
              <AlertTriangle aria-hidden className="h-4 w-4" /> Could not load versions from Fabric ({versionsError}).
              <Button size="sm" onClick={actions.retryVersions}><RefreshCw aria-hidden className="h-4 w-4" /> Try again</Button>
            </div>
          )}
          {!versions && !versionsError && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-2" aria-busy="true" aria-label="Loading versions">
              {Array.from({ length: 12 }, (_, i) => <div key={i} className="pixel skeleton h-11" />)}
            </div>
          )}
          {versions && groups.length === 0 && <p className="text-muted">No versions match “{filter}”.</p>}
          {groups.map(([group, items]) => (
            <div key={group} role="radiogroup" aria-label={group}>
              <h3 className="mb-2 font-mono text-xs tracking-wider text-faint uppercase">{group}</h3>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(118px,1fr))] gap-2">
                {items.map((v) => {
                  const selected = v.version === state.mcVersion;
                  const count = showCounts && compatibility.ready ? compatibility.count(v.version) : null;
                  const full = count === compatibility.total;
                  return (
                    <button
                      key={v.version}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={`${v.version}${v.version === latest ? ", latest release" : ""}${count !== null ? `, ${count} of ${compatibility.total} mods` : ""}`}
                      onClick={() => choose(v.version)}
                      className={cx(
                        "pixel flex h-11 items-center justify-between gap-1 px-2.5 font-mono text-[15px] transition",
                        selected ? "btn-selected" : "btn-secondary",
                      )}
                    >
                      <span>{v.version}</span>
                      {count !== null ? (
                        <span className={cx("text-[11px] font-bold", selected ? "" : full ? "text-emerald" : count === 0 ? "text-redstone" : "text-gold")}>
                          {count}/{compatibility.total}
                        </span>
                      ) : (
                        v.version === latest && <span className={cx("text-[10px] font-bold uppercase", selected ? "" : "text-copper-ink")}>new</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <Dialog
        open={!!pending}
        onClose={() => setPending(null)}
        title={`Switch to ${pending?.version}?`}
        description={`${pending?.affected.length} of your mods have no build for this version.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPending(null)}>Cancel</Button>
            <Button onClick={() => (actions.setVersion(pending!.version), setPending(null))}>Keep them, left out</Button>
            <Button
              variant="primary"
              onClick={() => (actions.setVersion(pending!.version, pending!.affected.map((m) => m.projectId)), setPending(null))}
            >
              Remove them
            </Button>
          </>
        }
      >
        <ul className="flex flex-col gap-1.5">
          {pending?.affected.map((m) => <li key={m.projectId} className="font-semibold">{m.title}</li>)}
        </ul>
        <p className="mt-4 text-sm text-muted">
          Kept mods stay in your inventory but are not installed until you pick a version they support. Back up your world before
          changing the version of an existing server.
        </p>
      </Dialog>
    </div>
  );
}
