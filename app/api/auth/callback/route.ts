import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/auth/callback
 * OAuth callback handler - Not used with JWT auth
 * Kept for backwards compatibility, redirects to login
 */
export async function GET(request: NextRequest) {
    const { origin } = new URL(request.url);
    
    // JWT auth doesn't use OAuth callbacks
    // Redirect to login page
    return NextResponse.redirect(`${origin}/auth/login`);
}
