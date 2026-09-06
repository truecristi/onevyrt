import { confirmEmailChange } from "../../../../lib/auth";
import { readSettings } from "../../../../lib/settings";
import { withRouteLogging } from "../../../../lib/logger";
export const runtime = "nodejs";

// The verification link lands here. GET is fine for a one-time, single-use,
// hashed-token confirmation (same shape as the password-reset link) — the
// token is unguessable and consumed on use. We apply the change and redirect
// back into the app with a flag the UI can surface.
export const GET = withRouteLogging("api/auth/confirm-email-change:GET", async (req: Request): Promise<Response> => {
  const settings = await readSettings();
  const origin = settings.publicOrigin || new URL(req.url).origin;
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const redirect = (flag: string) => new Response(null, { status: 303, headers: { location: `${origin}/?emailChange=${flag}` } });
  if (!token) return redirect("invalid");
  try {
    await confirmEmailChange(token);
    return redirect("ok");
  } catch {
    return redirect("invalid");
  }
});
