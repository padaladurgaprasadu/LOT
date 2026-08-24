import { NextRequest, NextResponse } from "next/server";
import { updateUserName, findUserById } from "@/lib/db";
import { verifyJwt, signJwt } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("lot_session_token")?.value;
    const { name, email } = await req.json();

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 });
    }

    let targetId = "user_durga_master";
    if (token) {
      const payload = verifyJwt(token);
      if (payload?.userId) {
        targetId = payload.userId;
      }
    } else if (email) {
      targetId = email;
    }

    const updatedUser = updateUserName(targetId, name);

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
    return NextResponse.json(
      { error: error.message || "Failed to update profile" },
      { status: 500 }
    );
  }
}
