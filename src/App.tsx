import { useEffect, useState } from "react";
import { useBuilder } from "./hooks/useBuilder";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { useOptions } from "./hooks/useOptions";
import { buildPlayerModsZip, buildServerKit, kitNames } from "./lib/kit";
import { saveFile, saveGeneratedFile } from "./lib/download";
import type { DownloadProgress } from "./lib/modrinth";
import { shareUrl } from "./lib/share";
import { Header } from "./components/layout/Header";
import { ServerPanel, type PanelTab } from "./components/layout/InventoryPanel";
import { Dock, Footer, StepNav } from "./components/layout/Chrome";
import { VersionStep } from "./components/steps/VersionStep";
import { ModsStep } from "./components/steps/ModsStep";
import { ServerStep } from "./components/steps/ServerStep";
import { ExportStep, type Busy } from "./components/steps/ExportStep";
import { RunGuideDialog } from "./components/dialogs/RunGuideDialog";
import { ImportDialog, ModDialog, OptionsDialog, ResetDialog } from "./components/dialogs/OtherDialogs";
import { Dialog, PreviewProvider, copyText, cx, useToast } from "./components/ui/core";

type DialogName = "guide" | "import" | "options" | "reset" | null;

export default function App() {
  const builder = useBuilder();
  const { state, actions } = builder;
  const [options, setOptions] = useOptions();
  // The inventory/compose panel opens on demand: beside the content on wide screens, as a sheet on phones.
  const desktop = useMediaQuery("(min-width: 1024px)");
  const toast = useToast();
  const [dialog, setDialog] = useState<DialogName>(null);
  const [openMod, setOpenMod] = useState<string | null>(null);
  const [justExported, setJustExported] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [panel, setPanel] = useState<PanelTab | null>(null);

  useEffect(() => {
    if (builder.sharedLoaded) {
      toast({ message: "Loaded a shared setup. Mod versions are being checked." });
      builder.dismissShared();
    }
  }, [builder.sharedLoaded, builder, toast]);

  // Report the outcome of "check for updates" once every mod has been resolved again.
  const [updateCheck, setUpdateCheck] = useState<Map<string, string | null> | null>(null);
  useEffect(() => {
    if (!updateCheck || state.mods.some((m) => m.status === "pending" || m.status === "loading")) return;
    const changed = state.mods.filter((m) => updateCheck.has(m.projectId) && updateCheck.get(m.projectId) !== m.versionId).length;
    toast({ message: changed ? `Updated ${changed} mod${changed === 1 ? "" : "s"} to newer versions.` : "Everything is already up to date." });
    setUpdateCheck(null);
  }, [updateCheck, state.mods, toast]);

  const removeMod = (id: string, title: string) => {
    const undo = actions.removeMod(id);
    toast({ message: `Removed ${title}.`, action: { label: "Undo", onClick: undo } });
  };

  const share = async () => {
    const ok = await copyText(shareUrl(state));
    toast({
      message: ok
        ? "Share link copied. It carries your mods and settings, never your EULA choice or passwords."
        : "Could not copy the link. Your browser blocked clipboard access.",
    });
  };

  const names = kitNames(state);
  /** Shows "Downloading mods 3/12…" on the button while jars come in from Modrinth. */
  const progressFor = (kind: "kit" | "players") => ({ done, total }: DownloadProgress) =>
    setBusy({ kind, label: done < total ? `Downloading mods ${done}/${total}…` : "Zipping…" });
  const failed = (what: string, e: unknown) =>
    toast({ message: `Could not build ${what}: ${e instanceof Error && /checksum|CDN/.test(e.message) ? e.message : "Modrinth did not answer. Try again in a moment."}` });

  const downloadKit = async () => {
    setBusy({ kind: "kit", label: "Crafting…" });
    try {
      const saved = await saveGeneratedFile(names.zip, "application/zip", "Zip archive", [".zip"], () => buildServerKit(state, progressFor("kit")));
      if (saved) {
        setJustExported(true);
        setDialog("guide");
      }
    } catch (e) {
      failed("the kit", e);
    } finally {
      setBusy(null);
    }
  };
  const downloadCompose = async () => {
    await saveFile("docker-compose.yml", new Blob([builder.yaml], { type: "application/yaml" }), "Docker Compose file", [".yml", ".yaml"]);
  };
  const downloadPlayerMods = async () => {
    setBusy({ kind: "players", label: "Preparing…" });
    try {
      const saved = await saveGeneratedFile(names.playersZip, "application/zip", "Zip archive", [".zip"], () => buildPlayerModsZip(state, progressFor("players")));
      if (saved) toast({ message: `Saved ${saved}. Send it to your friends; ${names.instructions} inside explains the rest.` });
    } catch (e) {
      failed("the players' mods", e);
    } finally {
      setBusy(null);
    }
  };

  const openModDetails = (id: string) => {
    // On phones the sheet closes so the details dialog is not stacked on top of it.
    if (!desktop) setPanel(null);
    setOpenMod(id);
  };
  const panelContent = (fill: boolean) =>
    panel && (
      <ServerPanel
        builder={builder}
        tab={panel}
        onTab={setPanel}
        onClose={fill ? () => setPanel(null) : undefined}
        onOpenMod={openModDetails}
        onChecked={setUpdateCheck}
        onDownloadCompose={downloadCompose}
        fill={fill}
      />
    );

  return (
    <PreviewProvider>
      <a href="#main" className="pixel btn-primary fixed top-2 left-2 z-50 -translate-y-20 px-4 py-2 font-semibold focus:translate-y-0">
        Skip to content
      </a>
      <Header
        builder={builder}
        onShowGuide={() => (setJustExported(false), setDialog("guide"))}
        onShare={share}
        onImport={() => setDialog("import")}
        onOptions={() => setDialog("options")}
        onReset={() => setDialog("reset")}
      />

      <div className={cx("mx-auto grid max-w-[1320px] gap-8 px-4 pt-8 sm:px-6", desktop && panel && "grid-cols-[minmax(0,1fr)_420px]")}>
        <main id="main" tabIndex={-1} className="@container min-w-0 focus:outline-none">
          {state.tab === "version" && <VersionStep builder={builder} onImport={() => setDialog("import")} />}
          {state.tab === "mods" && <ModsStep builder={builder} onRemove={removeMod} />}
          {state.tab === "server" && <ServerStep builder={builder} />}
          {state.tab === "export" && (
            <ExportStep
              builder={builder}
              busy={busy}
              onDownloadKit={downloadKit}
              onDownloadCompose={downloadCompose}
              onDownloadPlayerMods={downloadPlayerMods}
              onShare={share}
              onShowGuide={() => (setJustExported(false), setDialog("guide"))}
            />
          )}
          <StepNav builder={builder} />
        </main>
        {desktop && panel && (
          <aside
            aria-label="Your server"
            className="pixel sticky top-[calc(var(--header-h)+16px)] h-[calc(100vh-var(--header-h)-var(--dock-h)-32px)] overflow-hidden card"
          >
            {panelContent(true)}
          </aside>
        )}
      </div>

      <Footer />
      <Dock builder={builder} panel={panel} onPanel={setPanel} onOpenMod={openModDetails} />

      {!desktop && (
        <Dialog open={!!panel} onClose={() => setPanel(null)} title="Your server">
          <div className="-mx-5 -my-5">{panelContent(false)}</div>
        </Dialog>
      )}
      <RunGuideDialog open={dialog === "guide"} onClose={() => setDialog(null)} builder={builder} justExported={justExported} />
      <ImportDialog open={dialog === "import"} onClose={() => setDialog(null)} builder={builder} />
      <OptionsDialog open={dialog === "options"} onClose={() => setDialog(null)} options={options} setOptions={setOptions} />
      <ResetDialog
        open={dialog === "reset"}
        onClose={() => setDialog(null)}
        onConfirm={() => {
          actions.reset();
          toast({ message: "Started over." });
        }}
      />
      <ModDialog modId={openMod} onClose={() => setOpenMod(null)} builder={builder} onRemove={removeMod} />
    </PreviewProvider>
  );
}
