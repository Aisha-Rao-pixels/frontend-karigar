// Karigar design tokens — sourced from /app/design_guidelines.json
import { Platform } from "react-native";

// Native keeps the system font (no extra native font-linking needed).
// Web loads "Inter" from Google Fonts (see app/_layout.tsx) for a more
// polished, branded look than the browser's default sans-serif.
export const FONT_FAMILY =
  Platform.OS === "web" ? "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" : undefined;

export const COLORS = {
  surface: "#FCFAF8",
  onSurface: "#1A1817",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#1A1817",
  surfaceTertiary: "#F3EFEA",
  onSurfaceTertiary: "#4A4542",
  surfaceInverse: "#1A1817",
  onSurfaceInverse: "#FFFFFF",
  brand: "#A35C3A",
  brandPrimary: "#A35C3A",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#C98263",
  brandTertiary: "#F7EBE5",
  onBrandTertiary: "#8A492B",
  success: "#22C55E",
  onSuccess: "#FFFFFF",
  warning: "#F59E0B",
  onWarning: "#FFFFFF",
  error: "#EF4444",
  onError: "#FFFFFF",
  info: "#4A4542",
  border: "#E8E3DF",
  borderStrong: "#D1C7C0",
  divider: "#F0EBE6",
  muted: "#8A827C",
};

export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, "2xl": 32, "3xl": 48 };
export const RADIUS = { sm: 6, md: 12, lg: 20, pill: 999 };
export const FONT = { sm: 12, base: 14, lg: 16, xl: 20, "2xl": 24, "3xl": 30 };

export const AVAILABILITY = {
  available_now: { color: COLORS.success, key: "avail_now" },
  available_from: { color: COLORS.warning, key: "avail_from" },
  not_available: { color: COLORS.error, key: "avail_no" },
} as const;

export const VERIFICATION = {
  approved: { color: COLORS.success, key: "verified" },
  pending: { color: COLORS.warning, key: "pending" },
  rejected: { color: COLORS.error, key: "rejected" },
} as const;

export const shadow = {
  shadowColor: "#1A1817",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
};
