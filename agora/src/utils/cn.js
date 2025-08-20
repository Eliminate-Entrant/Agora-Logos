import { clsx } from "clsx";

export function cn(...inputs) {
  return clsx(inputs);
}

// Install clsx if not available
// This is a lightweight utility for constructing className strings

