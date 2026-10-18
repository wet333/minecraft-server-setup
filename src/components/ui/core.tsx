import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { Check, Copy, X } from "lucide-react";

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

/* ---------- Button ---------- */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "link";
type Size = "sm" | "md" | "lg";

export function buttonClass(variant: Variant = "secondary", size: Size = "md", extra?: string) {
  return cx(
    "inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap transition select-none",
    "disabled:cursor-not-allowed disabled:opacity-45",
    variant !== "link" && "pixel",
    variant !== "link" && size === "sm" && "h-9 px-3 text-sm",
    variant !== "link" && size === "md" && "h-11 px-4 text-[15px]",
    variant !== "link" && size === "lg" && "h-14 px-6 text-base",
    variant === "primary" && "btn-primary",
    variant === "secondary" && "btn-secondary",
    variant === "ghost" && "text-muted hover:bg-hover hover:text-ink",
    variant === "danger" && "text-redstone hover:bg-redstone-soft",
    variant === "link" && "text-copper-ink underline decoration-1 underline-offset-[3px] hover:decoration-2",
    extra,
  );
}

export function Button({ variant, size, className, ...props }: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button type="button" {...props} className={buttonClass(variant, size, className)} />;
}

/* ---------- Badge ---------- */

export type Tone = "neutral" | "copper" | "teal" | "emerald" | "gold" | "redstone";

const toneClass: Record<Tone, string> = {
  neutral: "bg-slot text-muted",
  copper: "bg-copper-soft text-copper-ink",
  teal: "bg-teal-soft text-teal",
  emerald: "bg-emerald-soft text-emerald",
  gold: "bg-gold-soft text-gold",
  redstone: "bg-redstone-soft text-redstone",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx("pixel inline-flex items-center gap-1 px-1.5 py-0.5 text-[13px] leading-tight font-semibold whitespace-nowrap", toneClass[tone], className)}>
      {children}
    </span>
  );
}

/* ---------- Linked preview: hovering a field highlights its line in the compose file ---------- */

const PreviewContext = createContext<{ active: string[]; setActive: (keys: string[]) => void }>({
  active: [],
  setActive: () => {},
});

export function PreviewProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<string[]>([]);
  const value = useMemo(() => ({ active, setActive }), [active]);
  return <PreviewContext.Provider value={value}>{children}</PreviewContext.Provider>;
}

export const usePreview = () => useContext(PreviewContext);

/* ---------- Field ---------- */

export function Field({
  id, label, hint, error, optional, envKey, children, className,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  /** Compose/env keys this field writes; shown in mono and highlighted in the preview. */
  envKey?: string | string[];
  children: ReactNode;
  className?: string;
}) {
  const { setActive } = usePreview();
  const keys = envKey === undefined ? [] : Array.isArray(envKey) ? envKey : [envKey];
  return (
    <div
      className={cx("flex flex-col gap-1.5", className)}
      onPointerEnter={() => keys.length && setActive(keys)}
      onPointerLeave={() => keys.length && setActive([])}
      onFocus={() => keys.length && setActive(keys)}
      onBlur={() => keys.length && setActive([])}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <label id={`${id}-label`} htmlFor={id} className="text-[15px] font-semibold text-ink">
          {label}
          {optional && <span className="ml-1.5 font-normal text-faint">(optional)</span>}
        </label>
        {keys.length > 0 && <code className="font-mono text-xs text-faint">{keys[0]}</code>}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} className="flex items-start gap-1.5 text-sm font-semibold text-redstone">
          <X aria-hidden className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      ) : (
        hint && <p id={`${id}-hint`} className="text-sm text-muted">{hint}</p>
      )}
    </div>
  );
}

/** aria-describedby for an input inside <Field>. */
export const describedBy = (id: string, opts: { hint?: boolean; error?: string | null }) =>
  opts.error ? `${id}-error` : opts.hint ? `${id}-hint` : undefined;

