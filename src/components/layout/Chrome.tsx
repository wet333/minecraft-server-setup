import { ArrowLeft, ArrowRight, Boxes, FileCode2, UserCheck, Users } from "lucide-react";
import type { Builder } from "../../hooks/useBuilder";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { APP_NAME, CONTACT_EMAIL, ISSUES_URL, REPO_URL } from "../../lib/brand";
import { LEGAL_NOTICE, MODRINTH_URL, STEPS } from "../../lib/content";
import { buttonClass, cx, useClearPreviewOn } from "../ui/core";
import { ModIcon, Slot } from "../ui/slot";
import { modStatusText, slotBadge, type PanelTab } from "./InventoryPanel";

export function Footer() {
  return (
    // Bottom padding keeps the footer clear of the dock.
    <footer className="mt-16 border-t-2 border-line pb-28">
      <div className="mx-auto flex max-w-[1320px] flex-col gap-3 px-4 pt-6 text-sm text-faint sm:px-6">
        <p className="text-muted">
          {APP_NAME} runs entirely in your browser: no account, no tracking. Mod data comes from{" "}
          <a className="text-copper-ink underline underline-offset-2" href={MODRINTH_URL} target="_blank" rel="noreferrer">Modrinth</a>.
        </p>
        <p>{LEGAL_NOTICE}</p>
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          <a className="underline underline-offset-2 hover:text-ink" href={REPO_URL} target="_blank" rel="noreferrer">Source code</a>
          <a className="underline underline-offset-2 hover:text-ink" href={ISSUES_URL} target="_blank" rel="noreferrer">Report a problem</a>
          {CONTACT_EMAIL && (
            <a className="underline underline-offset-2 hover:text-ink" href={`mailto:${CONTACT_EMAIL}`}>Contact</a>
          )}
        </p>
      </div>
    </footer>
  );
}

/** "Back" at the end of each step, naming where it goes. "Next" lives in the dock. */
export function StepNav({ builder }: { builder: Builder }) {
  const index = STEPS.findIndex((s) => s.id === builder.state.tab);
  const prev = STEPS[index - 1];
  if (!prev) return null;
  return (
    <div className="mt-10 border-t-2 border-line pt-6">
      <button type="button" onClick={() => builder.actions.goTo(prev.id)} className={buttonClass("ghost")}>
        <ArrowLeft aria-hidden className="h-4 w-4" /> {prev.label}
      </button>
    </div>
  );
}

/**
 * Fixed bar at the bottom of every screen, like the game's hotbar: your mods at a glance,
 * the inventory and compose file on demand, and the way forward.
 */
export function Dock({ builder, panel, onPanel, onOpenMod }: {
  builder: Builder;
  panel: PanelTab | null;
  onPanel: (tab: PanelTab | null) => void;
  onOpenMod: (id: string) => void;
}) {
  const { state, actions, players, vanillaOk, serverProjects } = builder;
  useClearPreviewOn(state.tab);
  const wide = useMediaQuery("(min-width: 1024px)");
  const medium = useMediaQuery("(min-width: 640px)");
  const phone = useMediaQuery("(min-width: 360px)");
  // Leave room for the two panel buttons and "Next" on a 320px phone.
  const visible = wide ? 9 : medium ? 5 : phone ? 2 : 1;
  const shown = state.mods.slice(0, visible);
  const hidden = state.mods.length - shown.length;
  const index = STEPS.findIndex((s) => s.id === state.tab);
  const next = STEPS[index + 1];
  const toggle = (tab: PanelTab) => onPanel(panel === tab ? null : tab);

  return (
    <div role="region" aria-label="Dock: your mods and the next step" className="fixed inset-x-0 bottom-0 z-30 h-[var(--dock-h)] border-t-2 border-line bg-chrome/95 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-[1320px] items-center gap-2 px-3 sm:gap-3 sm:px-6">
        <ul aria-label="Picked mods" className="flex min-w-0 items-center gap-1 overflow-hidden py-1.5 pr-1.5">
          {shown.map((m) => (
            <li key={m.projectId}>
              <Slot
                size="sm"
                badge={slotBadge(m)}
                aria-label={`${m.title}: ${modStatusText(m, state.mcVersion)}. Open details`}
                title={m.title}
                onClick={() => onOpenMod(m.projectId)}
                className={cx("h-10 w-10", m.status === "incompatible" && "opacity-50 grayscale")}
              >
                <ModIcon url={m.iconUrl} />
              </Slot>
            </li>
          ))}
          {hidden > 0 && (
            <li>
              <Slot size="sm" aria-label={`${hidden} more mods. Open inventory`} onClick={() => onPanel("inventory")} className="h-10 w-10">
                <span className="font-mono text-xs font-semibold text-muted">+{hidden}</span>
              </Slot>
            </li>
          )}
          {state.mods.length === 0 && (
            <li>
              <Slot size="sm" aria-label="Add mods" onClick={() => actions.goTo("mods")} className="h-10 w-10 text-faint">
                <span aria-hidden className="text-lg">+</span>
              </Slot>
            </li>
          )}
        </ul>

        <p className="hidden min-w-0 leading-tight md:block">
          <span className="block truncate text-sm font-semibold">
            {state.mods.length} mod{state.mods.length === 1 ? "" : "s"} · {serverProjects.length} on server
          </span>
          <span className={cx("flex items-center gap-1 truncate text-xs", vanillaOk ? "text-emerald" : "text-teal")}>
            {vanillaOk ? <UserCheck aria-hidden className="h-3.5 w-3.5" /> : <Users aria-hidden className="h-3.5 w-3.5" />}
            {vanillaOk ? "Plain Minecraft can join" : `Players need ${players.length}`}
          </span>
        </p>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-pressed={panel === "inventory"}
            onClick={() => toggle("inventory")}
            className={buttonClass("ghost", "md", cx("px-3", panel === "inventory" && "bg-hover text-ink"))}
          >
            <Boxes aria-hidden className="h-4 w-4" />
            <span className="sr-only sm:not-sr-only">Inventory</span>
          </button>
          <button
            type="button"
            aria-pressed={panel === "compose"}
            onClick={() => toggle("compose")}
            className={buttonClass("ghost", "md", cx("px-3", panel === "compose" && "bg-hover text-ink"))}
          >
            <FileCode2 aria-hidden className="h-4 w-4" />
            <span className="sr-only lg:not-sr-only lg:font-mono lg:text-sm">docker-compose.yml</span>
          </button>
          {next && (
            <button type="button" onClick={() => actions.goTo(next.id)} className={buttonClass("primary", "md", "ml-1")}>
              <span className="hidden sm:inline">Next:</span> {next.label} <ArrowRight aria-hidden className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
