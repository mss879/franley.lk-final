import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AdminPageShell } from "@/components/admin/page-shell";
import { CollectionForm } from "@/components/admin/collections/collection-form";
import { createCollection } from "../actions";
import { listCollections, nextPosition } from "../data";

export const metadata: Metadata = { title: "New collection" };

export default async function NewCollectionPage() {
  const all = await listCollections();

  return (
    <AdminPageShell
      title="New collection"
      description="Name it and set its address first. Products are added from the edit page once it exists."
    >
      <Link
        href="/admin/collections"
        className="mb-6 inline-flex items-center gap-1.5 text-xs text-ink-600 transition-colors hover:text-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
      >
        <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
        All collections
      </Link>

      <div className="max-w-3xl">
        <CollectionForm
          action={createCollection}
          submitLabel="Create collection"
          initial={{
            name: "",
            slug: "",
            description: "",
            heroEyebrow: "",
            position: nextPosition(all),
            isActive: true,
            imageUrl: "",
          }}
        />
      </div>
    </AdminPageShell>
  );
}
