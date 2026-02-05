import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb/connection';
import { User } from '@/lib/mongodb/models';
import { getCurrentUser } from '@/lib/mongodb/auth';
import crypto from 'crypto';

const QR_SECRET = process.env.QR_SECRET || 'onlyfounders-qr-secret-key-2026';

// Generate signed QR token
function generateQRToken(entityId: string): string {
    const timestamp = Date.now().toString();
    const message = `${entityId}:${timestamp}`;
    const signature = crypto
        .createHmac('sha256', QR_SECRET)
        .update(message)
        .digest('hex');
    
    return `${entityId}:${timestamp}:${signature}`;
}

// POST: Refresh QR token for a user
export async function POST(request: NextRequest) {
    try {
        await connectDB();

        // Get current authenticated user
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Get user's entity_id
        const user = await User.findById(currentUser.id).select('entityId');

        if (!user?.entityId) {
            return NextResponse.json(
                { error: 'Entity ID not found. Please complete onboarding first.' },
                { status: 400 }
            );
        }

        // Generate new QR token
        const qrToken = generateQRToken(user.entityId);

        // Update user with new QR token
        await User.findByIdAndUpdate(currentUser.id, {
            qrToken: qrToken,
            qrGeneratedAt: new Date(),
        });

        return NextResponse.json({
            success: true,
            qrToken,
            entityId: user.entityId,
        });
    } catch (error) {
        console.error('QR refresh error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// GET: Get current QR token
export async function GET(request: NextRequest) {
    try {
        await connectDB();

        // Get current authenticated user
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Get user's QR data
        const user = await User.findById(currentUser.id).select('entityId qrToken qrGeneratedAt');

        if (!user) {
            return NextResponse.json(
                { error: 'Profile not found' },
                { status: 404 }
            );
        }

        if (!user.entityId || !user.qrToken) {
            return NextResponse.json(
                { error: 'Please complete onboarding first' },
                { status: 400 }
            );
        }

        return NextResponse.json({
            entityId: user.entityId,
            qrToken: user.qrToken,
            generatedAt: user.qrGeneratedAt,
        });
    } catch (error) {
        console.error('QR fetch error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
