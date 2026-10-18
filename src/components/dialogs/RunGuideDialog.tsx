import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, Circle, PartyPopper } from "lucide-react";
import type { Builder } from "../../hooks/useBuilder";
import { detectOs } from "../../lib/download";
import { EVERYDAY_COMMANDS, PLATFORMS, TROUBLESHOOTING, connectTips, startSteps, type Platform } from "../../lib/guide";
import { FABRIC_INSTALLER_URL, kitNames } from "../../lib/kit";
import { CodeBlock, Dialog, Linkify, cx } from "../ui/core";

function PlatformTabs({ value, onChange }: { value: Platform; onChange: (p: Platform) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (i: number) => {
    const next = (i + PLATFORMS.length) % PLATFORMS.length;
    onChange(PLATFORMS[next].id);
    refs.current[next]?.focus();
  };
  return (
    <div role="tablist" aria-label="Your system" className="pixel slot flex flex-wrap gap-1 p-1">
      {PLATFORMS.map((p, i) => (
        <button
          key={p.id}
          ref={(el) => {
            refs.current[i] = el;
          }}
          id={`tab-${p.id}`}
          role="tab"
          type="button"
          aria-selected={value === p.id}
          aria-controls="platform-panel"
          tabIndex={value === p.id ? 0 : -1}
          onClick={() => onChange(p.id)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") (e.preventDefault(), move(i + 1));
            if (e.key === "ArrowLeft") (e.preventDefault(), move(i - 1));
          }}
          className={cx("pixel h-9 flex-1 px-3 text-sm font-semibold", value === p.id ? "btn-selected" : "text-muted hover:bg-hover hover:text-ink")}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

export function RunGuideDialog({ open, onClose, builder, justExported }: {
  open: boolean;
  onClose: () => void;
  builder: Builder;
  justExported: boolean;
}) {
  const { state, ports, players, vanillaOk } = builder;
  const names = kitNames(state);
  const [platform, setPlatform] = useState<Platform>(() => detectOs());
  const [done, setDone] = useState<Set<string>>(new Set());
  useEffect(() => setDone(new Set()), [platform]);
  const steps = startSteps(platform, {
    zip: names.zip,
    folder: names.folder,
    port: state.server.port,
    storage: state.server.storage,
    memory: state.server.memory,
  });
  const mark = (key: string) => setDone((d) => new Set(d).add(key));
  const toggle = (key: string) =>
    setDone((d) => {
      const next = new Set(d);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={justExported ? "Your kit is ready" : "How to run your server"}
      description={justExported ? `Downloaded ${names.zip}. Here is how to start it.` : `For the kit ${names.zip}.`}
    >
      {justExported && (
        <p className="pixel mb-5 flex items-center gap-2 bg-emerald-soft px-3 py-2 text-sm text-emerald">
          <PartyPopper aria-hidden className="h-4 w-4" /> Crafted. Follow the steps for your system; it takes a few minutes.
        </p>
      )}

      <PlatformTabs value={platform} onChange={setPlatform} />

      <ol id="platform-panel" role="tabpanel" aria-labelledby={`tab-${platform}`} className="mt-5 flex flex-col gap-5">
        {steps.map((step, i) => {
          const key = `${platform}-${i}`;
          const isDone = done.has(key);
          return (
            <li key={key} className="flex gap-3">
              <button
                type="button"
                role="checkbox"
                aria-checked={isDone}
                aria-label={`Mark “${step.title}” as done`}
                onClick={() => toggle(key)}
                className="mt-0.5 h-7 w-7 shrink-0 text-faint hover:text-ink"
              >
                {isDone ? <CheckCircle2 aria-hidden className="h-7 w-7 text-emerald" /> : <Circle aria-hidden className="h-7 w-7" />}
              </button>
              <div className="min-w-0 flex-1">
                <h3 className={cx("font-semibold", isDone && "text-muted line-through decoration-2")}>{i + 1}. {step.title}</h3>
                <p className="mt-0.5 text-sm text-muted"><Linkify text={step.body} /></p>
                {step.caution && (
                  <p className="pixel mt-2 flex items-start gap-2 bg-gold-soft px-3 py-2 text-sm text-gold">
                    <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" /> {step.caution}
                  </p>
                )}
                {step.code && <div className="mt-2"><CodeBlock code={step.code} onCopied={() => mark(key)} /></div>}
              </div>
            </li>
          );
        })}
      </ol>

      <h3 className="mt-8 text-lg font-semibold">Connect</h3>
      <ul className="mt-2 flex flex-col gap-2 text-sm">
        {connectTips(state.server.port, ports.map((p) => p.port)).map((t) => (
          <li key={t.title}><span className="font-semibold">{t.title}:</span> <span className="text-muted">{t.body}</span></li>
        ))}
      </ul>

      <h3 className="mt-8 text-lg font-semibold">Your friends</h3>
      {vanillaOk ? (
        <p className="mt-2 text-sm text-muted">Nothing to install: they join with plain Minecraft {state.mcVersion}.</p>
      ) : (
        <div className="mt-2 text-sm text-muted">
          <p>
            Send them the <span className="font-mono text-ink">{names.playersFolder}/</span> folder from the kit. Each friend:
          </p>
          <ol className="mt-2 list-inside list-decimal space-y-1">
            <li>
              Installs Fabric for Minecraft {state.mcVersion} with the{" "}
              <a href={FABRIC_INSTALLER_URL} target="_blank" rel="noreferrer" className="text-copper-ink underline underline-offset-2">Fabric installer</a>.
            </li>
            <li>
              Copies the {players.length} files from <span className="font-mono text-ink">mods/</span> into their Minecraft{" "}
              <span className="font-mono text-ink">mods</span> folder (<span className="font-mono">%appdata%\.minecraft\mods</span> on Windows).
            </li>
            <li>Starts the game with the Fabric profile and joins your server.</li>
          </ol>
          <p className="mt-2">
            <span className="font-mono text-ink">{names.instructions}</span> in that folder spells this out for macOS, Linux and other launchers.
          </p>
          <details className="mt-2">
            <summary className="cursor-pointer font-semibold text-ink">See the {players.length} mods</summary>
            <ul className="mt-2 grid gap-1 sm:grid-cols-2">
              {players.map((m) => (
                <li key={m.projectId}>
                  <a href={`https://modrinth.com/mod/${m.slug}`} target="_blank" rel="noreferrer" className="text-copper-ink underline underline-offset-2">{m.title}</a>{" "}
                  <span className="font-mono text-xs text-faint">{m.versionNumber}</span>
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}

      <h3 className="mt-8 text-lg font-semibold">Everyday commands</h3>
      <dl className="mt-2 flex flex-col gap-3">
        {EVERYDAY_COMMANDS.map((c) => (
          <div key={c.command}>
            <dt className="text-sm text-muted">{c.what}</dt>
            <dd className="mt-1"><CodeBlock code={c.command} /></dd>
          </div>
        ))}
      </dl>

      <h3 className="mt-8 text-lg font-semibold">If something goes wrong</h3>
      <div className="mt-2 flex flex-col gap-1.5">
        {TROUBLESHOOTING.map((t) => (
          <details key={t.symptom} className="pixel group border-2 border-line px-3 py-2">
            <summary className="flex cursor-pointer list-none items-start gap-2 text-sm font-semibold">
              <ChevronRight aria-hidden className="mt-0.5 h-4 w-4 shrink-0 transition-transform group-open:rotate-90" /> {t.symptom}
            </summary>
            <p className="mt-1.5 pl-6 text-sm text-muted">{t.fix}</p>
          </details>
        ))}
      </div>
    </Dialog>
  );
}
