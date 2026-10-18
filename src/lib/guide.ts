// How to run the exported kit. Shared by the in-app guide and the README inside the zip.

export type Platform = "windows" | "mac" | "linux" | "nas";

export const PLATFORMS: { id: Platform; label: string }[] = [
  { id: "windows", label: "Windows" },
  { id: "mac", label: "macOS" },
  { id: "linux", label: "Linux" },
  { id: "nas", label: "NAS / Portainer" },
];

export interface GuideStep {
  title: string;
  body: string;
  code?: string;
  /** Shown as a caution when the chosen settings are risky on this platform, or for a common trap. */
  caution?: string;
}

export interface GuideContext {
  zip: string;
  folder: string;
  port: number;
  storage: "folder" | "volume";
  /** Java heap in GB (the MEMORY setting). */
  memory: number;
}

const DOCKER_DESKTOP = "https://docs.docker.com/desktop/";
const DOCKER_ENGINE = "https://docs.docker.com/engine/install/";

/** The heap plus room for Java itself, mods' native memory and the image's tools. */
export function neededMemory(memory: number) {
  return memory + 2;
}

export function startSteps(platform: Platform, c: GuideContext): GuideStep[] {
  const need = neededMemory(c.memory);
  const run: GuideStep = {
    title: "Start the server",
    body: "The first start takes a few minutes while Minecraft, Fabric and the mods download.",
    code: "docker compose up -d",
  };
  const logs: GuideStep = {
    title: "Wait until it is ready",
    body: 'Watch the log until it says Done (…)! For help, type "help". Press Ctrl+C to stop watching; the server keeps running.',
    code: "docker compose logs -f mc",
  };

  switch (platform) {
    case "windows":
      return [
        {
          title: "Install Docker Desktop",
          body: `Use the WSL 2 option when asked. ${DOCKER_DESKTOP}`,
          caution: `With WSL 2, containers get half of the PC's RAM by default. This server needs about ${need} GB: if half your RAM is less, lower the memory in the Server step or raise the limit in .wslconfig. Otherwise Java is killed while starting.`,
        },
        {
          title: "Unzip the kit",
          body: `Right-click ${c.zip} → Extract All, for example into C:\\Minecraft. Then open PowerShell in that folder.`,
          code: `cd C:\\Minecraft\\${c.folder}`,
          caution:
            c.storage === "folder"
              ? "Worlds kept in a Windows folder run slowly under Docker and can get corrupted. Choose “Docker volume” storage in the Server step."
              : undefined,
        },
        run,
        logs,
      ];
    case "mac":
      return [
        {
          title: "Install Docker Desktop",
          body: DOCKER_DESKTOP,
          caution: `Docker Desktop gives containers a fixed amount of memory. In Settings → Resources, set Memory to at least ${need} GB, or Java is killed while starting.`,
        },
        { title: "Unzip the kit", body: "Open Terminal and run:", code: `mkdir -p ~/minecraft && unzip ~/Downloads/${c.zip} -d ~/minecraft\ncd ~/minecraft/${c.folder}` },
        run,
        logs,
      ];
    case "linux":
      return [
        {
          title: "Install Docker Engine",
          body: `Includes the Compose plugin. ${DOCKER_ENGINE}`,
          caution: `Use Docker Engine, not Docker Desktop: Desktop runs containers in a virtual machine with its own memory limit, often below the ${need} GB this server needs. If both are installed, run docker context use default first.`,
        },
        { title: "Unzip the kit", body: "In a terminal:", code: `mkdir -p ~/minecraft && unzip ~/Downloads/${c.zip} -d ~/minecraft\ncd ~/minecraft/${c.folder}` },
        run,
        logs,
      ];
    case "nas":
      return [
        {
          title: "Create a stack",
          body: "In Portainer, Unraid or TrueNAS, create a new stack (or compose app) and paste the contents of docker-compose.yml.",
          caution:
            c.storage === "folder"
              ? "Stacks often break on relative paths like ./data. Choose “Docker volume” storage in the Server step, or replace ./data with an absolute path such as /mnt/user/appdata/" + c.folder + "."
              : undefined,
        },
        { title: "Deploy it", body: "Deploy the stack, then open the container logs and wait for Done (…)! For help, type \"help\"." },
      ];
  }
}