const inputBase =
  "pixel w-full border-2 border-field bg-raised px-3 text-[16px] text-ink placeholder:text-faint transition " +
  "hover:border-muted focus:border-copper-line focus:outline-none aria-[invalid=true]:border-redstone";

export function TextInput({ className, ...props }: ComponentProps<"input">) {
  return <input type="text" {...props} className={cx(inputBase, "h-11", className)} />;
}

export function TextArea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea rows={3} {...props} className={cx(inputBase, "resize-y py-2", className)} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select {...props} className={cx(inputBase, "h-11 cursor-pointer pr-8", className)}>
      {children}
    </select>
  );
}

/* ---------- Toggle (switch) ---------- */

export function Toggle({ id, label, hint, checked, onChange, envKey }: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  envKey?: string;
}) {
  const { setActive } = usePreview();
  return (
    <div
      className="flex items-start justify-between gap-4 py-1"
      onPointerEnter={() => envKey && setActive([envKey])}
      onPointerLeave={() => envKey && setActive([])}
    >
      <div className="min-w-0">
        <label htmlFor={id} className="cursor-pointer text-[15px] font-semibold text-ink">{label}</label>
        {hint && <p id={`${id}-hint`} className="text-sm text-muted">{hint}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onClick={() => onChange(!checked)}
        onFocus={() => envKey && setActive([envKey])}
        onBlur={() => envKey && setActive([])}
        className={cx(
          "pixel relative mt-0.5 h-7 w-[52px] shrink-0 border-2 transition",
          checked ? "border-copper bg-copper" : "slot border-field",
        )}
      >
        <span className="sr-only">{checked ? "On" : "Off"}</span>
        <span
          aria-hidden
          className={cx(
            "bevel absolute top-[3px] left-[3px] h-[18px] w-[18px] transition-transform",
            checked ? "translate-x-6 bg-on-copper" : "bg-muted",
          )}
        />
      </button>
    </div>
  );
}

/* ---------- Segmented control (radio group) ---------- */

export function Segmented<T extends string>({ value, options, onChange, labelledBy, size = "md" }: {
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
  labelledBy: string;
  size?: "sm" | "md";
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (index: number) => {
    const next = (index + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="pixel flex flex-wrap gap-1 bg-slot p-1 slot">
      {options.map((o, i) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            title={o.hint}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") (e.preventDefault(), move(i + 1));
              if (e.key === "ArrowLeft" || e.key === "ArrowUp") (e.preventDefault(), move(i - 1));
            }}
            className={cx(
              "pixel min-w-fit flex-1 px-3 font-semibold transition",
              size === "md" ? "h-9 text-[15px]" : "h-8 text-sm",
              selected ? "btn-selected" : "text-muted hover:bg-hover hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Slider with an exact number input ---------- */

export function NumberField({ id, value, onChange, min, max, step = 1, unit, labelledBy, describedBy: describedById }: {
  id: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  labelledBy?: string;
  describedBy?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n / step) * step));
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-labelledby={labelledBy ?? `${id}-label`}
        aria-describedby={describedById}
        aria-valuetext={unit ? `${value} ${unit}` : undefined}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-6 w-full cursor-pointer accent-[var(--copper)]"
        tabIndex={-1}
      />
      <div className="pixel flex h-11 shrink-0 items-center border-2 border-field bg-raised pr-2 focus-within:border-copper-line hover:border-muted">
        <input
          id={id}
          inputMode="numeric"
          value={draft}
          aria-describedby={describedById}
          onChange={(e) => {
            setDraft(e.target.value);
            const n = Number(e.target.value);
            if (e.target.value.trim() && Number.isFinite(n) && n >= min && n <= max) onChange(n);
          }}
          onBlur={() => {
            const n = Number(draft);
            const next = Number.isFinite(n) && draft.trim() ? clamp(n) : value;
            onChange(next);
            setDraft(String(next));
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp") (e.preventDefault(), onChange(clamp(value + step)));
            if (e.key === "ArrowDown") (e.preventDefault(), onChange(clamp(value - step)));
          }}
          className="w-14 bg-transparent px-2 text-right font-mono text-[16px] tabular-nums outline-none"
        />
        {unit && <span className="text-sm text-muted">{unit}</span>}
      </div>
    </div>
  );
}

/* ---------- Dialog ---------- */

export function Dialog({ open, onClose, title, description, children, footer, size = "md" }: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cx(
        "pixel m-auto max-h-[min(88vh,900px)] w-[calc(100vw-1.5rem)] overflow-hidden card p-0 text-ink",
        "backdrop:bg-black/60 backdrop:backdrop-blur-[2px]",
        size === "sm" && "max-w-md",
        size === "md" && "max-w-xl",
        size === "lg" && "max-w-3xl",
      )}
    >
      {open && (
        <div className="flex max-h-[min(88vh,900px)] flex-col">
          <div className="flex items-start justify-between gap-4 border-b-2 border-line px-5 py-4">
            <div>
              <h2 id={titleId} className="display-heading text-xl font-semibold">{title}</h2>
              {description && <p className="mt-1 text-sm text-muted">{description}</p>}
            </div>
            <button type="button" onClick={onClose} className={buttonClass("ghost", "sm", "w-9 px-0")} aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-5">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t-2 border-line px-5 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

/* ---------- Toasts (announced to screen readers) ---------- */

interface ToastItem {
  id: number;
  message: string;
  action?: { label: string; onClick: () => void };
}

const ToastContext = createContext<(t: Omit<ToastItem, "id">) => void>(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const show = useCallback((t: Omit<ToastItem, "id">) => {
    const id = nextId.current++;
    setItems((list) => [...list.slice(-2), { ...t, id }]);
    setTimeout(() => setItems((list) => list.filter((x) => x.id !== id)), t.action ? 8000 : 4000);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--dock-h)+12px)] z-50 flex flex-col items-center gap-2 px-4"
      >
        {items.map((t) => (
          <div key={t.id} className="pixel pointer-events-auto flex max-w-md items-center gap-3 border-2 border-line bg-tooltip px-4 py-2.5 text-sm text-white shadow-lg anim-pop">
            <span>{t.message}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action!.onClick();
                  setItems((list) => list.filter((x) => x.id !== t.id));
                }}
                className="font-semibold text-[#f09a6a] underline underline-offset-2"
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/* ---------- Copy ---------- */

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function CopyButton({ text, label = "Copy", onCopied, className }: {
  text: string;
  label?: string;
  onCopied?: () => void;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();
  return (
    <button
      type="button"
      onClick={async () => {
        if (await copyText(text)) {
          setCopied(true);
          onCopied?.();
          setTimeout(() => setCopied(false), 1600);
        } else {
          toast({ message: "Copy was blocked by the browser. Select the text and copy it manually." });
        }
      }}
      className={buttonClass("ghost", "sm", cx("min-w-[84px]", className))}
    >
      {copied ? <Check aria-hidden className="h-4 w-4 text-emerald" /> : <Copy aria-hidden className="h-4 w-4" />}
      <span aria-live="polite">{copied ? "Copied" : label}</span>
    </button>
  );
}

export function CodeBlock({ code, onCopied }: { code: string; onCopied?: () => void }) {
  return (
    <div className="pixel slot flex items-start gap-1">
      <pre className="min-w-0 flex-1 overflow-x-auto py-3 pl-4 font-mono text-[13px] leading-relaxed text-ink">{code}</pre>
      <CopyButton text={code} onCopied={onCopied} className="m-1.5 shrink-0" />
    </div>
  );
}

/** Turns bare URLs in plain text into links. */
export function Linkify({ text }: { text: string }) {
  return (
    <>
      {text.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noreferrer" className="break-all text-copper-ink underline underline-offset-2">
            {part.replace(/^https?:\/\//, "").replace(/\/$/, "")}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}

/** Clears the linked-preview highlight; fields that unmount never fire pointerleave. */
export function useClearPreviewOn(dep: unknown) {
  const { setActive } = usePreview();
  useEffect(() => setActive([]), [dep, setActive]);
}
