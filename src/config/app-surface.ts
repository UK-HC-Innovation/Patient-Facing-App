export type AppSurface = "full" | "foodlens";

// next.config.mjs validates APP_SURFACE and inlines this value into every build.
// Falling back to full keeps unit tests and ordinary/Vercel builds backward compatible.
export const APP_SURFACE: AppSurface =
  process.env.NEXT_PUBLIC_APP_SURFACE === "foodlens" ? "foodlens" : "full";
