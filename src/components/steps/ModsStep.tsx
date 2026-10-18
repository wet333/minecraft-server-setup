import { useEffect, useState, type ReactNode } from "react";
import { Check, Download, ExternalLink, Gauge, Heart, Loader2, Plus, RefreshCw, Search, Server, UserCheck, Users } from "lucide-react";
import type { Builder } from "../../hooks/useBuilder";
import { PERFORMANCE_PACK } from "../../lib/content";
import { LOADER_CATEGORIES, formatCount, searchMods, type SearchHit, type SortIndex } from "../../lib/modrinth";
import { PLACEMENT_TEXT, kindOf, placement, type PlacementKind } from "../../lib/sides";
import { Badge, Button, Segmented, Select, buttonClass, cx, useToast } from "../ui/core";
import { ModIcon, Slot } from "../ui/slot";
import { CategoryFilter, categoryLabel } from "./CategoryFilter";
import { StepHeader } from "./VersionStep";

const PAGE = 20;

const SORTS: { value: SortIndex; label: string }[] = [
  { value: "relevance", label: "Best match" },
  { value: "downloads", label: "Most downloaded" },
  { value: "follows", label: "Most followed" },
  { value: "updated", label: "Recently updated" },
  { value: "newest", label: "Newest" },
];

const PLACEMENT_ICON: Record<PlacementKind, typeof Server> = { both: Users, server: Server, players: UserCheck };
const PLACEMENT_TONE = { both: "teal", server: "emerald", players: "neutral" } as const;

export function PlacementBadge({ kind }: { kind: PlacementKind }) {
  const Icon = PLACEMENT_ICON[kind];
  return (
    <Badge tone={PLACEMENT_TONE[kind]}>
      <Icon aria-hidden className="h-3.5 w-3.5" /> {PLACEMENT_TEXT[kind].short}
    </Badge>
  );
}

/** Wraps occurrences of the query in <mark>. */
function highlight(text: string, query: string): ReactNode {
  const q = query.trim();
  if (q.length < 2) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i === -1) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-copper-soft text-inherit">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

