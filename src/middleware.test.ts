import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { handleAppSurfaceRequest, isFoodLensRoute } from "./middleware";

describe("FoodLens deployment boundary", () => {
  it("uses an exact page and API allowlist", () => {
    expect(isFoodLensRoute("/food")).toBe(true);
    expect(isFoodLensRoute("/food/demo")).toBe(true);
    expect(isFoodLensRoute("/api/food/identify")).toBe(true);
    expect(isFoodLensRoute("/api/food/package")).toBe(false);
    expect(isFoodLensRoute("/api/food/package/session")).toBe(false);
    expect(isFoodLensRoute("/today")).toBe(false);
    expect(isFoodLensRoute("/food/future-route")).toBe(false);
  });

  it("preserves the full application when APP_SURFACE is absent", () => {
    const response = handleAppSurfaceRequest(new NextRequest("https://example.test/today"), "full");

    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("redirects the FoodLens root while preserving its query", () => {
    const response = handleAppSurfaceRequest(
      new NextRequest("https://example.test/?lang=es"),
      "foodlens"
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://example.test/food/demo?lang=es");
  });

  it("returns 404 for routes outside the FoodLens surface", async () => {
    const pageResponse = handleAppSurfaceRequest(
      new NextRequest("https://example.test/today"),
      "foodlens"
    );
    expect(pageResponse.status).toBe(404);
    expect(await pageResponse.text()).toBe("Not Found");

    const apiResponse = handleAppSurfaceRequest(
      new NextRequest("https://example.test/api/food/package"),
      "foodlens"
    );
    expect(apiResponse.status).toBe(404);
    await expect(apiResponse.json()).resolves.toEqual({ error: "not_found" });
  });

  it("allows only the FoodLens public assets and Next build assets", () => {
    expect(handleAppSurfaceRequest(new NextRequest("https://example.test/food-lens.webmanifest"), "foodlens").headers.get("x-middleware-next")).toBe("1");
    expect(handleAppSurfaceRequest(new NextRequest("https://example.test/og.png"), "foodlens").headers.get("x-middleware-next")).toBe("1");
    expect(handleAppSurfaceRequest(new NextRequest("https://example.test/_next/static/chunk.js"), "foodlens").headers.get("x-middleware-next")).toBe("1");
    expect(handleAppSurfaceRequest(new NextRequest("https://example.test/_next/image"), "foodlens").status).toBe(404);
    expect(handleAppSurfaceRequest(new NextRequest("https://example.test/manifest.webmanifest"), "foodlens").status).toBe(404);
    expect(handleAppSurfaceRequest(new NextRequest("https://example.test/demo-reports/report-no-dr.svg"), "foodlens").status).toBe(404);
  });
});
