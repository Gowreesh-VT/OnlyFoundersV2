import { createAdminClient, createAnonClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { generateSecurePassword, sendBulkCredentials } from '@/lib/email/sender';
import crypto from 'crypto';

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
    role: 'participant' | 'team_lead' | 'admin' | 'super_admin' | 'gate_volunteer' | 'event_coordinator';
    phoneNumber?: string;
    domain?: string;
}

export async function POST(request: NextRequest) {
    try {
        // SECURITY: Verify user is authenticated and authorized
        const supabase = await createAnonClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json(
                { error: 'Not authenticated' },
                { status: 401 }
            );
        }

        const supabaseAdmin = createAdminClient();

        // Verify user is admin or super_admin
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
            return NextResponse.json(
                { error: 'Unauthorized - Admin access required' },
                { status: 403 }
            );
        }

        const { participants } = await request.json() as { participants: CSVParticipant[] };

        if (!participants || !Array.isArray(participants)) {
            return NextResponse.json(
                { error: 'Invalid participants data' },
                { status: 400 }
            );
        }

        const results = {
            success: [] as any[],
            failed: [] as any[],
        };

        const emailList: Array<{
            email: string;
            fullName: string;
            password: string;
        }> = [];

        for (const participant of participants) {
            try {
                // 1. Resolve College ID
                let collegeId = null;
                if (participant.collegeName) {
                    const { data: college } = await supabaseAdmin
                        .from('colleges')
                        .select('id')
                        .ilike('name', participant.collegeName)
                        .maybeSingle();

                    collegeId = college?.id || null;
                }


                let teamId = null;
                if (participant.teamName) {
                    // A. Try to find existing team
                    const { data: existingTeam } = await supabaseAdmin
                        .from('teams')
                        .select('id')
                        .ilike('name', participant.teamName)
                        .maybeSingle();

                    if (existingTeam) {
                        teamId = existingTeam.id;
                    } else {

                        console.log(`Team '${participant.teamName}' not found. Creating new team...`);

                        const { data: newTeam, error: createTeamError } = await supabaseAdmin
                            .from('teams')
                            .insert({
                                name: participant.teamName,
                                college_id: collegeId,
                                domain: participant.domain || 'general'
                            })
                            .select('id')
                            .single();

                        if (createTeamError) {
                            console.error(`Failed to create team ${participant.teamName}:`, createTeamError);

                        } else {
                            teamId = newTeam.id;
                        }
                    }
                }

                // 3. Generate Credentials
                const password = generateSecurePassword(12);
                const entityId = generateEntityId();
                const qrToken = generateQRToken(entityId);

                // 4. Create Auth User
                const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
                    email: participant.email,
                    password,
                    email_confirm: true,
                    user_metadata: { full_name: participant.fullName }
                });

                if (authError) throw authError;

                // 5. Create Profile (Linked to the resolved/created teamId)
                const { error: profileError } = await supabaseAdmin
                    .from('profiles')
                    .insert({
                        id: authData.user.id,
                        email: participant.email,
                        full_name: participant.fullName,
                        phone_number: participant.phoneNumber?.toString() || null,
                        role: participant.role,
                        entity_id: entityId,
                        qr_token: qrToken,
                        college_id: collegeId,
                        team_id: teamId,
                    });

                if (profileError) throw profileError;

                results.success.push({
                    email: participant.email,
                    team: participant.teamName,
                    action: teamId ? 'Linked' : 'No Team',
                });

                emailList.push({
                    email: participant.email,
                    fullName: participant.fullName,
                    password,
                });

            } catch (error: any) {
                console.error(`Error processing ${participant.email}:`, error.message);
                results.failed.push({
                    email: participant.email,
                    error: error.message,
                });
            }
        }

        // Step 6: Send emails in bulk
        let emailResults: { success: string[]; failed: { email: string; error: string }[] } = {
            success: [],
            failed: []
        };

        if (emailList.length > 0) {
            emailResults = await sendBulkCredentials(emailList);
        }

        return NextResponse.json({
            message: 'Bulk import completed',
            imported: results.success.length,
            failed: results.failed.length,
            emailsSent: emailResults.success.length || 0,
            emailsFailed: emailResults.failed.length || 0,
            details: {
                importResults: results,
                emailResults,
            },
        });

    } catch (error: any) {
        console.error('Bulk import error:', error);
        return NextResponse.json(
            { error: 'Bulk import failed: ' + error.message },
            { status: 500 }
        );
    }
}