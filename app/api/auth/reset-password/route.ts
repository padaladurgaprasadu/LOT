import { NextRequest, NextResponse } from "next/server";
import { updateUserPassword, findUserByEmail, findUserById } from "@/lib/db";
import { checkRateLimit } from "@/lib/rateLimiter";
import { signJwt, verifyJwt } from "@/lib/auth";
import { verifyPassword } from "@/lib/crypto";

export const runtime = "nodejs";

function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters long";
  if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter (A-Z)";
  if (!/[a-z]/.test(password)) return "Password must contain at least one lowercase letter (a-z)";
  if (!/[0-9]/.test(password)) return "Password must contain at least one number (0-9)";
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return "Password must contain at least one special character (!@#$%^&*...)";
  }
  return null;
}

/**
 * Change the password of the CALLER'S OWN account.
 *
 * This endpoint used to accept { email, newPassword } from anyone and rewrite that
 * account's password with no proof of ownership — a one-request takeover of any
 * account, including admin. Ownership must now be proven either by a valid session
 * cookie or by supplying the account's current password.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "anonymous";
    const rateCheck = checkRateLimit(`reset_${ip}`, 5, 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `Too many password reset requests. Please wait ${rateCheck.resetInSec}s.` },
        { status: 429 }
      );
    }

    const { email, currentPassword, newPassword } = await req.json();

    if (!newPassword || typeof newPassword !== "string") {
      return NextResponse.json({ error: "New password is required" }, { status: 400 });
    }

    const strengthError = validatePasswordStrength(newPassword);
    if (strengthError) {
      return NextResponse.json({ error: strengthError }, { status: 400 });
    }

    // 1. Resolve the account being changed — only ever the authenticated caller.
    const token = req.cookies.get("lot_session_token")?.value;
    const session = token ? verifyJwt(token) : null;

    let user = session ? findUserById(session.userId) : null;

    // 2. No session: allow a self-service change only when the CURRENT password is proven.
    if (!user) {
      if (!email || typeof email !== "string" || !email.includes("@")) {
        return NextResponse.json({ error: "Valid email address is required" }, { status: 400 });
      }
      if (!currentPassword || typeof currentPassword !== "string") {
        return NextResponse.json(
          { error: "Sign in, or provide your current password, to change it." },
          { status: 401 }
        );
      }

      const candidate = findUserByEmail(email);
      // Same generic message whether the account is missing or the password is wrong,
      // so this endpoint cannot be used to enumerate registered accounts.
      if (!candidate || !verifyPassword(currentPassword, candidate.passwordHash, candidate.salt)) {
        return NextResponse.json({ error: "Invalid email or current password" }, { status: 401 });
      }
      user = candidate;
    } else if (currentPassword && typeof currentPassword === "string") {
      // A signed-in caller who supplied a current password must still get it right.
      if (!verifyPassword(currentPassword, user.passwordHash, user.salt)) {
        return NextResponse.json({ error: "Invalid current password" }, { status: 401 });
      }
    }

    const updatedUser = updateUserPassword(user.email, newPassword);

    const newToken = signJwt({
      userId: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role,
    });

    const response = NextResponse.json({
      success: true,
      message: "Password updated successfully!",
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
      },
    });

    response.cookies.set({
      name: "lot_session_token",
      value: newToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 7 * 24 * 3600,
    });

    return response;
  } catch (error: any) {
    console.error("[LOT AUTH] reset-password failed:", error);
    return NextResponse.json({ error: "Failed to update password" }, { status: 500 });
  }
}
