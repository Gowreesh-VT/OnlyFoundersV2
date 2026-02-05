import { NextResponse } from 'next/server';
import { destroySession, getSession } from '@/lib/mongodb/auth';

/**
 * POST /api/auth/logout
 * Destroys the current user's session
 * 
 * Returns:
 *   - 200: { success: true, message: "Logged out successfully" }
 *   - 500: { error: "Internal server error" }
 */
export async function POST() {
    try {
        // Check if there's an active session first
        const session = await getSession();
        
        if (!session) {
            const response = NextResponse.json({
                success: true,
                message: 'No active session'
            });
            response.cookies.set('auth_session', '', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 0,
                path: '/',
            });
            return response;
        }

        // Destroy the session cookie
        await destroySession();

        const response = NextResponse.json({
            success: true,
            message: 'Logged out successfully'
        });
        response.cookies.set('auth_session', '', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 0,
            path: '/',
        });
        return response;
    } catch (error: unknown) {
        console.error('Logout error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
