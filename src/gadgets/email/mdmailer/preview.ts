import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { Child, Command } from "@tauri-apps/plugin-shell";
import { clearPastedImages, writeWorking } from "./assets";
import { ensureConfig } from "./branding";
import { cliPath, configPath, ensureWorkspace, workDir, workPath } from "./paths";

let previewChild: Child | null = null;
let previewGeneration = 0;

const PREVIEW_URL_RE = /https?:\/\/127\.0\.0\.1:\d+/;

export type PreviewState = {
  file: string;
  version: number;
  updating: boolean;
  error: string;
  html?: string;
};

/** Stop the running mdmailer preview server, if any. */
async function stopPreview() {
  previewGeneration++;
  const child = previewChild;
  previewChild = null;
  if (child) {
    try {
      // Never let a stuck kill block the next start.
      await withTimeout(child.kill(), 2_000, "kill");
    } catch {
      /* already exited or unresponsive */
    }
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`mdmailer preview: ${what} timed out`)), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

// One shared preview session per app. React StrictMode and Fast Refresh mount/unmount the composer
// in quick succession; reference-counting keeps them on the same server instead of racing two starts.
let session: Promise<{ url: string }> | null = null;
let sessionUsers = 0;
let stopTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Start (or join) the live preview session. A fresh session resets the working file to `initialDoc`.
 * Rejects within ~25s instead of hanging. Pair every call with `releasePreview()`.
 */
export function acquirePreview(initialDoc: string, opts: { keepImages?: boolean } = {}): Promise<{ url: string }> {
  sessionUsers++;
  clearTimeout(stopTimer);
  if (!session) {
    const s = withTimeout(
      (async () => {
        if (!opts.keepImages) await clearPastedImages();
        await writeWorking(initialDoc);
        return startPreview();
      })(),
      25_000,
      "start",
    );
    session = s;
    s.catch(() => {
      if (session === s) session = null;
    });
  }
  return session;
}

export function releasePreview() {
  sessionUsers = Math.max(0, sessionUsers - 1);
  if (sessionUsers > 0) return;
  clearTimeout(stopTimer);
  stopTimer = setTimeout(() => {
    if (sessionUsers > 0) return;
    session = null;
    void stopPreview();
  }, 500);
}

/** Drop the current session (e.g. after an error) so the next acquire starts a new server. */
export async function resetPreview() {
  session = null;
  await stopPreview();
}

/**
 * Start `mdmailer preview` for the working file on a free port.
 * Restarts if a previous preview is still running.
 */
async function startPreview(): Promise<{ url: string }> {
  await ensureWorkspace();
  await ensureConfig();
  await stopPreview();

  const generation = previewGeneration;
  const cfg = await configPath();
  const cmd = Command.sidecar(
    "binaries/node",
    [await cliPath(), "preview", await workPath(), "--config", cfg, "--port", "0"],
    { cwd: await workDir() },
  );

  let settled = false;
  let buf = "";
  const spawned = { child: null as Child | null };

  try {
    const url = await new Promise<string>((resolve, reject) => {
      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        fn();
      };
      const timeout = setTimeout(() => {
        finish(() => reject(new Error("mdmailer preview did not start (timed out waiting for URL)")));
      }, 15_000);

      const onChunk = (chunk: string) => {
        buf += chunk;
        const m = buf.match(PREVIEW_URL_RE);
        if (m) finish(() => resolve(m[0]));
      };

      cmd.stdout.on("data", onChunk);
      cmd.stderr.on("data", onChunk);
      cmd.on("error", (e) => finish(() => reject(new Error(e))));
      cmd.on("close", ({ code }) => {
        finish(() => reject(new Error(`mdmailer preview exited early (code ${code ?? "?"})`)));
      });

      void cmd
        .spawn()
        .then((child) => {
          spawned.child = child;
          if (generation === previewGeneration) previewChild = child;
          else void child.kill().catch(() => {});
        })
        .catch((e) => {
          finish(() => reject(e instanceof Error ? e : new Error(String(e))));
        });
    });

    if (generation !== previewGeneration) {
      if (spawned.child) void spawned.child.kill().catch(() => {});
      throw new Error("Preview superseded");
    }

    return { url };
  } catch (e) {
    if (generation === previewGeneration) {
      previewChild = null;
      if (spawned.child) {
        try {
          await spawned.child.kill();
        } catch {
          /* already exited */
        }
      }
    }
    throw e;
  }
}

/** Poll the preview server `/state` endpoint (bypasses webview CORS via Tauri HTTP). */
export async function fetchPreviewState(url: string, version: number): Promise<PreviewState> {
  const res = await tauriFetch(`${url}/state?version=${version}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Preview server returned ${res.status}`);
  return (await res.json()) as PreviewState;
}
