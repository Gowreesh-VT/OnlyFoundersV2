import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb/connection';
import { User, Team, Cluster, PitchSchedule } from '@/lib/mongodb/models';
import { getSession } from '@/lib/mongodb/auth';

// ------------------------------------------------------------------
// GET: Fetch active pitch for a cluster (accessible by all authenticated users)
// ------------------------------------------------------------------
export async function GET(request: NextRequest) {
    try {
        await connectDB();

        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const clusterId = searchParams.get('clusterId');

        if (!clusterId) {
            return NextResponse.json({ error: 'Cluster ID required' }, { status: 400 });
        }

        // Fetch cluster to get current pitching team and stage
        const cluster = await Cluster.findById(clusterId);
        if (!cluster) {
            return NextResponse.json({ error: 'Cluster not found' }, { status: 404 });
        }

        // If no current pitching team, return null
        if (!cluster.currentPitchingTeamId) {
            return NextResponse.json({
                activePitch: null,
                cluster: {
                    id: cluster._id,
                    name: cluster.name,
                    current_stage: cluster.currentStage,
                    bidding_open: cluster.biddingOpen
                }
            });
        }

        // Find the active pitch schedule entry
        const activePitchSchedule = await PitchSchedule.findOne({
            clusterId: cluster._id,
            teamId: cluster.currentPitchingTeamId,
            status: 'in_progress'
        });

        // Get the team details
        const pitchingTeam = await Team.findById(cluster.currentPitchingTeamId);

        if (!activePitchSchedule || !pitchingTeam) {
            // Fallback: check if there's any in_progress pitch
            const anyActivePitch = await PitchSchedule.findOne({
                clusterId: cluster._id,
                status: 'in_progress'
            }).populate('teamId');

            if (anyActivePitch && anyActivePitch.teamId) {
                const team = anyActivePitch.teamId as any;
                return NextResponse.json({
                    activePitch: {
                        id: anyActivePitch._id,
                        team_id: team._id,
                        pitch_title: anyActivePitch.pitchTitle,
                        pitch_abstract: anyActivePitch.pitchAbstract,
                        actual_start: anyActivePitch.actualStart,
                        pitch_duration_seconds: anyActivePitch.pitchDurationSeconds,
                        status: anyActivePitch.status,
                        team: {
                            id: team._id,
                            name: team.name,
                            domain: team.domain
                        }
                    },
                    cluster: {
                        id: cluster._id,
                        name: cluster.name,
                        current_stage: cluster.currentStage,
                        bidding_open: cluster.biddingOpen
                    }
                });
            }

            return NextResponse.json({
                activePitch: null,
                cluster: {
                    id: cluster._id,
                    name: cluster.name,
                    current_stage: cluster.currentStage,
                    bidding_open: cluster.biddingOpen
                }
            });
        }

        return NextResponse.json({
            activePitch: {
                id: activePitchSchedule._id,
                team_id: pitchingTeam._id,
                pitch_title: activePitchSchedule.pitchTitle,
                pitch_abstract: activePitchSchedule.pitchAbstract,
                actual_start: activePitchSchedule.actualStart,
                pitch_duration_seconds: activePitchSchedule.pitchDurationSeconds,
                status: activePitchSchedule.status,
                team: {
                    id: pitchingTeam._id,
                    name: pitchingTeam.name,
                    domain: pitchingTeam.domain
                }
            },
            cluster: {
                id: cluster._id,
                name: cluster.name,
                current_stage: cluster.currentStage,
                bidding_open: cluster.biddingOpen
            }
        });

    } catch (error) {
        console.error('Active pitch API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
