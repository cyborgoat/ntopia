import { join } from "@tauri-apps/api/path";
import { readFile } from "@tauri-apps/plugin-fs";
import type { ImageIO } from "@goatcheese/mdmailer-core";
import { MIME_BY_EXT } from "./assets";
import { workDir } from "./paths";

const isAbsolute = (ref: string) => ref.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(ref);

/** SVGs are drawn at this multiple of their intrinsic size so the PNG stays sharp when mail clients scale it down. */
const SVG_SCALE = 2;

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not decode the image.")); };
    img.src = url;
  });
}

/** Image access for mdmailer-core: files via Tauri fs (relative refs resolve against the work folder), SVG/PNG handling via canvas. */
export const imageIO: ImageIO = {
  async read(ref) {
    const path = isAbsolute(ref) ? ref : await join(await workDir(), ...ref.replace(/^\.\//, "").split("/"));
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    const mime = MIME_BY_EXT[ext];
    if (!mime) throw new Error(`Unsupported image file type ".${ext}" for "${ref}". Use .svg, .png, .jpg, .gif, or .webp.`);
    return { bytes: await readFile(path), mime };
  },

  async measure({ bytes, mime }) {
    const bitmap = await createImageBitmap(new Blob([bytes as BlobPart], { type: mime }));
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  },

  async rasterize({ bytes, mime }, { height }) {
    const img = await loadImage(new Blob([bytes as BlobPart], { type: mime }));
    // SVGs without intrinsic dimensions report 0×0; fall back to a sensible box.
    const naturalW = img.naturalWidth || 300;
    const naturalH = img.naturalHeight || 150;
    const outH = height ?? Math.round(naturalH * SVG_SCALE);
    const outW = Math.max(1, Math.round((naturalW / naturalH) * outH));
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    canvas.getContext("2d")!.drawImage(img, 0, 0, outW, outH);
    const png = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not rasterize the SVG."))), "image/png"),
    );
    return { bytes: new Uint8Array(await png.arrayBuffer()), mime: "image/png", width: outW, height: outH };
  },
};
