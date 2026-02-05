import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb/connection';
import { Cluster, Team, User, AuditLog } from '@/lib/mongodb/models';
import { getCurrentUser } from '@/lib/mongodb/auth';

// GET: Fetch all clusters with teams
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

        // Check if user is super_admin
        const user = await User.findById(currentUser.id).select('role');

        if (user?.role !== 'super_admin') {
            return NextResponse.json(
                { error: 'Forbidden - Super Admin access required' },
                { status: 403 }
            );
        }

        // Fetch all clusters
        const clusters = await Cluster.find({}).sort({ name: 1 });

        // Fetch all teams
        const teams = await Team.find({}).sort({ name: 1 });

        // Get unassigned teams
        const unassignedTeams = teams.filter(t => !t.clusterId);

        // Map teams to clusters
        const clustersWithTeams = clusters.map(cluster => ({
            id: cluster._id,
            name: cluster.name,
            location: cluster.location,
            monitorId: cluster.monitorId,
            maxTeams: cluster.maxTeams,
            currentStage: cluster.currentStage,
            biddingOpen: cluster.biddingOpen,
            isComplete: cluster.isComplete,
            winnerTeamId: cluster.winnerTeamId,
            createdAt: cluster.createdAt,
            teams: teams.filter(t => t.clusterId?.toString() === cluster._id.toString()).map(t => ({
                id: t._id,
                name: t.name,
                clusterId: t.clusterId,
                domain: t.domain,
                balance: t.balance,
                totalInvested: t.totalInvested,
                totalReceived: t.totalReceived,
                isFinalized: t.isFinalized,
                isQualified: t.isQualified,
            })),
        }));

        // Get statistics
        const stats = {
            totalClusters: clusters.length,
            totalTeams: teams.length,
            assignedTeams: teams.filter(t => t.clusterId).length,
            unassignedTeams: unassignedTeams.length,
        };

        return NextResponse.json({
            clusters: clustersWithTeams,
            unassignedTeams: unassignedTeams.map(t => ({
                id: t._id,
                name: t.name,
                domain: t.domain,
                balance: t.balance,
            })),
            stats,
        });
    } catch (error) {
        console.error('Clusters fetch error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// POST: Create a new cluster
export async function POST(request: NextRequest) {
    try {
        const { name, location, maxTeams } = await request.json();

        if (!name) {
            return NextResponse.json(
                { error: 'Cluster name is required' },
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

        // Check if user is super_admin
        const user = await User.findById(currentUser.id).select('role');

        if (user?.role !== 'super_admin') {
            return NextResponse.json(
                { error: 'Forbidden - Super Admin access required' },
                { status: 403 }
            );
        }

        // Create cluster
        const cluster = await Cluster.create({
            name,
            location: location || undefined,
            maxTeams: maxTeams || 10,
            currentStage: 'onboarding',
        });

        // Log the action
        await AuditLog.create({
            eventType: 'cluster_created',
            actorId: currentUser.id,
            targetId: cluster._id.toString(),
            metadata: { clusterName: name },
        });

        return NextResponse.json({
            success: true,
            cluster: {
                id: cluster._id,
                name: cluster.name,
                location: cluster.location,
                maxTeams: cluster.maxTeams,
                currentStage: cluster.currentStage,
            },
        });
    } catch (error) {
        console.error('Cluster create error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
