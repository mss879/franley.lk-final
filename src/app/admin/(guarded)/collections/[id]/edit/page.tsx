import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink, House } from "lucide-react";
import { AdminPageShell } from "@/components/admin/page-shell";
import { CollectionForm } from "@/components/admin/collections/collection-form";
import { CollectionProducts } from "@/components/admin/collections/collection-products";
import { updateCollection } from "../../actions";
import { getCollection, getCollectionMembers, listPickerProducts } from "../../data";
import { getHomeSections } from "../../../content/home-sections";

type Params = { params: Promise<{ id: string }> };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const collection = UUID_RE.test(id) ? await getCollection(id) : null;
  return { title: collection ? `Edit ${collection.name}` : "Collection" };
}

export default async function EditCollectionPage({ params }: Params) {
  const { id } = await params;
  // A malformed id would come back from PostgREST as a 400, not an empty row.
  if (!UUID_RE.test(id)) notFound();

  const collection = await getCollection(id);
  if (!collection) notFound();

  const [members, picker, sections] = await Promise.all([
    getCollectionMembers(id),
    listPickerProducts(),
    getHomeSections().catch(() => []),
  ]);
  // The home-page sections this collection fills, so the owner knows editing
  // it changes the home page.
  const onHome = sections.filter((s) => s.collection?.id === collection.id && s.shown);
  // The storefront 404s a collection with no active products, so only link to a real page.
  const visible = collection.isActive && members.some((m) => m.status === "active");

  return (
    <AdminPageShell
      title={collection.name}
      description={`Editing the collection at /collections/${collection.slug}.`}
    >
      <div className="mb-6 flex flex-wrap items-center gap-5">
        <Link
          href="/admin/collections"
          className="inline-flex items-center gap-1.5 text-xs text-ink-600 transition-colors hover:text-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
        >
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
          All collections
        </Link>
        {visible && (
          <Link
            href={`/collections/${collection.slug}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 text-xs text-ink-600 transition-colors hover:text-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
          >
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
            View on the storefront
          </Link>
        )}
      </div>

      {onHome.length > 0 && (
        <div className="mb-8 flex max-w-3xl items-start gap-3 rounded-2xl border border-wine-700/25 bg-wine-700/5 px-5 py-4 text-sm leading-relaxed text-ink-800">
          <House className="mt-0.5 h-4 w-4 shrink-0 text-wine-700" strokeWidth={1.5} aria-hidden />
          <p>
            This collection fills the{" "}
            <span className="font-medium">{onHome.map((s) => s.name).join(" and ")}</span>{" "}
            {onHome.length === 1 ? "section" : "sections"} of the home page. The first eight products
            below, in this order, are what shoppers see there. To change the heading, go to{" "}
            <Link
              href={onHome[0].blockId ? `/admin/content/${onHome[0].blockId}` : "/admin/content"}
              className="text-wine-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              Home page &amp; Banners
            </Link>
            .
          </p>
        </div>
      )}

      <div className="max-w-3xl space-y-10">
        <CollectionForm
          action={updateCollection}
          submitLabel="Save changes"
          initial={{
            id: collection.id,
            name: collection.name,
            slug: collection.slug,
            description: collection.description ?? "",
            heroEyebrow: collection.heroEyebrow ?? "",
            position: collection.position,
            isActive: collection.isActive,
            imageUrl: collection.imageUrl ?? "",
          }}
        />

        <section>
          <h2 className="font-display text-2xl text-ink-800">Products in this collection</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600">
            Shoppers see these in this order when the page opens on “Curated”. A product can sit
            in any number of collections; taking it out of this one does not touch the product.
          </p>
          <div className="mt-5">
            <CollectionProducts
              collectionId={collection.id}
              collectionName={collection.name}
              members={members}
              picker={picker}
            />
          </div>
        </section>
      </div>
    </AdminPageShell>
  );
}
