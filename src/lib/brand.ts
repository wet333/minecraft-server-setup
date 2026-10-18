// Product identity and links in one place. Deployments override them with VITE_* variables.

export const APP_NAME = "MCServerSetup";
export const APP_TAGLINE = "Docker Compose builder for modded Fabric servers";

const env = import.meta.env as Record<string, string | undefined>;

export const REPO_URL = env.VITE_REPO_URL || "https://github.com/wet333/my-minecraft-server";
/** Where the generated files say they came from. */
export const APP_URL = env.VITE_APP_URL || REPO_URL;
/** Mojang's usage guidelines ask for a contact method other than chat or a forum. */
export const CONTACT_EMAIL = env.VITE_CONTACT_EMAIL || "";
export const ISSUES_URL = `${REPO_URL}/issues`;
