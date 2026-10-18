type SaveFilePicker = (opts: {
  suggestedName: string;
  types: { description: string; accept: Record<string, string[]> }[];
}) => Promise<{ name: string; createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }> }>;

/**
 * Saves a file. Chromium browsers let the user pick the folder; elsewhere it is a normal download.
 * Returns the saved name, or null when the user cancelled the picker.
 */
export async function saveFile(name: string, blob: Blob, description: string, extensions: string[]): Promise<string | null> {
  const picker = (window as unknown as { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;
  if (picker) {
    try {
      const handle = await picker({ suggestedName: name, types: [{ description, accept: { [blob.type]: extensions } }] });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return handle.name;
    } catch (e) {
      if ((e as Error).name === "AbortError") return null;
      // Any other failure (e.g. blocked in an iframe): fall back to a download.
    }
  }
  return downloadBlob(name, blob);
}

/** Plain browser download into the default downloads folder. */
function downloadBlob(name: string, blob: Blob): string {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return name;
}

/**
 * Like saveFile, for files that take a while to build (e.g. downloading mods). The save dialog
 * opens first, while the click still counts as a user gesture; the file is built afterwards.
 * Returns the saved name, or null when cancelled or there was nothing to save.
 */
export async function saveGeneratedFile(
  name: string,
  mime: string,
  description: string,
  extensions: string[],
  build: () => Promise<Blob | null>,
): Promise<string | null> {
  const picker = (window as unknown as { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;
  let handle: Awaited<ReturnType<SaveFilePicker>> | null = null;
  if (picker) {
    try {
      handle = await picker({ suggestedName: name, types: [{ description, accept: { [mime]: extensions } }] });
    } catch (e) {
      if ((e as Error).name === "AbortError") return null;
      // Picker unavailable here; fall back to a normal download below.
    }
  }
  const blob = await build();
  if (!blob) return null;
  if (handle) {
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return handle.name;
  }
  return downloadBlob(name, blob);
}

export type Os = "windows" | "mac" | "linux";

export function detectOs(): Os {
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.userAgent;
  if (/win/i.test(platform)) return "windows";
  if (/mac|iphone|ipad/i.test(platform)) return "mac";
  return "linux";
}
