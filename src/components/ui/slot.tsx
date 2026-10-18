import { forwardRef, useState, type ComponentProps, type ReactNode } from "react";
import { Package } from "lucide-react";
import { cx } from "./core";

const sizes = {
  sm: "h-9 w-9",
  md: "h-12 w-12",
  lg: "h-14 w-14",
} as const;

/** An inventory cell. Renders as a button when clickable. */
export const Slot = forwardRef<HTMLButtonElement, Omit<ComponentProps<"button">, "children"> & {
  size?: keyof typeof sizes;
  selected?: boolean;
  /** Small corner marker (players-need, warning, beta…). Must also be described in text. */
  badge?: ReactNode;
  children?: ReactNode;
  pop?: boolean;
}>(function Slot({ size = "md", selected, badge, children, pop, className, onClick, ...props }, ref) {
  const body = (
    <>
      <span className="flex h-full w-full items-center justify-center overflow-hidden p-1.5">{children}</span>
      {badge && <span className="pointer-events-none absolute -right-1 -bottom-1">{badge}</span>}
    </>
  );
  const classes = cx(
    "pixel slot relative inline-flex shrink-0 items-center justify-center",
    sizes[size],
    selected && "outline-2 outline-offset-1 outline-copper-line",
    pop && "anim-pop",
    className,
  );
  if (!onClick) {
    return <span className={classes} aria-hidden={props["aria-hidden"]}>{body}</span>;
  }
  return (
    <button ref={ref} type="button" onClick={onClick} {...props} className={cx(classes, "cursor-pointer transition hover:brightness-125")}>
      {body}
    </button>
  );
});

export function SlotBadge({ tone, children, label }: { tone: "teal" | "gold" | "redstone" | "copper" | "emerald"; children: ReactNode; label?: string }) {
  const bg = { teal: "bg-sig-teal", gold: "bg-sig-gold", redstone: "bg-sig-redstone", copper: "bg-sig-copper", emerald: "bg-sig-emerald" }[tone];
  return (
    <span title={label} className={cx("pixel flex h-[18px] min-w-[18px] items-center justify-center px-0.5 text-[11px] font-bold text-sig-glyph ring-2 ring-surface", bg)}>
      {children}
    </span>
  );
}

export function ModIcon({ url, alt = "", className }: { url: string | null; alt?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return <Package aria-hidden className={cx("h-3/5 w-3/5 text-faint", className)} />;
  }
  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={cx("h-full w-full object-cover", className)}
    />
  );
}

/** Brand mark: a copper block that is also a rack server, with three bays and their status lights. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <polygon points="16,2 29,9 16,16 3,9" fill="#F09A6A" />
      <polygon points="3,9 16,16 16,30 3,23" fill="#E8844E" />
      <polygon points="16,16 29,9 29,23 16,30" fill="#B9541F" />
      <polygon points="5,13.3 11,16.5 11,18 5,14.8" fill="#3E2A1E" />
      <polygon points="5,17.3 11,20.5 11,22 5,18.8" fill="#3E2A1E" />
      <polygon points="5,21.3 11,24.5 11,26 5,22.8" fill="#3E2A1E" />
      <circle cx="13.2" cy="18.4" r="1.15" fill="#5AD68E" />
      <circle cx="13.2" cy="22.4" r="1.15" fill="#5AD68E" />
      <circle cx="13.2" cy="26.4" r="1.15" fill="#F2C24B" />
    </svg>
  );
}
