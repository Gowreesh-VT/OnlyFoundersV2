import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb/connection';
import { User, Team, College, IUser } from '@/lib/mongodb/models';
import { getSession, hashPassword } from '@/lib/mongodb/auth';
import { generateSecurePassword, sendBulkCredentials } from '@/lib/email/sender';
import crypto from 'crypto';
import mongoose from 'mongoose';

function generateEntityId(): string {
    const year = new Date().getFullYear();
    const randomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `OF-${year}-${randomSuffix}`;
}

function generateQRToken(entityId: string): string {
    const timestamp = Date.now();
    const secret = process.env.QR_SECRET;
    if (!secret) {
        throw new Error('QR_SECRET environment variable is not configured');
    }
    const data = `${entityId}:${timestamp}`;
    const signature = crypto.createHmac('sha256', secret).update(data).digest('hex');
    return `${data}:${signature}`;
}

interface CSVParticipant {
    fullName: string;
    email: string;
    collegeName: string;
    teamName: string;
    role: 'participant' | 'team_lead' | 'cluster_monitor' | 'gate_volunteer' | 'super_admin' | 'admin' | 'event_coordinator';
    phoneNumber?: string;
    domain?: string;
}

export async function POST(request: NextRequest) {
    try {
        await connectDB();

        // Verify user is authenticated and authorized
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const user = await User.findById(session.userId);
        if (!user || !['super_admin', 'cluster_monitor'].includes(user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const body = await request.json();
        const { participants, sendEmails = false } = body as {
            participants: CSVParticipant[],
            sendEmails?: boolean
        };

        if (!participants || !Array.isArray(participants) || participants.length === 0) {
            return NextResponse.json({ error: 'No participants provided' }, { status: 400 });
        }

        const results: {
            success: any[];
            errors: any[];
        } = { success: [], errors: [] };

        // Cache for colleges and teams to avoid repeated queries
        const collegeCache = new Map<string, mongoose.Types.ObjectId>();
        const teamCache = new Map<string, mongoose.Types.ObjectId>();

        // Roles that don't need college/team
        const nonParticipantRoles = ['super_admin', 'gate_volunteer', 'cluster_monitor', 'admin', 'event_coordinator'];

        for (const participant of participants) {
            try {
                const isNonParticipant = nonParticipantRoles.includes(participant.role);

                // Validate required fields - college/team only required for participants
                if (!participant.fullName || !participant.email) {
                    results.errors.push({
                        email: participant.email || 'unknown',
                        error: 'Missing required fields (fullName or email)'
                    });
                    continue;
                }

                // Participants and team_leads need college/team
                if (!isNonParticipant) {
                    if (!participant.collegeName || !participant.teamName) {
                        results.errors.push({
                            email: participant.email,
                            error: 'Participants and team leads require collegeName and teamName'
                        });
                        continue;
                    }
                }

                // Check if user already exists
                const existingUser = await User.findOne({ email: participant.email.toLowerCase() });
                if (existingUser) {
                    results.errors.push({
                        email: participant.email,
                        error: 'User already exists'
                    });
                    continue;
                }

                // Get or create college (only if collegeName provided)
                let collegeId: mongoose.Types.ObjectId | undefined = undefined;
                if (participant.collegeName) {
                    collegeId = collegeCache.get(participant.collegeName);
                    if (!collegeId) {
                        let college = await College.findOne({ name: participant.collegeName });
                        if (!college) {
                            college = await College.create({ name: participant.collegeName });
                        }
                        collegeId = college._id as mongoose.Types.ObjectId;
                        collegeCache.set(participant.collegeName, collegeId);
                    }
                }

                // Get or create team (only if teamName provided)
                let teamId: mongoose.Types.ObjectId | undefined = undefined;
                if (participant.teamName && collegeId) {
                    const teamKey = `${participant.collegeName}:${participant.teamName}`;
                    teamId = teamCache.get(teamKey);
                    if (!teamId) {
                        let team = await Team.findOne({
                            name: participant.teamName,
                            collegeId
                        });
                        if (!team) {
                            team = await Team.create({
                                name: participant.teamName,
                                collegeId,
                                domain: participant.domain || undefined,
                                balance: 1000000,
                                totalInvested: 0,
                                totalReceived: 0
                            });
                        }
                        teamId = team._id as mongoose.Types.ObjectId;
                        teamCache.set(teamKey, teamId);
                    }
                }

                // Generate credentials
                const password = generateSecurePassword(12);
                const hashedPassword = await hashPassword(password);
                const entityId = generateEntityId();
                const qrToken = generateQRToken(entityId);

                // Create user - only include teamId/collegeId if they exist
                const userData: any = {
                    email: participant.email.toLowerCase(),
                    password: hashedPassword,
                    fullName: participant.fullName,
                    phoneNumber: participant.phoneNumber || undefined,
                    role: participant.role || 'participant',
                    entityId,
                    qrToken,
                    qrGeneratedAt: new Date(),
                    isActive: true,
                    loginCount: 0
                };

                if (teamId) userData.teamId = teamId;
                if (collegeId) userData.collegeId = collegeId;

                const newUser = await User.create(userData);

                results.success.push({
                    email: participant.email,
                    fullName: participant.fullName,
                    entityId,
                    password: password,
                    role: participant.role || 'participant',
                    teamName: participant.teamName || '-',
                    collegeName: participant.collegeName || '-',
                    userId: newUser._id
                });

                // Send credentials email if requested
                if (sendEmails) {
                    try {
                        await sendBulkCredentials([{
                            email: participant.email,
                            fullName: participant.fullName,
                            password,
                            entityId
                        }]);
                    } catch (emailError) {
                        console.error(`Failed to send email to ${participant.email}:`, emailError);
                    }
                }

            } catch (error: any) {
                console.error(`Error processing ${participant.email}:`, error);
                results.errors.push({
                    email: participant.email,
                    error: error.message || 'Unknown error'
                });
            }
        }

        // Count emails sent (only if sendEmails was true and participant was successful)
        const emailsSent = sendEmails ? results.success.length : 0;

        // Log credentials to console for easy copy-paste
        console.log('\n========== BULK IMPORT CREDENTIALS ==========');
        console.log('Copy the data below:\n');
        console.log('Email,Password,EntityId,FullName,Team,College');
        results.success.forEach((user: any) => {
            console.log(`${user.email},${user.password},${user.entityId},${user.fullName},${user.teamName},${user.collegeName}`);
        });
        console.log('\n==============================================\n');

        // Log errors if any
        if (results.errors.length > 0) {
            console.log('\n========== BULK IMPORT ERRORS ==========');
            results.errors.forEach((err: any) => {
                console.log(`❌ ${err.email}: ${err.error}`);
            });
            console.log('\n=========================================\n');
        }

        return NextResponse.json({
            success: true,
            message: `Processed ${participants.length} participants`,
            imported: results.success.length,
            failed: results.errors.length,
            emailsSent: emailsSent,
            results: {
                successCount: results.success.length,
                errorCount: results.errors.length,
                details: results
            }
        });

    } catch (error: any) {
        console.error('Bulk import error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
