import { useEffect, useState } from "react";

export interface DisplayOptions {
  reduceMotion: boolean;
}

// Same key public/options-init.js reads before React loads.
const KEY = "composter:options";
const DEFAULTS: DisplayOptions = { reduceMotion: false };

function load(): DisplayOptions {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    // Older saves also hold a theme choice; the app is dark only now, so it is dropped.
    return { reduceMotion: saved.reduceMotion === true };
  } catch {
    return DEFAULTS;
  }
}

/** Display options mirrored onto <html> data attributes. */
export function useOptions() {
  const [options, setOptions] = useState<DisplayOptions>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(options));
    } catch {
      // Not persisted in private mode; still applied for this visit.
    }
    const root = document.documentElement;
    if (options.reduceMotion) root.dataset.motion = "reduce";
    else delete root.dataset.motion;
  }, [options]);

  return [options, (patch: Partial<DisplayOptions>) => setOptions((o) => ({ ...o, ...patch }))] as const;
}

export function prefersReducedMotion() {
  return (
    document.documentElement.dataset.motion === "reduce" || window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
