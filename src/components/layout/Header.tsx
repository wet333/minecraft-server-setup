import { useRef } from "react";
import { BookOpen, Boxes, Check, FileUp, Hammer, Layers, Link2, MoreVertical, RotateCcw, Settings, SlidersHorizontal } from "lucide-react";
import type { Builder } from "../../hooks/useBuilder";
import { APP_NAME, APP_TAGLINE } from "../../lib/brand";
import { STEPS } from "../../lib/content";
import type { TabId } from "../../lib/state";
import { buttonClass, cx } from "../ui/core";
import { Logo } from "../ui/slot";

const ICONS: Record<TabId, typeof Layers> = { version: Layers, mods: Boxes, server: SlidersHorizontal, export: Hammer };

function stepStatus(b: Builder, id: TabId): string {
  const { state, issues } = b;
  switch (id) {
    case "version":
      return state.mcVersion || "Choose";
    case "mods":
      return state.mods.length === 0 ? "None yet" : `${state.mods.length} mod${state.mods.length === 1 ? "" : "s"}`;
    case "server":
      return `${state.server.memory} GB · :${state.server.port}`;
    case "export": {
      const errors = issues.filter((i) => i.level === "error").length;
      return errors ? `${errors} to fix` : "Ready";
    }
  }
}

export function Hotbar({ builder, compact }: { builder: Builder; compact?: boolean }) {
  const current = STEPS.findIndex((s) => s.id === builder.state.tab);
  return (
    <nav aria-label="Steps" className={compact ? "w-full" : undefined}>
      <ol className={cx("flex", compact ? "grid grid-cols-4 gap-1.5" : "gap-1")}>
        {STEPS.map((step, i) => {
          const Icon = ICONS[step.id];
          const active = i === current;
          const done = i < current;
          const blocked = builder.issues.some((x) => x.tab === step.id && x.level === "error");
          const status = stepStatus(builder, step.id);
          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => builder.actions.goTo(step.id)}
                aria-current={active ? "step" : undefined}
                aria-label={`Step ${i + 1} of ${STEPS.length}: ${step.label}. ${status}${done ? ", done" : ""}`}
                className={cx(
                  "pixel group flex items-center text-left transition",
                  compact ? "w-full flex-col gap-1 px-1 py-1" : "gap-2.5 py-1.5 pr-3 pl-1.5 hover:bg-hover",
                  active && !compact && "bg-hover",
                )}
              >
                <span
                  className={cx(
                    "pixel slot relative flex shrink-0 items-center justify-center",
                    compact ? "h-10 w-10" : "h-11 w-11",
                    active && "outline-2 outline-offset-1 outline-copper-line",
                  )}
                >
                  <Icon aria-hidden className={cx("h-5 w-5", active ? "text-copper-ink" : "text-muted")} />
                  <span aria-hidden className="absolute top-0.5 left-1 font-display text-[11px] leading-none font-semibold text-faint">{i + 1}</span>
                  {(done || blocked) && (
                    <span
                      aria-hidden
                      className={cx(
                        "pixel absolute -right-1.5 -bottom-1.5 flex h-[18px] w-[18px] items-center justify-center text-[11px] font-bold text-sig-glyph ring-2 ring-chrome",
                        blocked ? "bg-sig-redstone" : "bg-sig-emerald",
                      )}
                    >
                      {blocked ? "!" : <Check className="h-3 w-3" strokeWidth={3.5} />}
                    </span>
                  )}
                </span>
                <span className={cx("min-w-0 leading-tight", compact && "text-center")}>
                  <span className={cx("block font-semibold", compact ? "text-[13px]" : "text-sm", active ? "text-ink" : "text-muted")}>
                    {step.label}
                  </span>
                  {!compact && <span className="block max-w-[110px] truncate font-mono text-xs text-faint">{status}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function Header({ builder, onShowGuide, onShare, onImport, onOptions, onReset }: {
  builder: Builder;
  onShowGuide: () => void;
  onShare: () => void;
  onImport: () => void;
  onOptions: () => void;
  onReset: () => void;
}) {
  const menu = useRef<HTMLDivElement>(null);
  const run = (fn: () => void) => () => {
    menu.current?.hidePopover();
    fn();
  };
  return (
    <header className="sticky top-0 z-30 border-b-2 border-line bg-chrome/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1320px] items-center gap-3 px-4 sm:px-6 lg:h-[76px]">
        <a href="#version" onClick={(e) => (e.preventDefault(), builder.actions.goTo("version"))} className="flex shrink-0 items-center gap-2.5">
          <Logo className="h-8 w-8" />
          <span className="leading-none">
            <span className="display-heading block text-[22px] font-semibold">{APP_NAME}</span>
            <span className="mt-1 hidden text-xs text-faint xl:block">{APP_TAGLINE}</span>
          </span>
        </a>

        <div className="mx-auto hidden lg:block">
          <Hotbar builder={builder} />
        </div>

        <div className="ml-auto flex items-center gap-1 lg:ml-0">
          <button type="button" onClick={onShowGuide} className={buttonClass("ghost", "sm")}>
            <BookOpen aria-hidden className="h-4 w-4" />
            <span className="hidden sm:inline">How to run</span>
            <span className="sr-only sm:hidden">How to run</span>
          </button>
          <button type="button" onClick={onShare} className={buttonClass("ghost", "sm")}>
            <Link2 aria-hidden className="h-4 w-4" />
            <span className="hidden sm:inline">Share</span>
            <span className="sr-only sm:hidden">Copy share link</span>
          </button>
          <button type="button" popoverTarget="app-menu" className={buttonClass("ghost", "sm", "w-9 px-0")} aria-label="More options">
            <MoreVertical aria-hidden className="h-5 w-5" />
          </button>
          <div
            ref={menu}
            id="app-menu"
            popover="auto"
            className="pixel fixed inset-auto top-[60px] right-3 m-0 w-64 card p-1.5 text-ink shadow-xl lg:top-[70px]"
          >
            <button type="button" onClick={run(onImport)} className={buttonClass("ghost", "md", "w-full justify-start text-ink")}>
              <FileUp aria-hidden className="h-4 w-4" /> Import compose file…
            </button>
            <button type="button" onClick={run(onOptions)} className={buttonClass("ghost", "md", "w-full justify-start text-ink")}>
              <Settings aria-hidden className="h-4 w-4" /> Display options…
            </button>
            <div className="my-1 border-t-2 border-line" />
            <button type="button" onClick={run(onReset)} className={buttonClass("danger", "md", "w-full justify-start")}>
              <RotateCcw aria-hidden className="h-4 w-4" /> Start over…
            </button>
          </div>
        </div>
      </div>
      <div className="border-t-2 border-line/60 px-3 py-1.5 lg:hidden">
        <Hotbar builder={builder} compact />
      </div>
    </header>
  );
}
