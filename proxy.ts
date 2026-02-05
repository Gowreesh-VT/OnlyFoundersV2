import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET;
const SESSION_COOKIE_NAME = 'auth_session';

async function verifyToken(token: string): Promise<boolean> {
    if (!JWT_SECRET) return false;
    try {
        const secret = new TextEncoder().encode(JWT_SECRET);
        await jwtVerify(token, secret);
        return true;
    } catch {
        return false;
    }
}

export async function proxy(request: NextRequest) {
    let response = NextResponse.next({
        request,
    });

    const { pathname } = request.nextUrl;

    // SECURITY: Add security headers to all responses
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
    response.headers.set(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' https://*.mongodb.net; frame-ancestors 'none';"
    );

    // Public routes that don't require authentication
    const publicRoutes = ['/', '/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password', '/manifest.json', '/sw.js', '/follow-us'];
    const isPublicRoute = publicRoutes.includes(pathname);

    // API routes handle their own auth
    const isApiRoute = pathname.startsWith('/api/');

    if (isApiRoute) {
        return response;
    }

    // Check for auth session cookie
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const isAuthenticated = token ? await verifyToken(token) : false;

    // Redirect unauthenticated users to login
    if (!isAuthenticated && !isPublicRoute) {
        const url = request.nextUrl.clone();
        url.pathname = '/auth/login';
        return NextResponse.redirect(url);
    }

    // Redirect authenticated users away from auth pages
    if (isAuthenticated && (pathname === '/auth/login' || pathname === '/auth/register')) {
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard';
        return NextResponse.redirect(url);
    }

    return response;
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|workbox-.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
