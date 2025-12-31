import 'server-only';

import type { NextRequest } from 'next/server';

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;

const buckets = new Map<string, { count: number; windowStart: number }>();

function tokenFor(request: NextRequest, userId?: string | null) {
  const ipHeader = request.headers.get('x-forwarded-for') ?? '';
  const ip = ipHeader.split(',')[0]?.trim() || 'unknown';
  return userId ? `${userId}:${ip}` : ip;
}

export function rateLimit(request: NextRequest, userId?: string | null) {
  const key = tokenFor(request, userId);
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }

  if (bucket.count >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false };
  }

  bucket.count += 1;
  return { allowed: true };
}
