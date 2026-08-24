import { NextRequest, NextResponse } from "next/server";
import { verifyJwt } from "@/lib/auth";
import { findUserById } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("lot_session_token")?.value;
    if (!token) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 200 });
    }

    const payload = verifyJwt(token);
    if (!payload) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 200 });
    }

    const user = findUserById(payload.userId);
    if (!user) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 200 });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch {
    return NextResponse.json({ authenticated: false, user: null }, { status: 200 });
  }
}
