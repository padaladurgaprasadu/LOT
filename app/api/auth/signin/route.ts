import { NextRequest, NextResponse } from "next/server";
import { findUserByEmail } from "@/lib/db";
import { verifyPassword } from "@/lib/crypto";
import { signJwt } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimiter";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "anonymous";
    const rateCheck = checkRateLimit(`signin_${ip}`, 15, 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `Too many login attempts. Please wait ${rateCheck.resetInSec}s.` },
        { status: 429 }
      );
    }

    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const user = findUserByEmail(email);
    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const isValid = verifyPassword(password, user.passwordHash, user.salt);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const token = signJwt({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

    // Set secure HTTP-only cookie
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
      { error: error.message || "Internal server error during login" },
      { status: 500 }
    );
  }
}
