import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb/connection';
import { User, AuditLog } from '@/lib/mongodb/models';
import { getCurrentUser } from '@/lib/mongodb/auth';
import crypto from 'crypto';

const QR_SECRET = process.env.QR_SECRET || 'onlyfounders-qr-secret-key-2026';

// Generate unique Entity ID (e.g., OF-2026-A7F3)
function generateEntityId(): string {
    const year = new Date().getFullYear();
    const randomHex = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `OF-${year}-${randomHex}`;
}

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

export async function POST(request: NextRequest) {
    try {
        const { photoUrl } = await request.json();

        if (!photoUrl) {
            return NextResponse.json(
                { error: 'Photo URL is required' },
                { status: 400 }
            );
        }

        await connectDB();

        // Get current authenticated user
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Check if user already has entity_id (already onboarded)
        const existingUser = await User.findById(currentUser.id).select('entityId qrToken');

        let entityId = existingUser?.entityId;
        let qrToken = existingUser?.qrToken;

        // Generate new entity_id if not exists
        if (!entityId) {
            // Generate unique entity_id with retry logic
            let attempts = 0;
            const maxAttempts = 5;

            while (attempts < maxAttempts) {
                entityId = generateEntityId();
                
                // Check if entity_id already exists
                const existing = await User.findOne({ entityId }).select('_id');

                if (!existing) break;
                attempts++;
            }

            if (attempts >= maxAttempts) {
                return NextResponse.json(
                    { error: 'Failed to generate unique Entity ID. Please try again.' },
                    { status: 500 }
                );
            }
        }

        // Always generate fresh QR token (entityId is guaranteed to exist at this point)
        qrToken = generateQRToken(entityId as string);

        // Update user with photo, entity_id, and qr_token
        await User.findByIdAndUpdate(currentUser.id, {
            photoUrl: photoUrl,
            photoUploadedAt: new Date(),
            entityId: entityId,
            qrToken: qrToken,
            qrGeneratedAt: new Date(),
        });

        // Log the onboarding completion
        await AuditLog.create({
            eventType: 'onboarding_completed',
            actorId: currentUser.id,
            targetId: currentUser.id,
            metadata: {
                entityId: entityId,
                photoUploaded: true,
            },
        });

        return NextResponse.json({
            success: true,
            entityId,
            message: 'Onboarding completed successfully',
        });
    } catch (error) {
        console.error('Onboarding error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
