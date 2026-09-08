import Link from "next/link";
import { CornerDownRight, ImageOff } from "lucide-react";
import type { CategoryNode } from "@/app/admin/(guarded)/categories/data";
import { cn } from "@/lib/utils";
import { CategoryRowActions, CategoryStatusToggle } from "./row-actions";

type FlatRow = {
  node: CategoryNode;
  depth: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
};

function flatten(nodes: CategoryNode[], depth = 0): FlatRow[] {
  return nodes.flatMap((node, i) => [
    { node, depth, canMoveUp: i > 0, canMoveDown: i < nodes.length - 1 },
    ...flatten(node.children, depth + 1),
  ]);
}

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
    // A category banner may be a site-relative path, a storage key or any https
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

function ProductCount({ node }: { node: CategoryNode }) {
  const hasChildren = node.children.length > 0;
  const total = node.rollupLiveCount + node.hiddenCount;

  if (total === 0) {
    return <span className="text-sm text-ink-600">None yet</span>;
  }

  return (
    <div>
      <p className="font-display text-lg leading-none text-ink-800">
        {node.rollupLiveCount}
        <span className="ml-1.5 font-sans text-xs font-normal text-ink-600">live</span>
      </p>
      {hasChildren && node.rollupLiveCount !== node.liveCount && (
        <p className="mt-1 text-xs text-ink-600">
          {node.liveCount} here, {node.rollupLiveCount - node.liveCount} in sub-categories
        </p>
      )}
      {node.hiddenCount > 0 && (
        <p className="mt-1 text-xs text-ink-600">
          {node.hiddenCount} draft or archived
        </p>
      )}
    </div>
  );
}

export function CategoryTable({ tree }: { tree: CategoryNode[] }) {
  const rows = flatten(tree);

  return (
    <div className="overflow-hidden rounded-3xl border border-cream-300 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] border-collapse text-left">
          <caption className="sr-only">
            Franley categories, parents followed by their sub-categories.
          </caption>
          <thead>
            <tr className="border-b border-cream-300 bg-cream-100/70">
              <th scope="col" className="eyebrow px-6 py-4 text-ink-600">
                Category
              </th>
              <th scope="col" className="eyebrow px-6 py-4 text-ink-600">
                Products
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
            {rows.map(({ node, depth, canMoveUp, canMoveDown }) => (
              <tr
                key={node.id}
                className={cn(
                  "border-b border-cream-300/70 last:border-b-0 transition-colors duration-200 hover:bg-cream-50",
                  !node.isActive && "bg-cream-100/40",
                )}
              >
                <th scope="row" className="px-6 py-4 font-normal">
                  <div className={cn("flex items-center gap-3", depth > 0 && "pl-6 md:pl-10")}>
                    {depth > 0 && (
                      <CornerDownRight
                        className="h-4 w-4 shrink-0 text-ink-400"
                        strokeWidth={1.5}
                        aria-hidden
                      />
                    )}
                    <Thumbnail url={node.imageUrl} />
                    <div className="min-w-0">
                      <Link
                        href={`/admin/categories/${node.id}/edit`}
                        className={cn(
                          "font-display text-base text-ink-800 transition-colors hover:text-wine-700",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 rounded-sm",
                          !node.isActive && "text-ink-400",
                        )}
                      >
                        {node.name}
                      </Link>
                      <p className="mt-0.5 truncate text-xs text-ink-600">/{node.slug}</p>
                      {node.description && (
                        <p className="mt-1 max-w-[34ch] truncate text-xs text-ink-600">
                          {node.description}
                        </p>
                      )}
                    </div>
                  </div>
                </th>

                <td className="px-6 py-4 align-middle">
                  <ProductCount node={node} />
                </td>

                <td className="px-6 py-4 align-middle">
                  <CategoryStatusToggle id={node.id} name={node.name} isActive={node.isActive} />
                </td>

                <td className="px-6 py-4 align-middle">
                  <CategoryRowActions
                    id={node.id}
                    name={node.name}
                    canMoveUp={canMoveUp}
                    canMoveDown={canMoveDown}
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