export interface ConnectTip {
  title: string;
  body: string;
}

export function connectTips(port: number, extraPorts: string[]): ConnectTip[] {
  const forward = [`${port}/tcp`, ...extraPorts.map((p) => p.split(":")[1])].join(", ");
  return [
    { title: "On the same computer", body: `Add a server with the address localhost:${port}.` },
    {
      title: "On the same network",
      body: `Use this computer's local IP, e.g. 192.168.1.20:${port}. Find it with ipconfig (Windows), ipconfig getifaddr en0 (macOS) or hostname -I (Linux).`,
    },
    {
      title: "Friends over the internet",
      body: `Forward ${forward} on your router to this computer, then share your public IP. Turn on the whitelist first so only your friends can join.`,
    },
    {
      title: "If port forwarding does not work",
      body:
        "Your provider may use CGNAT: the router's WAN address starts with 100.64–100.127 or differs from your public IP. " +
        "Use a free tunnel such as playit.gg, or put everyone on a private network with Tailscale.",
    },
  ];
}

export interface Trouble {
  symptom: string;
  fix: string;
}

export const TROUBLESHOOTING: Trouble[] = [
  {
    symptom: "“Unsupported class file major version” or “class file version 65”",
    fix: "Wrong Java for this Minecraft version. Keep the image tag from the generated file (for example :java21); it is chosen for your version.",
  },
  {
    symptom: "The server restarts over and over after changing mods",
    fix: "Run docker compose logs mc and look for “requires” or “HARD_DEP”. A mod is missing a dependency or does not fit this version. Regenerate the file here; it resolves dependencies for you.",
  },
  {
    symptom: "Players get “Mismatched mod list”, “Failed to decode packet” or a registry error",
    fix: "Their mods differ from the server's. Have them empty their mods folder and copy in the one from the latest kit's players folder.",
  },
  {
    symptom: "Modrinth answers 429 (rate limited) while the server starts",
    fix: "Too many downloads in a short time. Wait a minute and run docker compose up -d again.",
  },
  {
    symptom: "“You are not white-listed on this server”",
    fix: "Add the player in the Server step and apply the new file, or run docker compose exec mc rcon-cli whitelist add NAME.",
  },
  {
    symptom: "The server restarts within seconds with no error, “exitCode: -1” or exit code 137, or the computer slows to a crawl",
    fix:
      "Out of memory: Java was killed. Docker Desktop caps memory for all containers (Settings → Resources, or .wslconfig on Windows); " +
      "the cap must be the memory setting plus 2 GB. Otherwise lower the memory setting so 1–2 GB stay free for the system, or remove heavy mods.",
  },
  {
    symptom: "“Overworld settings missing” or “Unable to read or access the world gen settings file”",
    fix:
      "The first start was interrupted before the world was saved, leaving an empty world behind. Fix the reason it stopped, " +
      "then delete that world with docker compose run --rm --entrypoint rm mc -rf /data/world and start again. Only do this if nobody has played yet.",
  },
  {
    symptom: "“Failed to download icon” and the container restarts",
    fix: "The image host blocks downloads (wikis such as Fandom, Discord). Use a direct link to a PNG or JPG in the Server step and apply the new file.",
  },
  {
    symptom: "“Failed to load OpenCL” or another GPU error",
    fix: "A GPU acceleration mod, such as C2ME's OpenCL add-on, cannot reach a graphics driver inside Docker. Remove it in the Mods step.",
  },
];

export const EVERYDAY_COMMANDS: { command: string; what: string }[] = [
  { command: "docker compose exec mc rcon-cli", what: "Server console, e.g. op YourName. Type exit to leave." },
  { command: "docker compose down", what: "Stop the server. The world is kept." },
  { command: "docker compose up -d", what: "Start again, or apply an updated compose file." },
  { command: "docker compose pull && docker compose up -d", what: "Update the server image." },
];
