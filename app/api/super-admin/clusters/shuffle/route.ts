import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb/connection';
import { Cluster, Team, User, AuditLog } from '@/lib/mongodb/models';
import { getCurrentUser } from '@/lib/mongodb/auth';

// Fisher-Yates shuffle algorithm
function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// POST: Shuffle teams and assign to clusters
export async function POST(request: NextRequest) {
    try {
        const { clearPrevious = true, teamsPerCluster = 10 } = await request.json();

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

        // Fetch all teams
        const teams = await Team.find({}).select('_id name').sort({ name: 1 });

        if (!teams || teams.length === 0) {
            return NextResponse.json(
                { error: 'No teams found to shuffle' },
                { status: 400 }
            );
        }

        // Fetch all clusters
        const clusters = await Cluster.find({}).select('_id name maxTeams').sort({ name: 1 });

        if (!clusters || clusters.length === 0) {
            return NextResponse.json(
                { error: 'No clusters found. Please create clusters first.' },
                { status: 400 }
            );
        }

        // Clear previous assignments if requested
        if (clearPrevious) {
            await Team.updateMany({}, { clusterId: null });
        }

        // Shuffle teams
        const shuffledTeams = shuffleArray(teams);

        // Distribute teams to clusters
        const assignments: { teamId: string; teamName: string; clusterId: string; clusterName: string }[] = [];
        let clusterIndex = 0;
        const clusterCounts: Record<string, number> = {};

        // Initialize cluster counts
        clusters.forEach(c => {
            clusterCounts[c._id.toString()] = 0;
        });

        for (const team of shuffledTeams) {
            // Find next cluster with available space
            let foundCluster = false;
            let attempts = 0;

            while (!foundCluster && attempts < clusters.length) {
                const cluster = clusters[clusterIndex];
                const maxTeams = cluster.maxTeams || teamsPerCluster;

                if (clusterCounts[cluster._id.toString()] < maxTeams) {
                    // Assign team to cluster
                    await Team.findByIdAndUpdate(team._id, { clusterId: cluster._id });

                    assignments.push({
                        teamId: team._id.toString(),
                        teamName: team.name,
                        clusterId: cluster._id.toString(),
                        clusterName: cluster.name,
                    });
                    clusterCounts[cluster._id.toString()]++;
                    foundCluster = true;
                }

                clusterIndex = (clusterIndex + 1) % clusters.length;
                attempts++;
            }

            if (!foundCluster) {
                console.warn(`Could not assign team ${team.name} - all clusters full`);
            }
        }

        // Log the shuffle action
        await AuditLog.create({
            eventType: 'team_shuffle_completed',
            actorId: currentUser.id,
            metadata: {
                totalTeams: teams.length,
                assignedTeams: assignments.length,
                clustersUsed: clusters.length,
                teamsPerCluster: teamsPerCluster,
            },
        });

        // Get final cluster stats
        const clusterStats = clusters.map(c => ({
            id: c._id.toString(),
            name: c.name,
            teamCount: clusterCounts[c._id.toString()],
            maxTeams: c.maxTeams || teamsPerCluster,
        }));

        return NextResponse.json({
            success: true,
            message: `Successfully assigned ${assignments.length} teams to ${clusters.length} clusters`,
            stats: {
                totalTeams: teams.length,
                assignedTeams: assignments.length,
                unassignedTeams: teams.length - assignments.length,
            },
            clusterStats,
            assignments,
        });
    } catch (error) {
        console.error('Shuffle error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
