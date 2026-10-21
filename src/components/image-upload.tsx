import { useState } from "react";
import { Button } from "@/components/ui/button";
import { errorMessage, orbit } from "@/lib/orbit";

/** Uploads an image to team-orbit and returns its server-relative URL. */
export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const { data, error } = await orbit.POST("/api/uploads", { body: { file: "" }, bodySerializer: () => form });
  if (!data) throw new Error(errorMessage(error));
  return data.url;
}

const staged = new Map<string, { file: File; url?: string }>();

/**
 * Editor image handler: keeps the file in memory and returns a `blob:` URL for preview.
 * Nothing is sent to the server until `uploadStagedImages` runs on submit.
 */
export async function stageImage(file: File): Promise<string> {
  const blobUrl = URL.createObjectURL(file);
  staged.set(blobUrl, { file });
  return blobUrl;
}

/** Uploads the staged images referenced by `markdown` and returns it with server URLs swapped in. */
export async function uploadStagedImages(markdown: string): Promise<string> {
  let out = markdown;
  for (const blobUrl of new Set(markdown.match(/blob:[^\s)"']+/g) ?? [])) {
    const entry = staged.get(blobUrl);
    if (!entry) continue;
    entry.url ??= await uploadImage(entry.file); // cached so a retry after a failed submit doesn't re-upload
    out = out.split(blobUrl).join(entry.url);
  }
  return out;
}

/** Frees the in-memory copies of staged images referenced by `markdown` once it has been submitted. */
export function releaseStagedImages(markdown: string) {
  for (const blobUrl of markdown.match(/blob:[^\s)"']+/g) ?? []) {
    if (staged.delete(blobUrl)) URL.revokeObjectURL(blobUrl);
  }
}

export function ImageUploadButton({ onUploaded, label = "Upload image" }: { onUploaded: (url: string) => void; label?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <label>
      <input
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setBusy(true);
          try {
            onUploaded(await uploadImage(f));
          } finally {
            setBusy(false);
            e.target.value = "";
          }
        }}
      />
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={(e) => e.currentTarget.parentElement?.querySelector("input")?.click()}>
        {busy ? "Uploading…" : label}
      </Button>
    </label>
  );
}
