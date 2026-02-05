import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, createSession } from '@/lib/mongodb/auth';
import { checkRateLimit } from '@/lib/security/rate-limit';

/**
 * POST /api/auth/login
 * Authenticates a user with email/password and creates a session
 * 
 * Request body:
 *   - email: string (required)
 *   - password: string (required)
 * 
 * Returns:
 *   - 200: { success: true, user: UserData }
 *   - 400: { error: "Email and password are required" }
 *   - 401: { error: "Invalid email or password" }
 *   - 429: { error: "Too many login attempts" }
 *   - 500: { error: "Internal server error" }
 */
export async function POST(request: NextRequest) {
    try {
        // Rate limiting - 5 attempts per minute per IP
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                   request.headers.get('x-real-ip') || 
                   'unknown';
        const rateLimitResult = checkRateLimit(ip, { maxAttempts: 5, windowMs: 60000 });
        
        if (!rateLimitResult.success) {
            return NextResponse.json(
                { 
                    error: 'Too many login attempts. Please try again later.',
                    retryAfter: rateLimitResult.resetIn 
                },
                { 
                    status: 429,
                    headers: { 'Retry-After': String(rateLimitResult.resetIn) }
                }
            );
        }

        const body = await request.json();
        const { email, password } = body;

        // Validate required fields
        if (!email || typeof email !== 'string') {
            return NextResponse.json(
                { error: 'Email is required' },
                { status: 400 }
            );
        }

        if (!password || typeof password !== 'string') {
            return NextResponse.json(
                { error: 'Password is required' },
                { status: 400 }
            );
        }

        // Validate email format (basic check)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json(
                { error: 'Invalid email format' },
                { status: 400 }
            );
        }

        // Authenticate user
        const user = await authenticateUser(email, password);

        if (!user) {
            return NextResponse.json(
                { error: 'Invalid email or password' },
                { status: 401 }
            );
        }

        // Create session (sets HTTP-only cookie)
        await createSession(user._id.toString(), user.email, user.role);

        // Return user data (excluding sensitive fields)
        return NextResponse.json({
            success: true,
            user: {
                id: user._id,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
                teamId: user.teamId,
                collegeId: user.collegeId,
                entityId: user.entityId,
                photoUrl: user.photoUrl
            }
        });

    } catch (error: unknown) {
        console.error('Login error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
