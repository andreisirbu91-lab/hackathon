"use client";

export type Attachment = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string; // "data:image/png;base64,..."
};

export const MAX_BYTES = 5 * 1024 * 1024; // 5MB per attachment
export const MAX_ATTACHMENTS = 4;
export const SUPPORTED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

export async function fileToAttachment(file: File): Promise<Attachment | { error: string }> {
  if (!SUPPORTED_TYPES.includes(file.type)) {
    return { error: `Unsupported type: ${file.type}. Allowed: PNG, JPEG, GIF, WebP.` };
  }
  if (file.size > MAX_BYTES) {
    return { error: `Too large: ${(file.size / 1024 / 1024).toFixed(1)}MB > ${MAX_BYTES / 1024 / 1024}MB` };
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
  return {
    id: crypto.randomUUID(),
    name: file.name,
    mimeType: file.type,
    size: file.size,
    dataUrl,
  };
}

// Convert a data URL ("data:image/png;base64,XXXX") into an Anthropic content block.
export function attachmentToContentBlock(att: Attachment) {
  const match = att.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return {
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: match[1] as "image/png" | "image/jpeg" | "image/gif" | "image/webp",
      data: match[2],
    },
  };
}
