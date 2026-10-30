import type { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";

/**
 * Lightweight API protection for the KonnectS server:
 *  - requireAuth: verifies the caller's Firebase ID token (no extra dependency,
 *    uses Google's public Identity Toolkit REST endpoint).
 *  - rateLimit: simple in-memory fixed-window limiter.
 *  - securityHeaders: a few safe defaults that do not break iframe previews.
 */

export interface AuthedRequest extends Request {
  uid?: string;
  userEmail?: string;
  idToken?: string;
}

function loadFirebaseApiKey(): string {
  if (process.env.FIREBASE_API_KEY) return process.env.FIREBASE_API_KEY;
  try {
    const cfgPath = path.join(process.cwd(), "firebase-applet-config.json");
    return JSON.parse(fs.readFileSync(cfgPath, "utf8")).apiKey || "";
  } catch {
    return "";
  }
}

const FIREBASE_API_KEY = loadFirebaseApiKey();
const TOKEN_CACHE_TTL_MS = 5 * 60 * 1000;
const tokenCache = new Map<string, { uid: string; email?: string; expires: number }>();

const hash = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

async function verifyIdToken(idToken: string): Promise<{ uid: string; email?: string } | null> {
  const key = hash(idToken);
  const cached = tokenCache.get(key);
  if (cached && cached.expires > Date.now()) return { uid: cached.uid, email: cached.email };
  if (!FIREBASE_API_KEY) return null;

  try {
    const resp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_API_KEY)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!resp.ok) return null;
    const data: any = await resp.json();
    const user = data?.users?.[0];
    if (!user?.localId || user.disabled) return null;

    tokenCache.set(key, { uid: user.localId, email: user.email, expires: Date.now() + TOKEN_CACHE_TTL_MS });
    if (tokenCache.size > 5000) {
      const now = Date.now();
      for (const [k, v] of tokenCache) if (v.expires <= now) tokenCache.delete(k);
    }
    return { uid: user.localId, email: user.email };
  } catch (err) {
    console.warn("[security] ID token verification failed:", (err as Error).message);
    return null;
  }
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  // Local-development escape hatch only. Never honoured in production.
  if (process.env.NODE_ENV !== "production" && process.env.ALLOW_UNAUTHENTICATED_API === "true") {
    req.uid = "dev-user";
    return next();
  }

  const header = req.headers.authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return res.status(401).json({ error: "Authentication required" });

  const verified = await verifyIdToken(match[1]);
  if (!verified) return res.status(401).json({ error: "Invalid or expired session" });

  req.uid = verified.uid;
  req.userEmail = verified.email;
  req.idToken = match[1];
  next();
}

interface RateLimitOptions {
  windowMs: number;
  max: number;
  /** Prefix so separate limiters keep separate counters. */
  name: string;
}

export function rateLimit({ windowMs, max, name }: RateLimitOptions) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
  }, windowMs);
  sweeper.unref?.();

  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const id = req.uid || req.ip || "unknown";
    const now = Date.now();
    const entry = hits.get(id);
    if (!entry || entry.resetAt <= now) {
      hits.set(id, { count: 1, resetAt: now + windowMs });
      return next();
    }
    entry.count++;
    if (entry.count > max) {
      res.setHeader("Retry-After", Math.ceil((entry.resetAt - now) / 1000).toString());
      return res.status(429).json({ error: `Too many requests (${name}). Please slow down.` });
    }
    next();
  };
}

export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  }
  next();
}

/** Trim and bound untrusted text before it is placed in an LLM prompt. */
export function clip(value: unknown, max = 500): string {
  return String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, max);
}

export function toNumber(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" ? value : parseFloat(String(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
