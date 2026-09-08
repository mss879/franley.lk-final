import { createClient } from "@/lib/supabase/client";
import {
  ACCEPTED_MIME,
  MAX_UPLOAD_BYTES,
  MEDIA_BUCKET,
  formatBytes,
  newObjectKey,
} from "./media";

export type UploadedFile = {
  storage_path: string;
  mime_type: string;
  width: number;
  height: number;
  byte_size: number;
};

/**
 * Dimensions are read in the browser and stored on the row so the storefront
 * can hand next/image a width and height and avoid layout shift.
 */
async function readDimensions(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const img = document.createElement("img");
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("unreadable"));
      img.src = url;
    });
    return { width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function checkFile(file: File): string | null {
  if (!(ACCEPTED_MIME as readonly string[]).includes(file.type)) {
    return "That file type is not allowed. Use a JPG, PNG, WebP or AVIF image.";
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `That image is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_UPLOAD_BYTES)}.`;
  }
  return null;
}

/**
 * Puts the file straight into the cms-media bucket from the browser, so the
 * image bytes never round-trip through the Next.js server. RLS on
 * storage.objects is what authorises it.
 */
export async function uploadToBucket(
  file: File,
): Promise<{ ok: true; file: UploadedFile } | { ok: false; message: string }> {
  const problem = checkFile(file);
  if (problem) return { ok: false, message: problem };

  const path = newObjectKey(file.type);
  if (!path) return { ok: false, message: "That file type is not allowed." };

  let dimensions: { width: number; height: number };
  try {
    dimensions = await readDimensions(file);
  } catch {
    return { ok: false, message: "That image could not be read. Try re-saving it and upload again." };
  }
  if (!dimensions.width || !dimensions.height) {
    return { ok: false, message: "That image has no usable dimensions." };
  }

  const supabase = createClient();
  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) return { ok: false, message: `Upload failed: ${error.message}` };

  return {
    ok: true,
    file: {
      storage_path: path,
      mime_type: file.type,
      width: dimensions.width,
      height: dimensions.height,
      byte_size: file.size,
    },
  };
}

export function appendUploaded(formData: FormData, file: UploadedFile) {
  formData.set("storage_path", file.storage_path);
  formData.set("mime_type", file.mime_type);
  formData.set("width", String(file.width));
  formData.set("height", String(file.height));
  formData.set("byte_size", String(file.byte_size));
}
