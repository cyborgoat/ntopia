import { join } from "@tauri-apps/api/path";
import { copyFile, exists, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { blobUrlFor } from "./assets";
import { brandingPath, ensureWorkspace, root } from "./paths";

export type Branding = {
  organization: string;
  tagline: string;
  footerText: string;
  /** File name of a logo inside the branding folder. */
  logo: string;
};

export const DEFAULT_BRANDING: Branding = {
  organization: "My Team",
  tagline: "",
  footerText: "© {{organization}}",
  logo: "logo.svg",
};

/** mdmailer requires a primary color; the visible look comes from the theme preset chosen per email. */
const PRIMARY_COLOR = "#111827";

export async function loadBranding(): Promise<Branding> {
  await ensureWorkspace();
  const p = await brandingPath();
  if (!(await exists(p))) return DEFAULT_BRANDING;
  const saved = JSON.parse(await readTextFile(p)) as Partial<Branding>;
  // Pick known keys only, which also drops the old primaryColor/preset fields.
  return {
    organization: saved.organization ?? DEFAULT_BRANDING.organization,
    tagline: saved.tagline ?? DEFAULT_BRANDING.tagline,
    footerText: saved.footerText ?? DEFAULT_BRANDING.footerText,
    logo: saved.logo ?? DEFAULT_BRANDING.logo,
  };
}

export async function saveBranding(b: Branding) {
  await ensureWorkspace();
  await writeTextFile(await brandingPath(), JSON.stringify(b, null, 2));
}

/** Copy a user-picked logo into the branding folder. */
export async function setLogo(sourcePath: string): Promise<string> {
  const ext = sourcePath.split(".").pop()?.toLowerCase() || "png";
  const name = `logo-custom.${ext}`;
  await copyFile(sourcePath, await join(await root(), name));
  return name;
}

/** Blob URL for a logo in the branding folder; the caller revokes it. */
export async function logoBlobUrl(name: string): Promise<string> {
  return blobUrlFor(await join(await root(), name));
}

/** The mdmailer config for the saved branding. The logo is an absolute path so the image reader needs no base dir. */
export async function buildConfig() {
  const b = await loadBranding();
  return {
    organization: { name: b.organization, logoUrl: await join(await root(), b.logo) },
    theme: {
      primaryColor: PRIMARY_COLOR,
      ...(b.tagline && { tagline: b.tagline }),
      footerText: b.footerText,
    },
  };
}
