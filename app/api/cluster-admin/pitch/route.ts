/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb/connection';
import { User, Team, Cluster, PitchSchedule, ICluster } from '@/lib/mongodb/models';
import { getSession } from '@/lib/mongodb/auth';
import mongoose from 'mongoose';

// ------------------------------------------------------------------
// GET HANDLER: Fetch cluster data for cluster admin
// ------------------------------------------------------------------
export async function GET(request: NextRequest) {
    try {
        await connectDB();

        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const user = await User.findById(session.userId);
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Check if user is admin (admin = cluster admin, cluster_monitor = legacy)
        if (!['admin', 'cluster_monitor', 'super_admin'].includes(user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');

        if (action === 'GET_CLUSTER_DATA') {
            const clusterId = searchParams.get('clusterId');

            if (!clusterId) {
                return NextResponse.json({ error: 'Cluster ID required' }, { status: 400 });
            }

            // Fetch cluster
            const cluster = await Cluster.findById(clusterId);
            if (!cluster) {
                return NextResponse.json({ error: 'Cluster not found' }, { status: 404 });
            }

            // Fetch teams in this cluster with their members
            const teams = await Team.find({ clusterId: cluster._id })
                .populate('collegeId');

            const teamsWithMembers = await Promise.all(
                teams.map(async (team) => {
                    const members = await User.find({ teamId: team._id })
                        .select('_id fullName email role photoUrl');
                    return {
                        id: team._id,
                        name: team.name,
                        domain: team.domain,
                        tags: team.tags,
                        balance: team.balance,
                        total_invested: team.totalInvested,
                        total_received: team.totalReceived,
                        is_finalized: team.isFinalized,
                        is_qualified: team.isQualified,
                        college: team.collegeId ? {
                            id: (team.collegeId as any)._id,
                            name: (team.collegeId as any).name
                        } : null,
                        members: members.map(m => ({
                            id: m._id,
                            full_name: m.fullName,
                            email: m.email,
                            role: m.role,
                            photo_url: m.photoUrl
                        }))
                    };
                })
            );

            // Fetch pitch schedule for this cluster
            let schedule = await PitchSchedule.find({ clusterId: cluster._id })
                .populate('teamId')
                .sort({ pitchPosition: 1, scheduledStart: 1 });

            // Auto-create schedule if missing
            if (schedule.length === 0 && teams.length > 0) {
                const pitchDurationSeconds = cluster.pitchDurationSeconds || 180;
                const baseTime = Date.now();
                const scheduleDocs = teams.map((team, index) => ({
                    clusterId: cluster._id,
                    teamId: team._id,
                    scheduledStart: new Date(baseTime + index * pitchDurationSeconds * 1000),
                    pitchDurationSeconds,
                    status: 'scheduled',
                    pitchPosition: index + 1,
                    isCompleted: false
                }));

                await PitchSchedule.insertMany(scheduleDocs);

                schedule = await PitchSchedule.find({ clusterId: cluster._id })
                    .populate('teamId')
                    .sort({ pitchPosition: 1, scheduledStart: 1 });
            }

            return NextResponse.json({
                success: true,
                cluster: {
                    id: cluster._id,
                    name: cluster.name,
                    location: cluster.location,
                    current_stage: cluster.currentStage,
                    current_pitching_team_id: cluster.currentPitchingTeamId,
                    max_teams: cluster.maxTeams,
                    pitch_duration_seconds: cluster.pitchDurationSeconds,
                    bidding_deadline: cluster.biddingDeadline,
                    bidding_open: cluster.biddingOpen,
                    is_complete: cluster.isComplete
                },
                teams: teamsWithMembers,
                schedule: schedule.map(s => ({
                    id: s._id,
                    team_id: s.teamId,
                    team: s.teamId ? {
                        id: (s.teamId as any)._id,
                        name: (s.teamId as any).name,
                        domain: (s.teamId as any).domain
                    } : null,
                    pitch_title: s.pitchTitle,
                    pitch_abstract: s.pitchAbstract,
                    scheduled_start: s.scheduledStart,
                    scheduled_end: s.scheduledEnd,
                    actual_start: s.actualStart,
                    actual_end: s.actualEnd,
                    status: s.status,
                    pitch_position: s.pitchPosition,
                    pitch_duration_seconds: s.pitchDurationSeconds,
                    is_completed: s.isCompleted
                }))
            });
        }

        // Default: return user's assigned clusters
        let clusters: ICluster[];

        if (user.role === 'super_admin') {
            // Super admin sees all clusters
            clusters = await Cluster.find({});
        } else {
            // Admin/Cluster monitor sees only their assigned cluster
            if (user.assignedClusterId) {
                const cluster = await Cluster.findById(user.assignedClusterId);
                clusters = cluster ? [cluster] : [];
            } else {
                clusters = [];
            }
        }

        return NextResponse.json({
            success: true,
            clusters: clusters.map(c => ({
                id: c._id,
                name: c.name,
                location: c.location,
                current_stage: c.currentStage,
                bidding_open: c.biddingOpen,
                is_complete: c.isComplete
            }))
        });

    } catch (error) {
        console.error('Cluster admin GET error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// ------------------------------------------------------------------
// POST HANDLER: Pitch management actions
// ------------------------------------------------------------------
export async function POST(request: NextRequest) {
    try {
        await connectDB();

        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const user = await User.findById(session.userId);
        if (!user || !['admin', 'cluster_monitor', 'super_admin'].includes(user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const body = await request.json();
        const { action, payload } = body;

        switch (action) {
            case 'START_PITCH':
                return await handleStartPitch(payload);

            case 'END_PITCH':
                return await handleEndPitch(payload);

            case 'UPDATE_PITCH_STATUS':
                return await handleUpdatePitchStatus(payload);

            case 'OPEN_BIDDING':
                return await handleOpenBidding(payload);

            case 'CLOSE_BIDDING':
                return await handleCloseBidding(payload);

            case 'SET_CURRENT_TEAM':
                return await handleSetCurrentTeam(payload);

            case 'UPDATE_SCHEDULE':
                return await handleUpdateSchedule(payload);

            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

    } catch (error) {
        console.error('Cluster admin POST error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// ------------------------------------------------------------------
// Handler Functions
// ------------------------------------------------------------------

async function handleStartPitch(payload: any) {
    const { scheduleId, teamId, clusterId } = payload;

    // Update pitch schedule
    await PitchSchedule.findByIdAndUpdate(scheduleId, {
        status: 'in_progress',
        actualStart: new Date()
    });

    // Update cluster's current pitching team
    await Cluster.findByIdAndUpdate(clusterId, {
        currentPitchingTeamId: new mongoose.Types.ObjectId(teamId),
        currentStage: 'pitching'
    });

    return NextResponse.json({ success: true });
}

async function handleEndPitch(payload: any) {
    const { scheduleId, clusterId, teamId } = payload;

    // Update pitch schedule
    await PitchSchedule.findByIdAndUpdate(scheduleId, {
        status: 'completed',
        actualEnd: new Date(),
        isCompleted: true,
        completedAt: new Date()
    });

    // Lock all draft investments for this team (from other teams in the cluster)
    // This ensures the draft bids placed during this team's pitch are now locked
    if (teamId) {
        const { Investment } = await import('@/lib/mongodb/models');
        await Investment.updateMany(
            {
                targetTeamId: new mongoose.Types.ObjectId(teamId),
                isDraft: true,
                draftLocked: false
            },
            {
                draftLocked: true
            }
        );
    }

    // Clear current pitching team
    await Cluster.findByIdAndUpdate(clusterId, {
        currentPitchingTeamId: null
    });

    return NextResponse.json({ success: true, message: "Pitch ended and drafts locked" });
}

async function handleUpdatePitchStatus(payload: any) {
    const { scheduleId, status } = payload;

    await PitchSchedule.findByIdAndUpdate(scheduleId, { status });

    return NextResponse.json({ success: true });
}

async function handleOpenBidding(payload: any) {
    const { clusterId, deadline } = payload;

    await Cluster.findByIdAndUpdate(clusterId, {
        biddingOpen: true,
        biddingDeadline: deadline ? new Date(deadline) : null,
        currentStage: 'bidding'
    });

    return NextResponse.json({ success: true });
}

async function handleCloseBidding(payload: any) {
    const { clusterId } = payload;

    await Cluster.findByIdAndUpdate(clusterId, {
        biddingOpen: false,
        currentStage: 'locked'
    });

    return NextResponse.json({ success: true });
}

async function handleSetCurrentTeam(payload: any) {
    const { clusterId, teamId } = payload;

    await Cluster.findByIdAndUpdate(clusterId, {
        currentPitchingTeamId: teamId ? new mongoose.Types.ObjectId(teamId) : null
    });

    return NextResponse.json({ success: true });
}

async function handleUpdateSchedule(payload: any) {
    const { scheduleId, updates } = payload;

    await PitchSchedule.findByIdAndUpdate(scheduleId, updates);

    return NextResponse.json({ success: true });
}
