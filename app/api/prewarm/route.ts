import { NextResponse } from "next/server";
import https from "node:https";

export const runtime = "nodejs";

const prewarmAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 120000,
  maxSockets: 50,
});

export async function GET() {
  // Ultra-lightweight HEAD ping to keep TLS connection warm
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: "integrate.api.nvidia.com",
        port: 443,
        path: "/v1/models",
        method: "HEAD",
        agent: prewarmAgent,
        family: 4,
        timeout: 2000,
      },
      () => {
        resolve(NextResponse.json({ status: "warm" }));
      }
    );
    req.on("error", () => resolve(NextResponse.json({ status: "warm" })));
    req.on("timeout", () => {
      req.destroy();
      resolve(NextResponse.json({ status: "warm" }));
    });
    req.end();
  });
}
