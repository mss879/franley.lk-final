import { z } from "zod";

/** Sri Lanka's 25 administrative districts, for the delivery address. */
export const SL_DISTRICTS = [
  "Ampara", "Anuradhapura", "Badulla", "Batticaloa", "Colombo", "Galle",
  "Gampaha", "Hambantota", "Jaffna", "Kalutara", "Kandy", "Kegalle",
  "Kilinochchi", "Kurunegala", "Mannar", "Matale", "Matara", "Monaragala",
  "Mullaitivu", "Nuwara Eliya", "Polonnaruwa", "Puttalam", "Ratnapura",
  "Trincomalee", "Vavuniya",
] as const;

export const PAYMENT_METHODS = ["cod", "bank_transfer"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** A local mobile number, with or without the +94 country code. */
const phone = z
  .string()
  .trim()
  .regex(/^(?:\+94|0)?[1-9]\d{8}$/, "Enter a valid Sri Lankan phone number");

export const checkoutSchema = z.object({
  email: z.email("Enter a valid email address"),
  fullName: z.string().trim().min(2, "Enter your full name").max(120),
  phone,
  addressLine1: z.string().trim().min(4, "Enter your street address").max(200),
  addressLine2: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().min(2, "Enter your city").max(100),
  district: z.enum(SL_DISTRICTS),
  postalCode: z.string().trim().max(10).optional().or(z.literal("")),
  paymentMethod: z.enum(PAYMENT_METHODS),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  /**
   * Only ids and quantities cross the wire. The server re-reads every price
   * from the database — a client that could post its own totals is a store
   * anyone can rob.
   */
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1).max(99),
      }),
    )
    .min(1, "Your bag is empty"),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
