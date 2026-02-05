/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb/connection';
import { User, Team, College, Cluster, IUser, ITeam, ICluster } from '@/lib/mongodb/models';
import { getSession, requireRole } from '@/lib/mongodb/auth';
import mongoose from 'mongoose';

// Cluster definitions
const CLUSTERS = [
    'ALPHA_SECTOR',
    'BETA_SECTOR',
    'GAMMA_SECTOR',
    'DELTA_SECTOR',
    'EPSILON_SECTOR'
];

const MAX_ADMINS_PER_CLUSTER = 3;

// ------------------------------------------------------------------
// GET HANDLER: Dashboard Stats
// ------------------------------------------------------------------
export async function GET() {
    try {
        await connectDB();

        // Verify user is super admin
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const user = await User.findById(session.userId);
        if (!user || user.role !== 'super_admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        // Get global user count
        const totalGlobalUsers = await User.countDocuments();

        // Fetch all colleges
        const colleges = await College.find({}).sort({ name: 1 });

        // Get stats for each college
        const collegesWithStats = await Promise.all(
            colleges.map(async (college) => {
                const studentCount = await User.countDocuments({ collegeId: college._id });
                const teamCount = await Team.countDocuments({ collegeId: college._id });

                return {
                    id: college._id,
                    name: college.name,
                    location: college.location,
                    logo_url: college.logoUrl,
                    created_at: college.createdAt,
                    updated_at: college.updatedAt,
                    students: studentCount,
                    teams: teamCount
                };
            })
        );

        // Calculate aggregates
        const totalColleges = collegesWithStats.length;
        const activeColleges = collegesWithStats.length; // All are active by default
        const totalTeams = collegesWithStats.reduce((sum, c) => sum + c.teams, 0);

        return NextResponse.json({
            colleges: collegesWithStats,
            stats: {
                totalColleges,
                activeColleges,
                totalUsers: totalGlobalUsers,
                totalTeams
            }
        });

    } catch (error) {
        console.error('Super admin GET error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// ------------------------------------------------------------------
// POST HANDLER: Global Actions
// ------------------------------------------------------------------
export async function POST(req: Request) {
    try {
        await connectDB();

        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await User.findById(session.userId);
        if (!user || user.role !== 'super_admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await req.json();
        const { action, payload } = body;

        switch (action) {
            case 'SHUFFLE_TEAMS':
                return await handleShuffleSimulation();

            case 'SET_PHASE':
                return await handleSetPhase(payload);

            case 'FETCH_USERS':
                return await handleFetchUsers();

            case 'UPDATE_ROLE':
                return await handleUpdateRole(payload);

            case 'UPDATE_PERMISSION':
                return await handleUpdatePermission(payload);

            case 'ADD_USER':
                return await handleAddUser(payload);

            case 'DELETE_USER':
                return await handleDeleteUser(payload);

            case 'ASSIGN_CLUSTER':
                return await handleAssignCluster(payload);

            case 'FETCH_CLUSTERS':
                return await handleFetchClusters();

            case 'FETCH_CLUSTERS_WITH_TEAMS':
                return await handleFetchClustersWithTeams();

            case 'REASSIGN_TEAM':
                return await handleReassignTeam(payload);

            case 'EXECUTE_SHUFFLE':
                return await handleExecuteShuffle();

            default:
                return NextResponse.json({ error: 'Invalid Action' }, { status: 400 });
        }

    } catch (error) {
        console.error('Super admin POST error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// ------------------------------------------------------------------
// Handler Functions
// ------------------------------------------------------------------

async function handleDeleteUser(payload: any) {
    const { id } = payload;

    await User.findByIdAndUpdate(id, {
        isActive: false,
        role: 'participant' // Downgrade role instead of deleting
    });

    return NextResponse.json({
        success: true,
        message: 'User disabled successfully'
    });
}

async function handleUpdateRole(payload: any) {
    const { id, role } = payload;

    await User.findByIdAndUpdate(id, { role });

    return NextResponse.json({ success: true });
}

async function handleUpdatePermission(payload: any) {
    // Note: For MongoDB, we might store permissions differently
    // This is a placeholder that can be expanded
    return NextResponse.json({ success: true });
}

async function handleAddUser(payload: any) {
    const { full_name, email, role } = payload;
    const bcrypt = require('bcryptjs');

    // Generate a temporary password
    const tempPassword = await bcrypt.hash('TempPass123!', 12);

    const newUser = new User({
        fullName: full_name,
        email: email.toLowerCase(),
        password: tempPassword,
        role: role || 'participant',
        isActive: true
    });

    await newUser.save();

    return NextResponse.json({ success: true, userId: newUser._id });
}

async function handleShuffleSimulation() {
    const teams = await Team.find({}).select('_id name');

    if (!teams || teams.length === 0) {
        return NextResponse.json({ error: 'No teams to shuffle' }, { status: 400 });
    }

    // Fisher-Yates shuffle
    const shuffled = [...teams];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const assignments: Record<string, any[]> = {};
    CLUSTERS.forEach(c => assignments[c] = []);

    // Round-robin distribution
    for (let i = 0; i < shuffled.length; i++) {
        const clusterName = CLUSTERS[i % CLUSTERS.length];
        assignments[clusterName].push({
            id: shuffled[i]._id,
            name: shuffled[i].name,
            status: 'PREVIEW'
        });
    }

    return NextResponse.json({
        success: true,
        data: assignments,
        message: `Generated preview for ${teams.length} teams.`
    });
}

async function handleSetPhase(payload: any) {
    const { phase } = payload;
    const VALID_PHASES = ['NETWORK', 'PITCH', 'VOTE', 'LOCKED'];

    if (!VALID_PHASES.includes(phase)) {
        return NextResponse.json({ error: 'Invalid Phase' }, { status: 400 });
    }

    // Store in EventState collection or similar
    return NextResponse.json({ success: true, phase });
}

async function handleFetchUsers() {
    const users = await User.find({
        role: { $in: ['admin', 'cluster_monitor', 'super_admin', 'gate_volunteer'] }
    })
        .select('_id fullName email role collegeId assignedClusterId createdAt')
        .populate('collegeId');

    return NextResponse.json({
        success: true,
        users: users.map(u => ({
            id: u._id,
            full_name: u.fullName,
            email: u.email,
            role: u.role,
            college_id: u.collegeId,
            assigned_cluster_id: u.assignedClusterId ? u.assignedClusterId.toString() : null,
            created_at: u.createdAt
        }))
    });
}

async function handleAssignCluster(payload: any) {
    const { userId, clusterId } = payload;

    // If unassigning
    if (!clusterId) {
        await User.findByIdAndUpdate(userId, { assignedClusterId: null });
        return NextResponse.json({ success: true, message: 'User unassigned from cluster' });
    }

    // Check max admins per cluster (check for 'admin' role which is used for cluster admins)
    const existingAdmins = await User.countDocuments({
        assignedClusterId: new mongoose.Types.ObjectId(clusterId),
        role: { $in: ['admin', 'cluster_monitor', 'super_admin'] },
        _id: { $ne: new mongoose.Types.ObjectId(userId) }
    });

    if (existingAdmins >= MAX_ADMINS_PER_CLUSTER) {
        return NextResponse.json({
            error: `Maximum ${MAX_ADMINS_PER_CLUSTER} admins allowed per cluster`
        }, { status: 400 });
    }

    await User.findByIdAndUpdate(userId, {
        assignedClusterId: new mongoose.Types.ObjectId(clusterId)
    });

    return NextResponse.json({ success: true });
}

async function handleFetchClusters() {
    const clusters = await Cluster.find({})
        .populate('monitorId')
        .populate('winnerTeamId');

    // Get admin counts for each cluster
    const clustersWithAdmins = await Promise.all(
        clusters.map(async (c) => {
            const admins = await User.find({
                assignedClusterId: c._id,
                role: { $in: ['admin', 'cluster_monitor', 'super_admin'] }
            }).select('_id fullName email role');

            return {
                id: c._id.toString(),
                name: c.name,
                location: c.location,
                monitor_id: c.monitorId ? c.monitorId._id?.toString() : null,
                current_stage: c.currentStage,
                max_teams: c.maxTeams,
                pitch_duration_seconds: c.pitchDurationSeconds,
                bidding_open: c.biddingOpen,
                is_complete: c.isComplete,
                winner_team_id: c.winnerTeamId ? c.winnerTeamId._id?.toString() : null,
                // Add admin tracking
                adminCount: admins.length,
                maxAdmins: MAX_ADMINS_PER_CLUSTER,
                admins: admins.map(a => ({
                    id: a._id.toString(),
                    full_name: a.fullName,
                    email: a.email,
                    role: a.role
                }))
            };
        })
    );

    return NextResponse.json({
        success: true,
        clusters: clustersWithAdmins
    });
}

async function handleFetchClustersWithTeams() {
    const clusters = await Cluster.find({});

    const clustersWithTeams = await Promise.all(
        clusters.map(async (cluster) => {
            const teams = await Team.find({ clusterId: cluster._id })
                .populate('collegeId');

            const teamMembers = await Promise.all(
                teams.map(async (team) => {
                    const members = await User.find({ teamId: team._id })
                        .select('_id fullName email role');
                    return {
                        id: team._id,
                        name: team.name,
                        domain: team.domain,
                        college: team.collegeId,
                        balance: team.balance,
                        total_invested: team.totalInvested,
                        total_received: team.totalReceived,
                        is_finalized: team.isFinalized,
                        members: members.map(m => ({
                            id: m._id,
                            full_name: m.fullName,
                            email: m.email,
                            role: m.role
                        }))
                    };
                })
            );

            return {
                id: cluster._id,
                name: cluster.name,
                location: cluster.location,
                current_stage: cluster.currentStage,
                bidding_open: cluster.biddingOpen,
                teams: teamMembers
            };
        })
    );

    // Fetch unassigned teams (teams without a cluster)
    const unassignedTeamsRaw = await Team.find({
        $or: [{ clusterId: null }, { clusterId: { $exists: false } }]
    }).populate('collegeId');

    const unassignedTeams = await Promise.all(
        unassignedTeamsRaw.map(async (team) => {
            const members = await User.find({ teamId: team._id })
                .select('_id fullName email role');
            return {
                id: team._id,
                name: team.name,
                domain: team.domain,
                college: team.collegeId,
                balance: team.balance,
                total_invested: team.totalInvested,
                total_received: team.totalReceived,
                is_finalized: team.isFinalized,
                members: members.map(m => ({
                    id: m._id,
                    full_name: m.fullName,
                    email: m.email,
                    role: m.role
                }))
            };
        })
    );

    return NextResponse.json({
        success: true,
        clusters: clustersWithTeams,
        unassignedTeams: unassignedTeams
    });
}

async function handleReassignTeam(payload: any) {
    const { teamId, newClusterId } = payload;

    await Team.findByIdAndUpdate(teamId, {
        clusterId: newClusterId ? new mongoose.Types.ObjectId(newClusterId) : null
    });

    return NextResponse.json({ success: true });
}

async function handleExecuteShuffle() {
    const teams = await Team.find({});

    if (!teams || teams.length === 0) {
        return NextResponse.json({ error: 'No teams to shuffle' }, { status: 400 });
    }

    // Ensure clusters exist
    for (const clusterName of CLUSTERS) {
        const existing = await Cluster.findOne({ name: clusterName });
        if (!existing) {
            await Cluster.create({
                name: clusterName,
                maxTeams: 10,
                pitchDurationSeconds: 180,
                currentStage: 'onboarding'
            });
        }
    }

    // Get all clusters
    const clusters = await Cluster.find({ name: { $in: CLUSTERS } });
    const clusterMap = new Map(clusters.map(c => [c.name, c._id]));

    // Fisher-Yates shuffle
    const shuffled = [...teams];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Assign teams to clusters
    const bulkOps = shuffled.map((team, index) => {
        const clusterName = CLUSTERS[index % CLUSTERS.length];
        const clusterId = clusterMap.get(clusterName);
        return {
            updateOne: {
                filter: { _id: team._id },
                update: { $set: { clusterId } }
            }
        };
    });

    await Team.bulkWrite(bulkOps);

    return NextResponse.json({
        success: true,
        message: `Shuffled ${teams.length} teams across ${CLUSTERS.length} clusters`
    });
}
