import Link from "next/link";
import { ImageOff } from "lucide-react";
import type { CollectionListRow } from "@/app/admin/(guarded)/collections/data";
import { cn } from "@/lib/utils";
import { CollectionRowActions, CollectionStatusToggle } from "./row-actions";

function Thumbnail({ url }: { url: string | null }) {
  if (!url) {
    return (
      <span
        aria-hidden
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-cream-300 bg-cream-100 text-ink-400"
      >
        <ImageOff className="h-4 w-4" strokeWidth={1.5} />
      </span>
    );
  }
  return (
    // A hero image may be a site-relative path, a storage key or any https
    // host, so next/image's remotePatterns allowlist would reject valid values.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      width={44}
      height={44}
      className="h-11 w-11 shrink-0 rounded-xl border border-cream-300 bg-cream-100 object-cover"
    />
  );
}

export function CollectionTable({ rows }: { rows: CollectionListRow[] }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-cream-300 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] border-collapse text-left">
          <caption className="sr-only">Franley collections, in storefront order.</caption>
          <thead>
            <tr className="border-b border-cream-300 bg-cream-100/70">
              <th scope="col" className="eyebrow px-6 py-4 text-ink-600">
                Collection
              </th>
              <th scope="col" className="eyebrow px-6 py-4 text-ink-600">
                Products
              </th>
              <th scope="col" className="eyebrow px-6 py-4 text-ink-600">
                Position
              </th>
              <th scope="col" className="eyebrow px-6 py-4 text-ink-600">
                Storefront
              </th>
              <th scope="col" className="px-6 py-4 text-right">
                <span className="eyebrow text-ink-600">Manage</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.id}
                className={cn(
                  "border-b border-cream-300/70 last:border-b-0 transition-colors duration-200 hover:bg-cream-50",
                  !row.isActive && "bg-cream-100/40",
                )}
              >
                <th scope="row" className="px-6 py-4 font-normal">
                  <div className="flex items-center gap-3">
                    <Thumbnail url={row.imageUrl} />
                    <div className="min-w-0">
                      <Link
                        href={`/admin/collections/${row.id}/edit`}
                        className={cn(
                          "font-display text-base text-ink-800 transition-colors hover:text-wine-700",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 rounded-sm",
                          !row.isActive && "text-ink-400",
                        )}
                      >
                        {row.name}
                      </Link>
                      <p className="mt-0.5 truncate text-xs text-ink-600">/collections/{row.slug}</p>
                      {row.description && (
                        <p className="mt-1 max-w-[34ch] truncate text-xs text-ink-600">
                          {row.description}
                        </p>
                      )}
                    </div>
                  </div>
                </th>

                <td className="px-6 py-4 align-middle">
                  {row.memberCount === 0 ? (
                    <span className="text-sm text-ink-600">None yet</span>
                  ) : (
                    <div>
                      <p className="font-display text-lg leading-none text-ink-800">
                        {row.liveCount}
                        <span className="ml-1.5 font-sans text-xs font-normal text-ink-600">live</span>
                      </p>
                      {row.memberCount > row.liveCount && (
                        <p className="mt-1 text-xs text-ink-600">
                          {row.memberCount - row.liveCount} draft or archived
                        </p>
                      )}
                    </div>
                  )}
                </td>

                <td className="px-6 py-4 align-middle text-sm tabular-nums text-ink-800">
                  {row.position}
                </td>

                <td className="px-6 py-4 align-middle">
                  <CollectionStatusToggle
                    id={row.id}
                    name={row.name}
                    isActive={row.isActive}
                    hasLiveProducts={row.liveCount > 0}
                  />
                  {row.isActive && row.liveCount === 0 && (
                    <p className="mt-1.5 max-w-[15rem] text-xs leading-relaxed text-ink-600">
                      Not on the storefront until it holds an active product.
                    </p>
                  )}
                </td>

                <td className="px-6 py-4 align-middle">
                  <CollectionRowActions
                    id={row.id}
                    name={row.name}
                    memberCount={row.memberCount}
                    canMoveUp={i > 0}
                    canMoveDown={i < rows.length - 1}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
