import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb/connection';
import { User, EntryLog, ScanSession } from '@/lib/mongodb/models';
import { getSession } from '@/lib/mongodb/auth';
import crypto from 'crypto';

const QR_SECRET = process.env.QR_SECRET || 'onlyfounders-qr-secret-key-2026';

export async function POST(request: NextRequest) {
    try {
        if (!QR_SECRET) {
            console.error('QR_SECRET not configured');
            return NextResponse.json(
                { error: 'Server configuration error' },
                { status: 500 }
            );
        }

        await connectDB();
        
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const gateUser = await User.findById(session.userId);
        if (!gateUser || !['gate_volunteer', 'super_admin', 'cluster_monitor'].includes(gateUser.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const body = await request.json();
        const { qrToken, scanType = 'entry', location } = body;

        if (!qrToken) {
            return NextResponse.json({ error: 'QR token is required' }, { status: 400 });
        }

        // Parse and validate QR token
        const parts = qrToken.split(':');
        if (parts.length !== 3) {
            return NextResponse.json({
                valid: false,
                status: 'invalid',
                error: 'Invalid QR format'
            });
        }

        const [entityId, timestamp, signature] = parts;

        // Verify signature
        const data = `${entityId}:${timestamp}`;
        const expectedSignature = crypto
            .createHmac('sha256', QR_SECRET)
            .update(data)
            .digest('hex');

        if (signature !== expectedSignature) {
            // Log invalid attempt
            await EntryLog.create({
                entityId,
                scannedBy: gateUser._id,
                status: 'invalid',
                location,
                scanType
            });

            return NextResponse.json({
                valid: false,
                status: 'invalid',
                error: 'Invalid QR signature'
            });
        }

        // Check if token is expired (24 hours)
        const tokenTime = parseInt(timestamp);
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        if (Date.now() - tokenTime > maxAge) {
            await EntryLog.create({
                entityId,
                scannedBy: gateUser._id,
                status: 'expired',
                location,
                scanType
            });

            return NextResponse.json({
                valid: false,
                status: 'expired',
                error: 'QR code has expired'
            });
        }

        // Find user by entity ID
        const participant = await User.findOne({ entityId })
            .populate('teamId')
            .populate('collegeId');

        if (!participant) {
            await EntryLog.create({
                entityId,
                scannedBy: gateUser._id,
                status: 'invalid',
                location,
                scanType
            });

            return NextResponse.json({
                valid: false,
                status: 'invalid',
                error: 'Participant not found'
            });
        }

        if (!participant.isActive) {
            return NextResponse.json({
                valid: false,
                status: 'invalid',
                error: 'Participant account is deactivated'
            });
        }

        // Create entry log
        const entryLog = await EntryLog.create({
            entityId,
            profileId: participant._id,
            scannedBy: gateUser._id,
            status: 'valid',
            location,
            scanType,
            scannedAt: new Date()
        });

        // Handle scan sessions
        if (scanType === 'entry') {
            // Create new session
            await ScanSession.create({
                profileId: participant._id,
                entryScanId: entryLog._id,
                sessionStart: new Date(),
                isActive: true
            });
        } else if (scanType === 'exit') {
            // Close active session
            const activeSession = await ScanSession.findOne({
                profileId: participant._id,
                isActive: true
            }).sort({ sessionStart: -1 });

            if (activeSession) {
                const duration = Math.round(
                    (Date.now() - activeSession.sessionStart!.getTime()) / 60000
                );
                
                await ScanSession.findByIdAndUpdate(activeSession._id, {
                    exitScanId: entryLog._id,
                    sessionEnd: new Date(),
                    durationMinutes: duration,
                    isActive: false
                });
            }
        }

        return NextResponse.json({
            valid: true,
            status: 'valid',
            participant: {
                id: participant._id,
                entityId: participant.entityId,
                fullName: participant.fullName,
                email: participant.email,
                phoneNumber: participant.phoneNumber || null,
                role: participant.role,
                photoUrl: participant.photoUrl,
                team: participant.teamId ? {
                    id: (participant.teamId as any)._id,
                    name: (participant.teamId as any).name
                } : null,
                college: participant.collegeId ? {
                    id: (participant.collegeId as any)._id,
                    name: (participant.collegeId as any).name
                } : null
            },
            scanType,
            scannedAt: entryLog.scannedAt
        });

    } catch (error: any) {
        console.error('QR verification error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
