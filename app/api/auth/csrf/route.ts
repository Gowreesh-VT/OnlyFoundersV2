import { NextResponse } from 'next/server';
import { generateCSRFToken } from '@/lib/security/csrf';

/**
 * GET /api/auth/csrf
 * Returns a new CSRF token for use in forms and API requests
 * 
 * This token should be included in the X-CSRF-Token header
 * for any state-changing requests (POST, PUT, DELETE, PATCH)
 * 
 * Returns:
 *   - 200: { csrfToken: string }
 */
export async function GET() {
    try {
        const token = generateCSRFToken();

        return NextResponse.json({
            csrfToken: token
        }, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
            }
        });
    } catch (error) {
        console.error('CSRF token generation error:', error);
        return NextResponse.json(
            { error: 'Failed to generate CSRF token' },
            { status: 500 }
        );
    }
}
