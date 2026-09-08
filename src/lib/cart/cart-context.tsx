"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import type { CartLine, CartState } from "./types";

const STORAGE_KEY = "franley.bag.v1";

type State = CartState & { hydrated: boolean };

type Action =
  | { type: "hydrate"; lines: CartLine[] }
  | { type: "add"; line: CartLine }
  | { type: "setQty"; productId: string; quantity: number }
  | { type: "remove"; productId: string }
  | { type: "clear" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "hydrate":
      return { lines: action.lines, hydrated: true };
    case "add": {
      const existing = state.lines.find((l) => l.productId === action.line.productId);
      if (!existing) return { ...state, lines: [...state.lines, action.line] };
      return {
        ...state,
        lines: state.lines.map((l) =>
          l.productId === action.line.productId
            ? { ...l, quantity: Math.min(l.quantity + action.line.quantity, l.maxQuantity) }
            : l,
        ),
      };
    }
    case "setQty": {
      if (action.quantity <= 0) {
        return { ...state, lines: state.lines.filter((l) => l.productId !== action.productId) };
      }
      return {
        ...state,
        lines: state.lines.map((l) =>
          l.productId === action.productId
            ? { ...l, quantity: Math.min(action.quantity, l.maxQuantity) }
            : l,
        ),
      };
    }
    case "remove":
      return { ...state, lines: state.lines.filter((l) => l.productId !== action.productId) };
    case "clear":
      return { ...state, lines: [] };
  }
}

type CartContextValue = {
  lines: CartLine[];
  count: number;
  subtotalCents: number;
  /** True until localStorage has been read, so SSR and first paint agree. */
  ready: boolean;
  isOpen: boolean;
  openBag: () => void;
  closeBag: () => void;
  add: (line: Omit<CartLine, "quantity"> & { quantity?: number }) => void;
  setQty: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { lines: [], hydrated: false });
  const [isOpen, setOpen] = useState(false);

  // Read the persisted bag once on mount. This is the two-pass render React
  // prescribes for client-only state: localStorage does not exist during SSR,
  // and a lazy useReducer initializer would have the server render an empty bag
  // while the client renders a full one — a hydration mismatch. `hydrated` is
  // set by the same dispatch that loads the lines, so consumers never see a
  // moment where the bag reads "ready but empty" before its contents arrive.
  useEffect(() => {
    let lines: CartLine[] = [];
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as CartState) : null;
      if (Array.isArray(parsed?.lines)) lines = parsed.lines;
    } catch {
      // Corrupt or unavailable storage (private mode) — start with an empty bag.
    }
    dispatch({ type: "hydrate", lines });
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ lines: state.lines }));
    } catch {
      // Quota or private mode — the bag simply will not persist.
    }
  }, [state.lines, state.hydrated]);

  const add: CartContextValue["add"] = useCallback((line) => {
    dispatch({ type: "add", line: { ...line, quantity: line.quantity ?? 1 } });
    setOpen(true);
  }, []);

  const value = useMemo<CartContextValue>(() => {
    const count = state.lines.reduce((n, l) => n + l.quantity, 0);
    const subtotalCents = state.lines.reduce((n, l) => n + l.priceCents * l.quantity, 0);
    return {
      lines: state.lines,
      count,
      subtotalCents,
      ready: state.hydrated,
      isOpen,
      openBag: () => setOpen(true),
      closeBag: () => setOpen(false),
      add,
      setQty: (productId, quantity) => dispatch({ type: "setQty", productId, quantity }),
      remove: (productId) => dispatch({ type: "remove", productId }),
      clear: () => dispatch({ type: "clear" }),
    };
  }, [state.lines, state.hydrated, isOpen, add]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
