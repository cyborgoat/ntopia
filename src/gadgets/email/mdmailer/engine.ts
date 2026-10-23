import { buildConfig } from "./branding";
import { imageIO } from "./image-io";

// react-email and friends are heavy; keep them out of the startup bundle.
const loadCore = () => import("@goatcheese/mdmailer-core");

export type RenderRequest = {
  /** Also assemble the .eml (renders the plain-text alternative too). */
  eml?: boolean;
  /** Also capture the finished email as a PNG. */
  png?: boolean;
};

export type RenderOutput = {
  title: string;
  /** Final HTML: QR codes for links and baked image sizes applied. */
  html: string;
  eml?: string;
  png?: Uint8Array;
};

// One hidden iframe at a time: image sizes are measured from layout, and parallel renders would race.
let queue: Promise<unknown> = Promise.resolve();

/** Render Markdown to a finished email in-process. Calls are serialized. */
export function renderMarkdown(markdown: string, request: RenderRequest = {}): Promise<RenderOutput> {
  const run = queue.then(() => renderNow(markdown, request));
  queue = run.catch(() => {});
  return run;
}

async function renderNow(markdown: string, { eml, png }: RenderRequest): Promise<RenderOutput> {
  const core = await loadCore();
  const config = core.parseConfig(await buildConfig());
  const rendered = await core.renderEmail(markdown, { config, images: imageIO, plainText: Boolean(eml) });

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = `position:fixed;left:-99999px;top:0;width:${rendered.contentWidth}px;height:800px;border:0`;
  try {
    const loaded = new Promise<void>((resolve) => { frame.onload = () => resolve(); });
    frame.srcdoc = rendered.html;
    document.body.append(frame);
    await loaded;
    const doc = frame.contentDocument!;

    const { qrImages } = await core.postProcessDocument(doc);
    const html = core.serializeDocument(doc);
    const out: RenderOutput = { title: rendered.title, html };
    if (eml) {
      out.eml = core.buildEml({
        subject: rendered.title,
        html,
        text: rendered.text,
        attachments: core.collectEmlAttachments(rendered, qrImages),
      });
    }
    if (png) out.png = await capturePng(doc, rendered.contentWidth);
    return out;
  } finally {
    frame.remove();
  }
}

const BLANK_GIF = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

/**
 * Remote images can't be rasterized from the webview (CORS, offline, 404), so inline each one through the
 * native HTTP client first and blank the ones that fail. Only the PNG capture uses this; HTML/EML keep their URLs.
 */
async function inlineRemoteImages(doc: Document) {
  const { fetch: nativeFetch } = await import("@tauri-apps/plugin-http");
  const { toBase64 } = await loadCore();
  await Promise.all(
    Array.from(doc.images)
      .filter((img) => /^https?:/i.test(img.src))
      .map(async (img) => {
        try {
          const res = await nativeFetch(img.src);
          if (!res.ok) throw new Error(String(res.status));
          const mime = res.headers.get("content-type")?.split(";")[0] || "image/png";
          img.removeAttribute("srcset");
          img.src = `data:${mime};base64,${toBase64(new Uint8Array(await res.arrayBuffer()))}`;
        } catch {
          img.removeAttribute("srcset");
          img.src = BLANK_GIF;
        }
      }),
  );
}

async function capturePng(doc: Document, width: number): Promise<Uint8Array> {
  const { toBlob } = await import("html-to-image");
  await inlineRemoteImages(doc);
  const root = doc.documentElement;
  const blob = await toBlob(doc.body, {
    pixelRatio: 2,
    width,
    height: Math.ceil(Math.max(root.scrollHeight, doc.body.scrollHeight)),
    backgroundColor: doc.defaultView!.getComputedStyle(doc.body).backgroundColor || "#ffffff",
    imagePlaceholder: BLANK_GIF,
  });
  if (!blob) throw new Error("Could not capture the email as a PNG.");
  return new Uint8Array(await blob.arrayBuffer());
}
