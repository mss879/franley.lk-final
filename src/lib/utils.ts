import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Money is stored in cents (LKR) everywhere. Format for display. */
export function formatPrice(cents: number, currency = "LKR") {
  const value = cents / 100;
  const formatted = new Intl.NumberFormat("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return currency === "LKR" ? `Rs ${formatted}` : `${currency} ${formatted}`;
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
