import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { cx } from "../ui/core";

const indentOf = (line: string) => line.length - line.trimStart().length;
const keyOf = (line: string) => line.trimStart().replace(/^- /, "").match(/^([\w.-]+):/)?.[1] ?? null;

function renderValue(value: string): ReactNode {
  if (!value) return null;
  if (/^".*"$/.test(value)) return <span className="text-gold">{value}</span>;
  if (/^(true|false|null|-?\d+(\.\d+)?)$/.test(value)) return <span className="text-teal">{value}</span>;
  if (value === "{}") return <span className="text-faint">{value}</span>;
  return <span className="text-emerald">{value}</span>;
}

function highlight(line: string): ReactNode {
  const comment = line.match(/^(\s*)(#.*)$/);
  if (comment) return <>{comment[1]}<span className="text-faint italic">{comment[2]}</span></>;
  const kv = line.match(/^(\s*)(- )?([\w.-]+)(:)(\s*)(.*)$/);
  if (kv) {
    const [, indent, dash, k, colon, space, value] = kv;
    return (
      <>
        {indent}{dash && <span className="text-faint">{dash}</span>}
        <span className="text-copper-ink">{k}</span><span className="text-faint">{colon}</span>{space}{renderValue(value)}
      </>
    );
  }
  const item = line.match(/^(\s*)(- )(.*)$/);
  if (item) return <>{item[1]}<span className="text-faint">{item[2]}</span>{renderValue(item[3])}</>;
  return line;
}

/** Live compose preview. Lines that changed since the last render flash; the active setting's block is highlighted. */
export function YamlPreview({ yaml, activeKeys, className }: { yaml: string; activeKeys: string[]; className?: string }) {
  const lines = useMemo(() => yaml.replace(/\n$/, "").split("\n"), [yaml]);
  const previous = useRef<Set<string> | null>(null);
  const changed = useMemo(() => {
    const prev = previous.current;
    return new Set(prev ? lines.filter((l) => !prev.has(l)) : []);
  }, [lines]);
  useEffect(() => {
    previous.current = new Set(lines);
  }, [lines]);

  // A key highlights its own line plus every deeper-indented line under it.
  const highlighted = useMemo(() => {
    const set = new Set<number>();
    if (!activeKeys.length) return set;
    lines.forEach((line, i) => {
      const key = keyOf(line);
      if (!key || !activeKeys.includes(key)) return;
      set.add(i);
      const indent = indentOf(line);
      for (let j = i + 1; j < lines.length; j++) {
        const depth = indentOf(lines[j]);
        const isItem = lines[j].trimStart().startsWith("- ");
        if (depth > indent || (depth === indent && isItem)) set.add(j);
        else break;
      }
    });
    return set;
  }, [lines, activeKeys]);

  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const first = Math.min(...highlighted);
    const box = container.current;
    if (!box || !Number.isFinite(first)) return;
    const el = box.querySelector<HTMLElement>(`[data-line="${first}"]`);
    if (!el) return;
    const top = el.offsetTop - box.offsetTop;
    if (top < box.scrollTop || top > box.scrollTop + box.clientHeight - 40) box.scrollTo({ top: Math.max(0, top - 48) });
  }, [highlighted]);

  // Stable keys by text (+ occurrence) so only genuinely new lines remount and animate.
  const seen = new Map<string, number>();
  return (
    <div ref={container} tabIndex={0} role="region" aria-label="docker-compose.yml contents" className={cx("overflow-auto focus-visible:outline-offset-[-2px]", className)}>
      <pre className="min-w-fit py-3 font-mono text-[12.5px] leading-[1.7]">
        <code>
          {lines.map((line, i) => {
            const n = (seen.get(line) ?? 0) + 1;
            seen.set(line, n);
            return (
              <div
                key={`${line}\u0000${n}`}
                data-line={i}
                className={cx(
                  "flex pr-4",
                  changed.has(line) && "anim-line",
                  highlighted.has(i) && "bg-copper-soft shadow-[inset_3px_0_0_var(--copper)]",
                )}
              >
                <span aria-hidden className="w-9 shrink-0 pr-3 text-right text-faint select-none">{i + 1}</span>
                <span className="whitespace-pre text-ink">{highlight(line)}</span>
              </div>
            );
          })}
        </code>
      </pre>
    </div>
  );
}
