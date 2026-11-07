import { NextRequest, NextResponse } from "next/server";
import { globalSkillRegistry } from "@/lib/skills/skillRegistry";
import { verifyJwt } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    // Skill toggles are per user, so read the caller's overlay when they are signed in.
    const token = req.cookies.get("lot_session_token")?.value;
    const session = token ? verifyJwt(token) : null;
    const skills = globalSkillRegistry.listSkills(session?.userId);
    return NextResponse.json({ skills });
  } catch (error: any) {
    console.error("[LOT SKILLS] list failed:", error);
    return NextResponse.json({ error: "Failed to load skills" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("lot_session_token")?.value;
    const session = token ? verifyJwt(token) : null;
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { skillId, enabled } = await req.json();

    if (!skillId || typeof skillId !== "string" || typeof enabled !== "boolean") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const updated = globalSkillRegistry.toggleSkill(skillId, enabled, session.userId);
    if (!updated) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      skills: globalSkillRegistry.listSkills(session.userId),
    });
  } catch (error: any) {
    console.error("[LOT SKILLS] toggle failed:", error);
    return NextResponse.json({ error: "Failed to update skill" }, { status: 500 });
  }
}
