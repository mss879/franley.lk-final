"use client";

import { AssetImageField } from "@/components/admin/shared/image-field";

/** The category tile picture. The upload and address handling live in the shared field. */
export function CategoryImageField({
  value,
  onChange,
  serverError,
}: {
  value: string;
  onChange: (next: string) => void;
  serverError?: string;
}) {
  return (
    <AssetImageField
      value={value}
      onChange={onChange}
      serverError={serverError}
      label="Tile image"
      help="Shown on the homepage collection tiles. Leave it empty and the storefront falls back to the bundled editorial banner for this collection — a new collection has none, so its tile would render as a plain dark card."
      folder="banners"
    />
  );
}