export function ModsStep({ builder, onRemove }: { builder: Builder; onRemove: (id: string, title: string) => void }) {
  const { state, actions } = builder;
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sort, setSort] = useState<SortIndex>("relevance");
  const [scope, setScope] = useState<"server" | "all">("server");
  const [categories, setCategories] = useState<string[]>([]);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [packBusy, setPackBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => setOffset(0), [debounced, sort, scope, categories, state.mcVersion]);

  useEffect(() => {
    if (!state.mcVersion) return;
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    searchMods({ query: debounced, mcVersion: state.mcVersion, hideClientOnly: scope === "server", sort, offset, categories, limit: PAGE, signal: ctrl.signal })
      .then((r) => {
        setHits((prev) => (offset === 0 ? r.hits : [...prev, ...r.hits]));
        setTotal(r.total_hits);
        setLoading(false);
      })
      .catch((e: Error) => {
        if (e.name === "AbortError") return;
        setError(e.message);
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [debounced, sort, scope, categories, offset, state.mcVersion, attempt]);

  const picked = new Set(state.mods.map((m) => m.projectId));
  const packMissing = PERFORMANCE_PACK.filter((slug) => !state.mods.some((m) => m.slug === slug)).length;
  const firstLoad = loading && offset === 0 && hits.length === 0;
  const refreshing = loading && offset === 0 && hits.length > 0;

  const addPack = async () => {
    setPackBusy(true);
    try {
      const added = await actions.addBySlugs(PERFORMANCE_PACK);
      toast({ message: added ? `Added ${added} performance mod${added === 1 ? "" : "s"}.` : "The performance pack is already in your inventory." });
    } catch {
      toast({ message: "Could not reach Modrinth. Try again in a moment." });
    } finally {
      setPackBusy(false);
    }
  };

  const filtering = debounced.trim() !== "" || categories.length > 0;
  const inCategories = categories.length ? ` in ${categories.map(categoryLabel).join(" + ")}` : "";
  const status = error
    ? "Search failed."
    : firstLoad || refreshing
      ? "Searching…"
      : total === 0
        ? `No mods${debounced.trim() ? ` match “${debounced.trim()}”` : ""}${inCategories}.`
        : `${total.toLocaleString()} mod${total === 1 ? "" : "s"}${inCategories} for Fabric ${state.mcVersion}${
            debounced.trim() ? ` matching “${debounced.trim()}”` : sort === "relevance" ? ", most downloaded first" : ""
          }.`;

  return (
    <div>
      <StepHeader id="mods" />

      <div className="pixel z-20 card p-3 backdrop-blur sm:p-4 lg:sticky lg:top-[calc(var(--header-h)+8px)]">
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-faint" />
          <label htmlFor="mod-search" className="sr-only">Search mods</label>
          <input
            id="mod-search"
            type="search"
            autoComplete="off"
            placeholder={`Search Fabric mods for ${state.mcVersion}`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pixel h-12 w-full border-2 border-field bg-raised pr-3 pl-11 text-[17px] text-ink placeholder:text-faint hover:border-muted focus:border-copper-line focus:outline-none"
          />
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="sm:w-80">
            <span id="scope-label" className="sr-only">Which mods to show</span>
            <Segmented
              size="sm"
              labelledBy="scope-label"
              value={scope}
              onChange={setScope}
              options={[
                { value: "server", label: "Runs on server", hint: "Hide mods that only work in the players' game" },
                { value: "all", label: "Everything", hint: "Include client-only mods; they go in the players' mods folder" },
              ]}
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="sort" className="text-sm text-muted">Sort</label>
            <Select id="sort" value={sort} onChange={(e) => setSort(e.target.value as SortIndex)} className="h-9 w-auto text-sm">
              {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </div>
        </div>
        <div className="-mx-1 mt-2 sm:mx-0">
          <CategoryFilter selected={categories} onChange={setCategories} />
        </div>
      </div>

      <p role="status" className="mt-4 mb-3 text-sm text-muted">{status}</p>

      {!filtering && (
        <div className="pixel mb-4 flex flex-col gap-3 border-2 border-dashed border-line p-4 sm:flex-row sm:items-center">
          <Slot size="lg" aria-hidden><Gauge className="h-6 w-6 text-copper-ink" /></Slot>
          <div className="flex-1">
            <p className="font-semibold">Performance pack</p>
            <p className="text-sm text-muted">Lithium, FerriteCore and Krypton: a faster server, and players still join with plain Minecraft.</p>
          </div>
          {packMissing === 0 ? (
            <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald"><Check aria-hidden className="h-4 w-4" /> In your inventory</p>
          ) : (
            <Button onClick={addPack} disabled={packBusy}>
              {packBusy ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <Plus aria-hidden className="h-4 w-4" />}
              {packMissing === PERFORMANCE_PACK.length ? "Add all three" : `Add the missing ${packMissing}`}
            </Button>
          )}
        </div>
      )}

      {error && (
        <div role="alert" className="pixel flex flex-wrap items-center gap-3 bg-redstone-soft p-4 text-redstone">
          Could not search Modrinth: {error}
          <Button size="sm" onClick={() => setAttempt((n) => n + 1)}><RefreshCw aria-hidden className="h-4 w-4" /> Try again</Button>
        </div>
      )}

      {firstLoad && (
        <ul aria-busy="true" aria-label="Loading results" className="flex flex-col gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <li key={i} className="pixel flex gap-4 card p-3">
              <div className="pixel skeleton h-14 w-14" />
              <div className="flex flex-1 flex-col gap-2 py-1"><div className="pixel skeleton h-4 w-1/3" /><div className="pixel skeleton h-3 w-4/5" /></div>
            </li>
          ))}
        </ul>
      )}

      {!loading && !error && total === 0 && (
        <div className="pixel card p-5">
          <p className="font-semibold">{status}</p>
          <ul className="mt-2 list-inside list-disc text-sm text-muted">
            {debounced.trim() && <li>Check the spelling, or try a shorter word.</li>}
            {categories.length > 0 && (
              <li>
                {categories.length > 1 ? "Mods must match every category you pick." : "The category may be too narrow."}{" "}
                <button type="button" className={buttonClass("link")} onClick={() => setCategories([])}>Clear categories</button>
              </li>
            )}
            {scope === "server" && (
              <li>
                It may be a client-only mod.{" "}
                <button type="button" className={buttonClass("link")} onClick={() => setScope("all")}>Show everything</button>
              </li>
            )}
            <li>The mod may not support Fabric {state.mcVersion} yet. Try another version in step 1.</li>
          </ul>
        </div>
      )}

      <h2 className="sr-only">Search results</h2>
      <ul className={cx("flex flex-col gap-2 transition-opacity", refreshing && "opacity-60")}>
        {hits.map((hit) => {
          const added = picked.has(hit.project_id);
          const kind = kindOf(placement(hit.client_side, hit.server_side));
          const tags = hit.categories.filter((c) => !LOADER_CATEGORIES.has(c)).slice(0, 2);
          return (
            <li
              key={hit.project_id}
              className={cx(
                "pixel flex gap-3 border-2 p-3 transition sm:gap-4",
                added ? "border-copper-line bg-copper-soft" : "card hover:border-field",
              )}
            >
              <Slot size="lg" aria-hidden><ModIcon url={hit.icon_url} /></Slot>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <h3 className="font-semibold text-ink">{highlight(hit.title, debounced)}</h3>
                  <span className="text-sm text-faint">by {hit.author}</span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-sm text-muted">{highlight(hit.description, debounced)}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-faint">
                  <PlacementBadge kind={kind} />
                  <span className="inline-flex items-center gap-1"><Download aria-hidden className="h-3.5 w-3.5" />{formatCount(hit.downloads)}<span className="sr-only"> downloads</span></span>
                  <span className="inline-flex items-center gap-1"><Heart aria-hidden className="h-3.5 w-3.5" />{formatCount(hit.follows)}<span className="sr-only"> follows</span></span>
                  {tags.map((t) => <span key={t} className="capitalize">{t}</span>)}
                  <a
                    href={`https://modrinth.com/mod/${hit.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-ink"
                  >
                    Modrinth <ExternalLink aria-hidden className="h-3 w-3" /><span className="sr-only">(opens {hit.title} in a new tab)</span>
                  </a>
                </div>
              </div>
              <div className="flex shrink-0 items-start">
                {added ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-pressed="true"
                    aria-label={`${hit.title} is in your inventory. Remove`}
                    onClick={() => onRemove(hit.project_id, hit.title)}
                    className="text-emerald"
                  >
                    <Check aria-hidden className="h-4 w-4" /> Added
                  </Button>
                ) : (
                  <Button size="sm" aria-label={`Add ${hit.title}`} onClick={() => actions.addMod(hit)}>
                    <Plus aria-hidden className="h-4 w-4" /> Add
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {hits.length < total && !error && (
        <div className="mt-4 flex justify-center">
          <Button onClick={() => setOffset(hits.length)} disabled={loading}>
            {loading && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />} Show more ({(total - hits.length).toLocaleString()} left)
          </Button>
        </div>
      )}
    </div>
  );
}
