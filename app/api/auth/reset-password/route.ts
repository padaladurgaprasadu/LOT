import { NextRequest, NextResponse } from "next/server";
import { updateUserPassword, findUserByEmail } from "@/lib/db";
import { checkRateLimit } from "@/lib/rateLimiter";
import { signJwt } from "@/lib/auth";

export const runtime = "nodejs";

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

    const { email, newPassword } = await req.json();

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email address is required" }, { status: 400 });
    }

    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
      return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 });
    }

    const user = findUserByEmail(email);
    if (!user) {
      return NextResponse.json({ error: "No account found with this email" }, { status: 404 });
    }

    const updatedUser = updateUserPassword(email, newPassword);

    const token = signJwt({
      userId: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role,
    });

    const response = NextResponse.json({
      success: true,
      message: "Password reset successfully!",
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
      },
    });

    // Automatically set new session cookie
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
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to reset password" },
      { status: 500 }
    );
  }
}
