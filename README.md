# MCServerSetup

Docker Compose builder for modded Fabric servers. Pick a Minecraft version, add mods from Modrinth, tune a few
settings and download a ready-to-run kit for the [`itzg/minecraft-server`](https://docker-minecraft-server.readthedocs.io/)
image, plus a folder of mods your friends paste into Minecraft to join.

## What it does for you

- **Pins everything** so restarts never change the server: Minecraft version, Fabric loader, the Java image tag
  (`java8` / `java17` / `java21` / `java25`) and every mod by exact Modrinth version ID.
- **Resolves dependencies in the browser**, including transitive ones and beta-only libraries, and writes them into
  `MODRINTH_PROJECTS` with `MODRINTH_DOWNLOAD_DEPENDENCIES=none`. Missing dependencies block the export instead of
  crash-looping the server.
- **Finds mods fast**: search Modrinth filtered to Fabric and your version, narrow by category (world gen,
  optimization, magic…), add a server-side performance pack in one click.
- **Sorts mods by side**: client-only mods stay off the server and go into the players' mods folder; mods players need are
  flagged; Modrinth's side data can be overridden per mod.
- **Exports a kit** (`<name>-server.zip`): `docker-compose.yml`, a README with steps for Windows, macOS, Linux and
  NAS/Portainer, and a `players/` folder: the jars friends copy into their Minecraft `mods` folder, downloaded from
  Modrinth and checked against its SHA-1, plus `HOW-TO-INSTALL.txt` (Fabric installer, folder per OS, other launchers).
- **Safe production defaults**: explicit EULA acceptance, `restart: unless-stopped`, a 2-minute stop grace period so the
  world saves, Aikar's GC flags, RCON never published, enforced whitelist, optional `itzg/mc-backup` sidecar, extra
  ports for mods that need them (voice chat, web maps).
- **Picks up where you left off**: autosave in the browser, share links (`#setup=…`), and import of an existing
  `docker-compose.yml`.

## Develop

Requires Node.js 22 or newer.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest)
npm run build      # type-check + production build into dist/
```

## Deploy

The build is a static site; it calls the public Modrinth and Fabric meta APIs straight from the browser, so there is
no backend and no API key.

- **Any static host**: serve `dist/`. Send the headers from `nginx.conf` (CSP, `nosniff`, long caching for `/assets/`).
- **Docker** (nginx, unprivileged, port 8080):
  ```bash
  docker build -t mcserversetup .
  docker run -d -p 8080:8080 mcserversetup
  ```
- **Vercel**: import the repository as is (no root directory to set); `vercel.json` sets the build, output and headers.

### Configuration

Set at build time (e.g. in `.env.production` or your host's build settings):

| Variable | Purpose |
| --- | --- |
| `VITE_APP_URL` | Public URL, written into generated files. Defaults to the repository URL. |
| `VITE_REPO_URL` | Source link in the footer and "Report a problem". |
| `VITE_CONTACT_EMAIL` | Contact address in the footer. Mojang's usage guidelines ask public tools for a contact method other than chat or a forum, so set it before going public. |

## Structure

| Path | Purpose |
| --- | --- |
| `src/lib/compose.ts` | Builder state → `itzg/minecraft-server` environment and YAML |
| `src/lib/modrinth.ts` | Modrinth/Fabric API client: retries on 429/5xx, session cache, dependency walk |
| `src/lib/kit.ts`, `guide.ts` | Zip kit, players' mods folder and install steps, README and in-app run guide |
| `src/lib/importCompose.ts`, `share.ts` | Import an existing compose file; share links |
| `src/hooks/useBuilder.ts` | App state, mod resolution, validation |
| `src/components/` | `ui/` atoms, `layout/` chrome, `steps/` one per step, `dialogs/` |
| `DESIGN.md` | Design system: tokens, type, signature element, decisions |

---

Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft. Not affiliated with
Modrinth or the itzg/minecraft-server project.
