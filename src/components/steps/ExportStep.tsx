import { useEffect, useRef, useState } from "react";
import { AlertTriangle, BookOpen, FileArchive, FileCode2, Link2, Loader2, Package, XCircle } from "lucide-react";
import type { Builder, Issue } from "../../hooks/useBuilder";
import { prefersReducedMotion } from "../../hooks/useOptions";
import { EULA_URL, STEPS } from "../../lib/content";
import { kitNames } from "../../lib/kit";
import type { TabId } from "../../lib/state";
import { Button, buttonClass, cx } from "../ui/core";
import { Slot } from "../ui/slot";
import { StepHeader } from "./VersionStep";

const CRAFTED_KEY = "composter:crafted";

/** A download in progress, with the text its button shows (e.g. "Downloading mods 3/12…"). */
export type Busy = { kind: "kit" | "players"; label: string } | null;

function IssueList({ issues, onFix }: { issues: Issue[]; onFix: (tab: TabId, field?: string) => void }) {
  return (
    <ul className="mt-2 flex flex-col gap-1.5">
      {issues.map((i) => (
        <li key={i.message} className="flex flex-wrap items-baseline gap-x-2">
          <span>{i.message}</span>
          <button type="button" className={buttonClass("link", "sm")} onClick={() => onFix(i.tab, i.field)}>
            Fix in {STEPS.find((x) => x.id === i.tab)?.label}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function ExportStep({ builder, busy, onDownloadKit, onDownloadCompose, onDownloadPlayerMods, onShare, onShowGuide }: {
  builder: Builder;
  busy: Busy;
  onDownloadKit: () => void;
  onDownloadCompose: () => void;
  onDownloadPlayerMods: () => void;
  onShare: () => void;
  onShowGuide: () => void;
}) {
  const { state, actions, issues, players, serverProjects, serverModCount, vanillaOk, ports } = builder;
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");
  const summaryRef = useRef<HTMLDivElement>(null);
  const eulaRef = useRef<HTMLInputElement>(null);
  const [eulaError, setEulaError] = useState(false);
  const [craft] = useState(() => {
    try {
      if (sessionStorage.getItem(CRAFTED_KEY) || prefersReducedMotion()) return false;
      sessionStorage.setItem(CRAFTED_KEY, "1");
      return true;
    } catch {
      return false;
    }
  });
  const names = kitNames(state);

  // GOV.UK pattern: when there is something to fix, the summary takes focus so it is read first.
  useEffect(() => {
    if (errors.length) summaryRef.current?.focus();
    // Only on arrival at this step, not on every edit.
  }, []);

  const fix = (tab: TabId, field?: string) => {
    actions.goTo(tab);
    if (field) setTimeout(() => document.getElementById(field)?.focus(), 50);
  };

  const download = () => {
    if (errors.length) {
      summaryRef.current?.focus();
      return;
    }
    if (!state.eulaAccepted) {
      setEulaError(true);
      eulaRef.current?.focus();
      return;
    }
    onDownloadKit();
  };

  const rows: { label: string; value: string; tab: TabId }[] = [
    { label: "Minecraft", value: `${state.mcVersion || "—"} · Fabric loader ${state.loaderVersion || "latest"}`, tab: "version" },
    {
      label: "Server mods",
      value: serverProjects.length
        ? `${serverProjects.length} (${serverModCount} picked + ${serverProjects.length - serverModCount} libraries)`
        : "None: a plain Fabric server",
      tab: "mods",
    },
    { label: "Players need", value: vanillaOk ? "Nothing: plain Minecraft works" : `${players.length} mods, in a folder they copy into Minecraft`, tab: "mods" },
    { label: "Memory", value: `${state.server.memory} GB`, tab: "server" },
    { label: "Port", value: [`${state.server.port}/tcp`, ...ports.map((p) => p.port.split(":")[1])].join(", "), tab: "server" },
    { label: "Who can join", value: state.server.whitelistEnabled ? "Only listed players" : "Anyone with the address", tab: "server" },
    {
      label: "Storage",
      value: `${state.server.storage === "folder" ? "data folder" : "Docker volume"}${state.server.backups ? `, backups ${state.server.backupInterval}` : ", no automatic backups"}`,
      tab: "server",
    },
  ];

  return (
    <div>
      <StepHeader id="export" />

      {errors.length > 0 && (
        <div ref={summaryRef} tabIndex={-1} role="alert" aria-labelledby="problem-title" className="pixel mb-5 border-2 border-redstone bg-redstone-soft p-4 text-ink">
          <h2 id="problem-title" className="flex items-center gap-2 font-semibold text-redstone">
            <XCircle aria-hidden className="h-5 w-5" /> {errors.length === 1 ? "There is a problem" : `There are ${errors.length} problems`}
          </h2>
          <IssueList issues={errors} onFix={fix} />
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section aria-labelledby="review-title" className="pixel card p-4 sm:p-6">
          <h2 id="review-title" className="text-lg font-semibold">Check your setup</h2>
          <dl className="mt-3 divide-y-2 divide-line">
            {rows.map((r) => (
              <div key={r.label} className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 py-2.5">
                <dt className="w-full shrink-0 text-sm text-muted sm:w-32">{r.label}</dt>
                <dd className="min-w-0 flex-1 font-semibold">{r.value}</dd>
                <dd>
                  <button type="button" className={buttonClass("link", "sm", "text-sm")} onClick={() => actions.goTo(r.tab)}>
                    Change<span className="sr-only"> {r.label.toLowerCase()}</span>
                  </button>
                </dd>
              </div>
            ))}
          </dl>
          {warnings.length > 0 && (
            <div className="pixel mt-4 bg-gold-soft p-3 text-sm">
              <p className="flex items-center gap-2 font-semibold text-gold"><AlertTriangle aria-hidden className="h-4 w-4" /> Worth a look</p>
              <IssueList issues={warnings} onFix={fix} />
            </div>
          )}
        </section>

        <section aria-labelledby="kit-title" className="pixel flex flex-col card p-4 sm:p-6">
          <h2 id="kit-title" className="text-lg font-semibold">Your server kit</h2>
          <div className="mt-4 flex items-center gap-4">
            <Slot size="lg" className="h-16 w-16" aria-hidden>
              <FileArchive className={cx("h-8 w-8 text-copper-ink", craft && "anim-crafted")} />
            </Slot>
            <div className="min-w-0">
              <p className="truncate font-mono text-sm font-semibold">{names.zip}</p>
              <ul className="mt-1 text-sm text-muted">
                <li className="flex items-center gap-1.5"><FileCode2 aria-hidden className="h-3.5 w-3.5" /> docker-compose.yml, ready to run</li>
                <li className="flex items-center gap-1.5"><BookOpen aria-hidden className="h-3.5 w-3.5" /> README with steps for every system</li>
                {!vanillaOk && (
                  <li className="flex items-center gap-1.5">
                    <Package aria-hidden className="h-3.5 w-3.5" /> {names.playersFolder}/ with the {players.length} mods your friends paste into Minecraft
                  </li>
                )}
              </ul>
            </div>
          </div>

          <div className={cx("pixel mt-5 border-2 p-3", eulaError && !state.eulaAccepted ? "border-redstone bg-redstone-soft" : "border-line")}>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                ref={eulaRef}
                type="checkbox"
                checked={state.eulaAccepted}
                onChange={(e) => {
                  actions.setEula(e.target.checked);
                  if (e.target.checked) setEulaError(false);
                }}
                aria-invalid={eulaError && !state.eulaAccepted}
                aria-describedby="eula-help"
                className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-[var(--copper)]"
              />
              <span>
                <span className="font-semibold">I accept the Minecraft End User License Agreement</span>
                <span id="eula-help" className="block text-sm text-muted">
                  Every Minecraft server must agree to it.{" "}
                  <a href={EULA_URL} target="_blank" rel="noreferrer" className="text-copper-ink underline underline-offset-2">Read the EULA</a>
                  {eulaError && !state.eulaAccepted && <span className="mt-1 block font-semibold text-redstone">Accept the EULA to download the kit.</span>}
                </span>
              </span>
            </label>
          </div>

          <Button variant="primary" size="lg" className="mt-4 w-full" onClick={download} disabled={!!busy}>
            {busy?.kind === "kit" ? <Loader2 aria-hidden className="h-5 w-5 animate-spin" /> : <FileArchive aria-hidden className="h-5 w-5" />}
            <span aria-live="polite">{busy?.kind === "kit" ? busy.label : "Download server kit"}</span>
          </Button>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Button size="sm" onClick={onDownloadCompose} disabled={errors.length > 0}>
              <FileCode2 aria-hidden className="h-4 w-4" /> Only the compose file
            </Button>
            {!vanillaOk && (
              <Button size="sm" onClick={onDownloadPlayerMods} disabled={errors.length > 0 || !!busy}>
                {busy?.kind === "players" ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <Package aria-hidden className="h-4 w-4" />}
                <span aria-live="polite">{busy?.kind === "players" ? busy.label : "Only the players' mods"}</span>
              </Button>
            )}
            <Button size="sm" onClick={onShare}>
              <Link2 aria-hidden className="h-4 w-4" /> Copy share link
            </Button>
            <Button size="sm" onClick={onShowGuide}>
              <BookOpen aria-hidden className="h-4 w-4" /> How to run it
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
