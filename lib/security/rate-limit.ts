/**
 * Simple in-memory rate limiter for API routes
 * Limits requests per IP address with configurable window and max attempts
 */

interface RateLimitEntry {
    count: number;
    resetTime: number;
}

// In-memory store (resets on server restart - use Redis for production persistence)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
        if (now > entry.resetTime) {
            rateLimitStore.delete(key);
        }
    }
}, 5 * 60 * 1000);

interface RateLimitOptions {
    windowMs?: number;    // Time window in milliseconds (default: 60000 = 1 minute)
    maxAttempts?: number; // Max requests per window (default: 5)
}

interface RateLimitResult {
    success: boolean;
    remaining: number;
    resetIn: number; // seconds until reset
}

/**
 * Check rate limit for an identifier (usually IP or user ID)
 */
export function checkRateLimit(
    identifier: string,
    options: RateLimitOptions = {}
): RateLimitResult {
    const { windowMs = 60000, maxAttempts = 5 } = options;
    const now = Date.now();
    const key = identifier;

    const entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetTime) {
        // First request or window expired - create new entry
        rateLimitStore.set(key, {
            count: 1,
            resetTime: now + windowMs,
        });
        return { success: true, remaining: maxAttempts - 1, resetIn: Math.ceil(windowMs / 1000) };
    }

    if (entry.count >= maxAttempts) {
        // Rate limit exceeded
        const resetIn = Math.ceil((entry.resetTime - now) / 1000);
        return { success: false, remaining: 0, resetIn };
    }

    // Increment count
    entry.count++;
    const resetIn = Math.ceil((entry.resetTime - now) / 1000);
    return { success: true, remaining: maxAttempts - entry.count, resetIn };
}

/**
 * Get client IP from request headers
 */
export function getClientIP(request: Request): string {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    const realIP = request.headers.get('x-real-ip');
    if (realIP) {
        return realIP;
    }
    return 'unknown';
}

/**
 * Rate limit response helper
 */
export function rateLimitResponse(resetIn: number) {
    return new Response(
        JSON.stringify({
            error: 'Too many requests. Please try again later.',
            retryAfter: resetIn
        }),
        {
            status: 429,
            headers: {
                'Content-Type': 'application/json',
                'Retry-After': String(resetIn)
            }
        }
    );
}
