/**
 * The form-schema-as-data contract from 0004_media_and_cms.sql / 0009_seed_cms.sql.
 *
 * Each content_blocks row carries a `fields` array describing the form to draw
 * for its `payload`. Nothing here is hardcoded per block: adding a field to the
 * homepage hero is an UPDATE on that row, not a code change.
 */

export const ROOT_FIELD = "$root";

/** Shared shape for every server action on this section, for useActionState. */
export type ActionState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
} | null;

export const FIELD_TYPES = [
  "text",
  "textarea",
  "url",
  "link",
  "image",
  "media",
  "boolean",
  "number",
  "select",
  "string_list",
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export type SelectOption = { value: string; label: string };

export type FieldDescriptor = {
  /** Dotted path into payload ("primaryCta.label"), or "$root" when the payload itself is the value. */
  name: string;
  label: string;
  help: string | null;
  type: FieldType;
  required: boolean;
  maxLength: number | null;
  rows: number | null;
  maxItems: number | null;
  options: SelectOption[];
};

export type ContentBlockRow = {
  id: string;
  page: string;
  key: string;
  label: string;
  help: string | null;
  payload: unknown;
  fields: unknown;
  is_locked: boolean;
  published: boolean;
  position: number;
  publish_at: string | null;
  unpublish_at: string | null;
  updated_at: string;
};

const TYPE_SET = new Set<string>(FIELD_TYPES);

function toOptions(raw: unknown): SelectOption[] {
  if (!Array.isArray(raw)) return [];
  const out: SelectOption[] = [];
  for (const entry of raw) {
    if (typeof entry === "string") out.push({ value: entry, label: entry });
    else if (entry && typeof entry === "object") {
      const o = entry as Record<string, unknown>;
      const value = typeof o.value === "string" ? o.value : null;
      if (value) out.push({ value, label: typeof o.label === "string" ? o.label : value });
    }
  }
  return out;
}

function toPositiveInt(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

/** Tolerant parse: a malformed descriptor is skipped rather than breaking the page. */
export function parseFields(raw: unknown): FieldDescriptor[] {
  if (!Array.isArray(raw)) return [];
  const out: FieldDescriptor[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const o = entry as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name.trim() : "";
    if (!name) continue;
    const type = typeof o.type === "string" && TYPE_SET.has(o.type) ? (o.type as FieldType) : "text";
    out.push({
      name,
      label: typeof o.label === "string" && o.label.trim() ? o.label.trim() : name,
      help: typeof o.help === "string" && o.help.trim() ? o.help.trim() : null,
      type,
      required: o.required === true,
      maxLength: toPositiveInt(o.max_length),
      rows: toPositiveInt(o.rows),
      maxItems: toPositiveInt(o.max_items),
      options: toOptions(o.options),
    });
  }
  return out;
}

export function isImageField(type: FieldType) {
  return type === "image" || type === "media";
}

export function isLinkField(type: FieldType) {
  return type === "link" || type === "url";
}

/* ---------------------------------------------------------------- payload paths */

export function getAtPath(source: unknown, path: string): unknown {
  if (path === ROOT_FIELD) return source;
  let cursor: unknown = source;
  for (const segment of path.split(".")) {
    if (!cursor || typeof cursor !== "object" || Array.isArray(cursor)) return undefined;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
}

/**
 * Immutably writes `value` at a dotted path, cloning only the objects on the
 * way down. Keys the form never rendered ride along untouched — that is the
 * whole reason this is a merge and not a rebuild.
 */
export function setAtPath(
  source: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const [head, ...rest] = path.split(".");
  const next = { ...source };
  if (rest.length === 0) {
    next[head] = value;
    return next;
  }
  const child = next[head];
  const base =
    child && typeof child === "object" && !Array.isArray(child)
      ? (child as Record<string, unknown>)
      : {};
  next[head] = setAtPath(base, rest.join("."), value);
  return next;
}

/** The value the form starts with, as a string for text-ish controls. */
export function initialValue(payload: unknown, field: FieldDescriptor): string | boolean {
  const raw = getAtPath(payload, field.name);
  if (field.type === "boolean") return raw === true;
  if (field.type === "string_list") {
    if (Array.isArray(raw)) return raw.filter((v) => typeof v === "string").join("\n");
    return "";
  }
  if (raw === null || raw === undefined) return "";
  if (typeof raw === "string") return raw;
  if (typeof raw === "number") return String(raw);
  return "";
}

/**
 * Rebuilds a payload from the current form values. Used for the live preview;
 * the server action re-derives (and validates) the same shape independently.
 */
export function buildPayload(
  fields: FieldDescriptor[],
  values: Record<string, string | boolean>,
  basePayload: unknown,
): unknown {
  const root = fields.find((f) => f.name === ROOT_FIELD);
  if (root) return coerceValue(values[ROOT_FIELD], root);

  let out: Record<string, unknown> =
    basePayload && typeof basePayload === "object" && !Array.isArray(basePayload)
      ? { ...(basePayload as Record<string, unknown>) }
      : {};

  for (const field of fields) {
    out = setAtPath(out, field.name, coerceValue(values[field.name], field));
  }
  return out;
}

function coerceValue(raw: string | boolean | undefined, field: FieldDescriptor): unknown {
  if (field.type === "boolean") return raw === true;
  const text = typeof raw === "string" ? raw : "";
  if (field.type === "string_list") {
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }
  if (field.type === "number") {
    const n = Number(text);
    return text.trim() === "" || !Number.isFinite(n) ? null : n;
  }
  return text;
}

/* ---------------------------------------------------------------- plain English */

const PAGE_LABELS: Record<string, string> = {
  home: "Home page",
  global: "Every page",
};

export function pageLabel(page: string) {
  return PAGE_LABELS[page] ?? page.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/** Where on the storefront a block shows up, in words the client can act on. */
const BLOCK_LOCATIONS: Record<string, string> = {
  "home:hero": "The big burgundy band at the top of the home page",
  "home:editorial": "The story band with the two overlapping photographs",
  "home:marquee": "The scrolling strip of short phrases under the hero",
  "home:collection": "The heading above the featured product grid",
  "home:lookbook": "The heading above the new-arrivals cards",
  "home:categories": "The heading above the category tiles",
  "global:announcement": "The thin strip across the very top of every page",
};

export function blockLocation(page: string, key: string): string | null {
  return BLOCK_LOCATIONS[`${page}:${key}`] ?? null;
}

/** The storefront URL a block appears on, for a "View live" link. */
export function blockStorefrontHref(page: string): string {
  return page === "home" || page === "global" ? "/" : `/${page}`;
}
