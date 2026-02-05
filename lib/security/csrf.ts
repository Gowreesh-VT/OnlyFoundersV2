import crypto from 'crypto';
import { cookies } from 'next/headers';

// SECURITY: Require CSRF_SECRET from environment - no fallback allowed
const CSRF_SECRET = process.env.CSRF_SECRET;
if (!CSRF_SECRET) {
    console.error('CRITICAL: CSRF_SECRET environment variable is not set');
}
const CSRF_TOKEN_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * Generate a CSRF token
 */
export function generateCSRFToken(): string {
    if (!CSRF_SECRET) {
        throw new Error('CSRF_SECRET is not configured');
    }
    const token = crypto.randomBytes(32).toString('hex');
    const timestamp = Date.now().toString();
    const signature = crypto
        .createHmac('sha256', CSRF_SECRET)
        .update(`${token}:${timestamp}`)
        .digest('hex');
    return `${token}:${timestamp}:${signature}`;
}

/**
 * Validate a CSRF token
 */
export function validateCSRFToken(token: string): boolean {
    if (!token || !CSRF_SECRET) return false;

    const parts = token.split(':');
    if (parts.length !== 3) return false;

    const [tokenValue, timestamp, providedSignature] = parts;

    // Check if token is expired (1 hour max)
    const tokenTime = parseInt(timestamp);
    if (isNaN(tokenTime) || Date.now() - tokenTime > 3600000) {
        return false;
    }

    // Verify signature
    const expectedSignature = crypto
        .createHmac('sha256', CSRF_SECRET)
        .update(`${tokenValue}:${timestamp}`)
        .digest('hex');

    return crypto.timingSafeEqual(
        Buffer.from(providedSignature),
        Buffer.from(expectedSignature)
    );
}

/**
 * Get CSRF token from request header
 */
export function getCSRFTokenFromHeader(request: Request): string | null {
    return request.headers.get(CSRF_HEADER_NAME);
}

/**
 * Verify CSRF token from request
 * Returns true if valid, false otherwise
 */
export async function verifyCSRFToken(request: Request): Promise<boolean> {
    const headerToken = getCSRFTokenFromHeader(request);

    if (!headerToken) {
        return false;
    }

    return validateCSRFToken(headerToken);
}

/**
 * CSRF error response
 */
export function csrfErrorResponse() {
    return new Response(
        JSON.stringify({ error: 'Invalid or missing CSRF token' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
}
