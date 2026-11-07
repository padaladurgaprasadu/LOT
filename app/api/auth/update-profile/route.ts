import { NextRequest, NextResponse } from "next/server";
import { updateUserName, findUserById } from "@/lib/db";
import { verifyJwt, signJwt } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("lot_session_token")?.value;
    const session = token ? verifyJwt(token) : null;

    // Previously an unauthenticated caller could pass any email in the body — or nothing
    // at all, which defaulted to the built-in admin id — and rename that account.
    // The profile being edited is now always the authenticated caller's own.
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { name } = await req.json();

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 });
    }
    if (name.trim().length > 80) {
      return NextResponse.json({ error: "Name must be 80 characters or fewer" }, { status: 400 });
    }

    const existing = findUserById(session.userId);
    if (!existing) {
      return NextResponse.json({ error: "Account no longer exists" }, { status: 404 });
    }

    const updatedUser = updateUserName(existing.id, name);

    const newToken = signJwt({
      userId: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role,
    });

    const response = NextResponse.json({
      success: true,
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
    console.error("[LOT AUTH] update-profile failed:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
