export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return Response.json(
    {
      status: "healthy",
      surface: APP_SURFACE
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" }
    }
  );
}
import { APP_SURFACE } from "@/config/app-surface";
