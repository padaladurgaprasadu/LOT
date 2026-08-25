import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { signJwt } from "@/lib/auth";
import { createUser, findUserByEmail } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error && data.user) {
        const email = data.user.email || "";
        const name = data.user.user_metadata?.full_name || data.user.user_metadata?.name || email.split("@")[0] || "User";

        let localUser = findUserByEmail(email);
        if (!localUser && email) {
          localUser = createUser(name, email, `OAuth_Supabase_${Date.now()}`, "user");
        }

        const token = signJwt({
          userId: localUser?.id || data.user.id,
          email,
          name: localUser?.name || name,
          role: localUser?.role || "user",
        });

        const response = NextResponse.redirect(new URL("/", req.url));
        response.cookies.set({
          name: "lot_session_token",
          value: token,
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          path: "/",
          maxAge: 7 * 24 * 3600,
        });
        return response;
      }
    }
  }

  return NextResponse.redirect(new URL("/", req.url));
}
