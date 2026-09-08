import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AdminPageShell } from "@/components/admin/page-shell";
import { requireAdmin } from "@/lib/supabase/admin-guard";
import { createClient } from "@/lib/supabase/server";
import { parseFields, type ContentBlockRow } from "@/components/admin/content/types";
import { BlockForm } from "@/components/admin/content/block-form";
import { updateContentBlock } from "../actions";

export const metadata: Metadata = { title: "Edit content" };
export const dynamic = "force-dynamic";

const COLUMNS =
  "id, page, key, label, help, payload, fields, is_locked, published, position, publish_at, unpublish_at, updated_at";

export default async function ContentBlockEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const supabase = await createClient();
  const { data } = await supabase
    .from("content_blocks")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();

  const block = data as unknown as ContentBlockRow;
  const fields = parseFields(block.fields);

  return (
    <AdminPageShell
      className="max-w-[1500px]"
      title={block.label || block.key}
      description={block.help ?? undefined}
    >
      <BlockForm block={block} fields={fields} action={updateContentBlock} />
    </AdminPageShell>
  );
}
