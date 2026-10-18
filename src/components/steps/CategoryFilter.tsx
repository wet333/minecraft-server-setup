import { useCallback, useEffect, useRef, useState } from "react";
import {
  Apple, Archive, Armchair, Check, ChevronLeft, ChevronRight, ClipboardList, Coins, Compass, Cpu, Dices, Gauge, Library,
  MessagesSquare, Mountain, PawPrint, Puzzle, Shield, Skull, TrainFront, WandSparkles, Wrench, X,
} from "lucide-react";
import { MOD_CATEGORIES } from "../../lib/content";
import { cx } from "../ui/core";

const ICONS: Record<string, typeof Gauge> = {
  optimization: Gauge,
  worldgen: Mountain,
  adventure: Compass,
  technology: Cpu,
  magic: WandSparkles,
  utility: Wrench,
  decoration: Armchair,
  storage: Archive,
  mobs: PawPrint,
  equipment: Shield,
  food: Apple,
  "game-mechanics": Puzzle,
  transportation: TrainFront,
  management: ClipboardList,
  social: MessagesSquare,
  economy: Coins,
  minigame: Dices,
  library: Library,
  cursed: Skull,
};

export const categoryLabel = (value: string) => MOD_CATEGORIES.find((c) => c.value === value)?.label ?? value;

/** One scrollable row of category chips; picking several narrows the results to mods in all of them. */
export function CategoryFilter({ selected, onChange }: { selected: string[]; onChange: (next: string[]) => void }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    measure();
    const el = scroller.current;
    const observer = new ResizeObserver(measure);
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  const scrollBy = (dx: number) => scroller.current?.scrollBy({ left: dx, behavior: "smooth" });

  return (
    <div className="flex items-center gap-1.5">
      <span id="category-label" className="sr-only">Filter by category</span>
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        onClick={() => scrollBy(-240)}
        className={cx("hidden h-8 w-8 shrink-0 items-center justify-center text-muted hover:text-ink sm:flex", !edges.left && "invisible")}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div
        ref={scroller}
        role="group"
        aria-labelledby="category-label"
        onScroll={measure}
        className={cx(
          "flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          // Fades hint that more chips are hidden off either edge.
          edges.right && edges.left && "[mask-image:linear-gradient(90deg,transparent,#000_24px,#000_calc(100%-24px),transparent)]",
          edges.right && !edges.left && "[mask-image:linear-gradient(90deg,#000_calc(100%-32px),transparent)]",
          edges.left && !edges.right && "[mask-image:linear-gradient(90deg,transparent,#000_32px)]",
        )}
      >
        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="pixel flex h-8 shrink-0 items-center gap-1 px-2.5 text-sm font-semibold text-copper-ink hover:bg-hover"
          >
            <X aria-hidden className="h-3.5 w-3.5" /> Clear{selected.length > 1 ? ` (${selected.length})` : ""}
          </button>
        )}
        {MOD_CATEGORIES.map((c) => {
          const Icon = ICONS[c.value];
          const on = selected.includes(c.value);
          return (
            <button
              key={c.value}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(c.value)}
              className={cx(
                "pixel flex h-8 shrink-0 items-center gap-1.5 border-2 px-2.5 text-sm font-semibold whitespace-nowrap transition",
                on ? "border-copper-line bg-copper-soft text-ink" : "border-btn-border/70 text-muted hover:border-btn-border hover:text-ink",
              )}
            >
              {on ? <Check aria-hidden className="h-3.5 w-3.5 text-copper-ink" /> : Icon && <Icon aria-hidden className="h-3.5 w-3.5" />}
              {c.label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        onClick={() => scrollBy(240)}
        className={cx("hidden h-8 w-8 shrink-0 items-center justify-center text-muted hover:text-ink sm:flex", !edges.right && "invisible")}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
