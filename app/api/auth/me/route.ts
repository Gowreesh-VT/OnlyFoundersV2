import { NextResponse } from 'next/server';
import { getCurrentUser, getSession } from '@/lib/mongodb/auth';

/**
 * HEAD /api/auth/me
 * Quick auth check without returning user data
 * Returns 200 if authenticated, 401 if not
 */
export async function HEAD() {
    try {
        const session = await getSession();
        
        if (!session) {
            return new NextResponse(null, { status: 401 });
        }
        
        return new NextResponse(null, { status: 200 });
    } catch {
        return new NextResponse(null, { status: 500 });
    }
}

/**
 * GET /api/auth/me
 * Returns the current authenticated user's data
 */
export async function GET() {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json(
                { error: 'Not authenticated' },
                { status: 401 }
            );
        }

        return NextResponse.json({
            user: {
                id: user._id,
                email: user.email,
                fullName: user.fullName,
                phoneNumber: user.phoneNumber,
                role: user.role,
                teamId: user.teamId,
                collegeId: user.collegeId,
                assignedClusterId: user.assignedClusterId,
                entityId: user.entityId,
                qrToken: user.qrToken,
                qrGeneratedAt: user.qrGeneratedAt,
                photoUrl: user.photoUrl,
                photoUploadedAt: user.photoUploadedAt,
                lastLoginAt: user.lastLoginAt,
                loginCount: user.loginCount,
                isActive: user.isActive,
                dietaryPreferences: user.dietaryPreferences,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
                // Populated relations
                team: user.teamId,
                college: user.collegeId,
                assignedCluster: user.assignedClusterId
            }
        });

    } catch (error: unknown) {
        console.error('Get user error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
