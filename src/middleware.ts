import { NextResponse, type NextRequest } from "next/server";
import { APP_SURFACE, type AppSurface } from "@/config/app-surface";

const FOODLENS_PAGE_PATHS = new Set(["/food", "/food/demo", "/compass"]);
const FOODLENS_API_PATHS = new Set([
  "/api/food/identify",
  "/api/food/lookup",
  "/api/food/plate",
  "/api/food/vision",
  "/api/realtime/token",
  "/api/health"
]);
const FOODLENS_PUBLIC_ASSET_PATHS = new Set([
  "/food-lens.webmanifest",
  "/food-lens-icon.svg",
  "/og.png"
]);

export function isFoodLensRoute(pathname: string): boolean {
  return FOODLENS_PAGE_PATHS.has(pathname) || FOODLENS_API_PATHS.has(pathname);
}

export function handleAppSurfaceRequest(request: NextRequest, surface: AppSurface): NextResponse {
  if (surface !== "foodlens") {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname === "/") {
    const destination = request.nextUrl.clone();
    destination.pathname = "/food/demo";
    return NextResponse.redirect(destination);
  }

  if (
    request.nextUrl.pathname.startsWith("/_next/static/") ||
    FOODLENS_PUBLIC_ASSET_PATHS.has(request.nextUrl.pathname) ||
    isFoodLensRoute(request.nextUrl.pathname)
  ) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "not_found" },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  return new NextResponse("Not Found", {
    status: 404,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
}

export function middleware(request: NextRequest): NextResponse {
  return handleAppSurfaceRequest(request, APP_SURFACE);
}

export const config = {
  matcher: ["/:path*"]
};
