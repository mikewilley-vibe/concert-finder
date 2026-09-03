type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitStore = Map<string, RateLimitEntry>;

const globalRateLimit = globalThis as typeof globalThis & {
  concertFinderRateLimits?: RateLimitStore;
};

const store =
  globalRateLimit.concertFinderRateLimits ?? new Map<string, RateLimitEntry>();
globalRateLimit.concertFinderRateLimits = store;

const MAX_STORED_KEYS = 5000;

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): RateLimitResult {
  const current = store.get(key);
  const entry =
    !current || current.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : current;

  entry.count += 1;
  store.set(key, entry);

  if (store.size > MAX_STORED_KEYS) {
    for (const [storedKey, value] of store) {
      if (value.resetAt <= now) store.delete(storedKey);
    }
  }

  return {
    allowed: entry.count <= limit,
    limit,
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.resetAt,
  };
}

function requestIdentity(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (forwarded || realIp) return forwarded || realIp || "unknown";

  const agent = request.headers.get("user-agent")?.slice(0, 160) || "unknown";
  return `unknown:${agent}`;
}

export function ticketmasterRateLimitResponse(
  request: Request,
  scope: string,
  limit: number,
  windowMs = 60_000,
) {
  const result = checkRateLimit(
    `${scope}:${requestIdentity(request)}`,
    limit,
    windowMs,
  );
  if (result.allowed) return null;

  const retryAfter = Math.max(
    1,
    Math.ceil((result.resetAt - Date.now()) / 1000),
  );
  return Response.json(
    { error: "Too many searches. Wait a moment and try again." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
      },
    },
  );
}

export function clearRateLimitsForTests() {
  store.clear();
}
