/**
 * LOT E2E Test Dynamic Module Loader
 * Dynamically resolves target architectural modules according to PROJECT.md contracts,
 * gracefully supporting in-progress migration across M1-M6 milestones.
 */

import * as fs from "fs";
import * as path from "path";
import { pathToFileURL } from "url";

const ROOT_DIR = path.resolve(__dirname, "../..");

export async function resolveModule<T = any>(paths: string[]): Promise<T | null> {
  for (const relPath of paths) {
    const fullTsPath = path.resolve(ROOT_DIR, relPath);
    const fullTsxPath = fullTsPath.replace(/\.ts$/, ".tsx");
    const fullJsPath = fullTsPath.replace(/\.ts$/, ".js");

    const targetPath = fs.existsSync(fullTsPath)
      ? fullTsPath
      : fs.existsSync(fullTsxPath)
      ? fullTsxPath
      : fs.existsSync(fullJsPath)
      ? fullJsPath
      : null;

    if (targetPath) {
      try {
        const fileUrl = pathToFileURL(targetPath).href;
        const mod = await import(fileUrl);
        return mod as T;
      } catch (err: any) {
        // Module failed to import
      }
    }
  }
  return null;
}

export async function getStorageModule() {
  return await resolveModule([
    "lib/platform/storage.ts",
    "lib/storage.ts",
  ]);
}

export async function getAuthModule() {
  return await resolveModule([
    "lib/platform/auth.ts",
    "lib/auth.ts",
  ]);
}

export async function getRateLimiterModule() {
  return await resolveModule([
    "lib/platform/rateLimiter.ts",
    "lib/rateLimiter.ts",
  ]);
}

export async function getQueryRouterModule() {
  return await resolveModule([
    "lib/intelligence/queryRouter.ts",
    "lib/queryRouter.ts",
  ]);
}

export async function getWebSearchModule() {
  return await resolveModule([
    "lib/intelligence/webSearch.ts",
    "lib/webSearch.ts",
    "lib/lot-os/webGrounding.ts",
  ]);
}

export async function getModelRotationModule() {
  const mod = await resolveModule([
    "lib/intelligence/modelRotation.ts",
    "lib/lot-os/modelRotation.ts",
    "lib/nvidia.ts",
  ]);
  if (!mod) return null;

  if (typeof mod.executeModelWithFailover !== "function" && typeof mod.executeRotatedChat === "function") {
    return {
      ...mod,
      executeModelWithFailover: async (messages: any[], options: any = {}) => {
        const res = await mod.executeRotatedChat({
          messages,
          modelOverride: options.preferredModel,
        });
        return {
          content: res.content,
          modelUsed: res.model,
          provider: res.provider,
          fallbackOccurred: res.provider === "sovereign-fallback",
        };
      },
    };
  }
  return mod;
}

export async function getLotCodeEngineModule() {
  return await resolveModule([
    "lib/agents/lotCodeEngine.ts",
    "lib/agent/lotCodeEngine.ts",
  ]);
}

export async function getChatApiRoute() {
  return await resolveModule([
    "app/api/chat/route.ts",
  ]);
}

export function checkFileExists(relPath: string): boolean {
  return fs.existsSync(path.resolve(ROOT_DIR, relPath));
}

export function readCodeFile(relPath: string): string | null {
  const full = path.resolve(ROOT_DIR, relPath);
  if (fs.existsSync(full)) {
    return fs.readFileSync(full, "utf-8");
  }
  return null;
}
