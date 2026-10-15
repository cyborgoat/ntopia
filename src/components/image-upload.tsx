import { useState } from "react";
import { Button } from "@/components/ui/button";
import { errorMessage, orbit } from "@/lib/orbit";

/** Uploads an image to team-orbit and returns its server-relative URL. */
export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const { data, error } = await orbit.POST("/uploads", { body: { file: "" }, bodySerializer: () => form });
  if (!data) throw new Error(errorMessage(error));
  return data.url;
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
