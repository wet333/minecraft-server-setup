import { useState, type ReactNode } from "react";
import { ChevronDown, Dices, ImageOff, Lightbulb, Signal } from "lucide-react";
import { nameError, portError, type Builder } from "../../hooks/useBuilder";
import { BACKUP_INTERVALS } from "../../lib/content";
import type { Difficulty, GameMode, LevelType } from "../../lib/state";
import { Button, Field, NumberField, Segmented, Select, TextArea, TextInput, Toggle, cx, describedBy } from "../ui/core";
import { StepHeader } from "./VersionStep";

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  const id = `section-${title.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="pixel card p-4 sm:p-6">
      <h2 id={id} className="text-lg font-semibold">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      <div className="mt-5 flex flex-col gap-6">{children}</div>
    </section>
  );
}

/** How the server looks in the game's multiplayer list. */
function ServerListPreview({ name, motd, icon, players }: { name: string; motd: string; icon: string; players: number }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="pixel slot flex items-center gap-3 p-2.5" aria-hidden>
      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden bg-raised">
        {icon && !failed ? <img src={icon} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} /> : <ImageOff className="h-5 w-5 text-faint" />}
      </div>
      <div className="min-w-0 flex-1 font-mono text-[13px] leading-snug">
        <div className="flex justify-between gap-2">
          <span className="truncate text-ink">{name || "Minecraft Server"}</span>
          <span className="flex shrink-0 items-center gap-1 text-faint">0/{players} <Signal className="h-3.5 w-3.5 text-emerald" /></span>
        </div>
        <div className="truncate text-muted">{motd || "A Minecraft Server"}</div>
      </div>
    </div>
  );
}

export function ServerStep({ builder }: { builder: Builder }) {
  const { state, actions, memoryAdvice } = builder;
  const s = state.server;
  const set = actions.patchServer;
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [advanced, setAdvanced] = useState(false);
  const touch = (field: string) => setTouched((t) => ({ ...t, [field]: true }));
  const nameErr = touched.name ? nameError(state.serverName) : null;
  const portErr = touched.port ? portError(s.port) : null;

  return (
    <div>
      <StepHeader id="server" />
      {/* Two columns once the content area (not the window) is wide enough; one column with the side panel open. */}
      <div className="grid max-w-[760px] gap-5 @4xl:max-w-none @4xl:grid-cols-2">
        <Section title="Identity" description="How the server shows up for you and your friends.">
          <Field id="server-name" label="Server name" envKey="name" error={nameErr} hint="Also names the folder and the Docker project.">
            <TextInput
              id="server-name"
              value={state.serverName}
              onChange={(e) => actions.setServerName(e.target.value)}
              onBlur={() => touch("name")}
              aria-invalid={!!nameErr}
              aria-describedby={describedBy("server-name", { hint: true, error: nameErr })}
            />
          </Field>
          <Field id="motd" label="Message of the day" envKey="MOTD" hint="Shown under the name in the multiplayer list.">
            <TextInput id="motd" value={s.motd} maxLength={120} onChange={(e) => set({ motd: e.target.value })} aria-describedby="motd-hint" />
          </Field>
          <Field id="icon" label="Server icon URL" optional envKey="ICON" hint="A direct link to a square PNG or JPG, downloaded once and resized to 64×64. Avoid wiki images (Fandom) and Discord links: those sites block the download and the server won't start.">
            <TextInput id="icon" type="url" placeholder="https://…/icon.png" value={s.iconUrl} onChange={(e) => set({ iconUrl: e.target.value })} aria-describedby="icon-hint" />
          </Field>
          <ServerListPreview name={state.serverName} motd={s.motd} icon={s.iconUrl} players={s.maxPlayers} />
        </Section>

        <Section title="Gameplay">
          <Field id="mode" label="Game mode" envKey="MODE">
            <Segmented<GameMode>
              labelledBy="mode-label"
              value={s.mode}
              onChange={(mode) => set({ mode })}
              options={[
                { value: "survival", label: "Survival" },
                { value: "creative", label: "Creative" },
                { value: "adventure", label: "Adventure" },
                { value: "spectator", label: "Spectator" },
              ]}
            />
          </Field>
          <Field id="difficulty" label="Difficulty" envKey="DIFFICULTY">
            <Segmented<Difficulty>
              labelledBy="difficulty-label"
              value={s.difficulty}
              onChange={(difficulty) => set({ difficulty })}
              options={[
                { value: "peaceful", label: "Peaceful" },
                { value: "easy", label: "Easy" },
                { value: "normal", label: "Normal" },
                { value: "hard", label: "Hard" },
              ]}
            />
          </Field>
          <div className="flex flex-col gap-3">
            <Toggle id="pvp" label="PvP" hint="Players can hurt each other." checked={s.pvp} onChange={(pvp) => set({ pvp })} envKey="PVP" />
            <Toggle id="hardcore" label="Hardcore" hint="One life: dying turns a player into a spectator." checked={s.hardcore} onChange={(hardcore) => set({ hardcore })} envKey="HARDCORE" />
          </div>
        </Section>

        <Section title="Who can join">
          <Field id="access" label="Access" envKey="ENABLE_WHITELIST" hint={s.whitelistEnabled ? "Only the players below can join. Recommended when the server is reachable from the internet." : "Anyone who knows the address can join."}>
            <Segmented
              labelledBy="access-label"
              value={s.whitelistEnabled ? "list" : "anyone"}
              onChange={(v) => set({ whitelistEnabled: v === "list" })}
              options={[
                { value: "anyone", label: "Anyone with the address" },
                { value: "list", label: "Only listed players" },
              ]}
            />
          </Field>
          {s.whitelistEnabled && (
            <Field id="whitelist" label="Allowed players" envKey="WHITELIST" hint="Java usernames, separated by commas or new lines. Add yourself too.">
              <TextArea id="whitelist" placeholder="Steve, Alex" value={s.whitelist} onChange={(e) => set({ whitelist: e.target.value })} aria-describedby="whitelist-hint" />
            </Field>
          )}
          <Field id="ops" label="Operators" optional envKey="OPS" hint="Players with admin commands, like /gamemode and /kick.">
            <TextInput id="ops" placeholder="Your username" value={s.ops} onChange={(e) => set({ ops: e.target.value })} aria-describedby="ops-hint" />
          </Field>
          <Field id="max-players" label="Max players" envKey="MAX_PLAYERS">
            <NumberField id="max-players" value={s.maxPlayers} min={1} max={100} onChange={(maxPlayers) => set({ maxPlayers })} />
          </Field>
        </Section>

        <Section title="Performance" description="The server's computer needs this memory plus 1–2 GB for itself.">
          <Field id="memory" label="Memory" envKey="MEMORY" hint={memoryAdvice.reason}>
            <NumberField id="memory" value={s.memory} min={1} max={32} unit="GB" onChange={(memory) => set({ memory })} describedBy="memory-hint" />
          </Field>
          {memoryAdvice.gb !== s.memory && (
            <div className="pixel -mt-3 flex flex-wrap items-center gap-3 bg-copper-soft px-3 py-2 text-sm">
              <Lightbulb aria-hidden className="h-4 w-4 text-copper-ink" />
              <span className="flex-1">We suggest {memoryAdvice.gb} GB for this setup.</span>
              <Button size="sm" onClick={() => set({ memory: memoryAdvice.gb })}>Use {memoryAdvice.gb} GB</Button>
            </div>
          )}
          <Field id="view-distance" label="View distance" envKey="VIEW_DISTANCE" hint="How far players see, in chunks. Lower saves CPU and memory.">
            <NumberField id="view-distance" value={s.viewDistance} min={3} max={32} unit="chunks" onChange={(viewDistance) => set({ viewDistance })} describedBy="view-distance-hint" />
          </Field>
          <Field id="sim-distance" label="Simulation distance" envKey="SIMULATION_DISTANCE" hint="How far crops grow and machines run around each player.">
            <NumberField id="sim-distance" value={s.simulationDistance} min={3} max={32} unit="chunks" onChange={(simulationDistance) => set({ simulationDistance })} describedBy="sim-distance-hint" />
          </Field>
        </Section>

        <Section title="World">
          <Field id="seed" label="Seed" optional envKey="SEED" hint="Leave empty for a random world. Only applies when the world is first created.">
            <div className="flex gap-2">
              <TextInput id="seed" placeholder="Random" value={s.seed} onChange={(e) => set({ seed: e.target.value })} aria-describedby="seed-hint" />
              <Button aria-label="Random seed" className="w-11 px-0" onClick={() => set({ seed: String(Math.floor(Math.random() * 2 ** 52) - 2 ** 51) })}>
                <Dices aria-hidden className="h-4 w-4" />
              </Button>
            </div>
          </Field>
          <Field id="level" label="World type" envKey="LEVEL_TYPE">
            <Segmented<LevelType>
              labelledBy="level-label"
              value={s.levelType}
              onChange={(levelType) => set({ levelType })}
              options={[
                { value: "minecraft:normal", label: "Normal" },
                { value: "minecraft:large_biomes", label: "Large biomes" },
                { value: "minecraft:amplified", label: "Amplified" },
                { value: "minecraft:flat", label: "Flat" },
              ]}
            />
          </Field>
        </Section>

        <Section title="Hosting">
          <Field id="port" label="Port" envKey="ports" error={portErr} hint={`Players connect to your-address:${s.port}. Keep 25565 unless it is taken.`}>
            <TextInput
              id="port"
              inputMode="numeric"
              className="max-w-40 font-mono"
              value={Number.isNaN(s.port) ? "" : String(s.port)}
              onChange={(e) => set({ port: e.target.value.trim() === "" ? NaN : Number(e.target.value) })}
              onBlur={() => touch("port")}
              aria-invalid={!!portErr}
              aria-describedby={describedBy("port", { hint: true, error: portErr })}
            />
          </Field>
          <Field
            id="storage"
            label="Where the world is stored"
            envKey="volumes"
            hint={s.storage === "folder" ? "A data folder next to the compose file: easy to find and copy." : "A Docker-managed volume: best on Windows, NAS and Portainer."}
          >
            <Segmented
              labelledBy="storage-label"
              value={s.storage}
              onChange={(storage) => set({ storage })}
              options={[
                { value: "folder", label: "Folder next to the file" },
                { value: "volume", label: "Docker volume" },
              ]}
            />
          </Field>
          <Toggle
            id="backups"
            label="Automatic backups"
            hint="Saves the world into a backups folder while people are playing."
            checked={s.backups}
            onChange={(backups) => set({ backups })}
            envKey="backups"
          />
          {s.backups && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="backup-interval" label="How often" envKey="BACKUP_INTERVAL">
                <Select id="backup-interval" value={s.backupInterval} onChange={(e) => set({ backupInterval: e.target.value })}>
                  {BACKUP_INTERVALS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                </Select>
              </Field>
              <Field id="backup-keep" label="Keep for" envKey="PRUNE_BACKUPS_DAYS">
                <NumberField id="backup-keep" value={s.backupKeepDays} min={1} max={90} unit="days" onChange={(backupKeepDays) => set({ backupKeepDays })} />
              </Field>
            </div>
          )}
        </Section>

        <section className="pixel card @4xl:col-span-2">
          <button
            type="button"
            onClick={() => setAdvanced(!advanced)}
            aria-expanded={advanced}
            aria-controls="advanced-settings"
            className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left sm:px-6"
          >
            <span>
              <span className="block text-lg font-semibold">Advanced</span>
              <span className="block text-sm text-muted">5 settings: online mode, flight, command blocks, spawn protection, time zone</span>
            </span>
            <ChevronDown aria-hidden className={cx("h-5 w-5 shrink-0 text-faint transition-transform", advanced && "rotate-180")} />
          </button>
          {advanced && (
            <div id="advanced-settings" className="grid gap-6 border-t-2 border-line px-4 py-5 sm:px-6 @4xl:grid-cols-2 @4xl:gap-x-10">
              {/* Switches in one column, values in the other, so rows never leave ragged gaps. */}
              <div className="flex flex-col gap-4">
                <Toggle id="online" label="Online mode" hint="Checks every account with Mojang. Keep on unless you know why not; off lets anyone use any name." checked={s.onlineMode} onChange={(onlineMode) => set({ onlineMode })} envKey="ONLINE_MODE" />
                <Toggle id="flight" label="Allow flight" hint="On by default here: modded movement often trips the anti-fly kick." checked={s.allowFlight} onChange={(allowFlight) => set({ allowFlight })} envKey="ALLOW_FLIGHT" />
                <Toggle id="command-blocks" label="Command blocks" checked={s.commandBlocks} onChange={(commandBlocks) => set({ commandBlocks })} envKey="ENABLE_COMMAND_BLOCK" />
              </div>
              <div className="flex flex-col gap-6">
                <Field id="spawn-protection" label="Spawn protection" envKey="SPAWN_PROTECTION" hint="Radius around spawn that only operators can change. 0 turns it off.">
                  <NumberField id="spawn-protection" value={s.spawnProtection} min={0} max={64} unit="blocks" onChange={(spawnProtection) => set({ spawnProtection })} describedBy="spawn-protection-hint" />
                </Field>
                <Field id="timezone" label="Time zone" optional envKey="TZ" hint="For log timestamps. Filled in from your browser.">
                  <TextInput id="timezone" className="font-mono" value={s.timezone} onChange={(e) => set({ timezone: e.target.value })} aria-describedby="timezone-hint" />
                </Field>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
