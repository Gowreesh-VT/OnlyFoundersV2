import { NextRequest } from 'next/server';
import { getSession } from '@/lib/mongodb/auth';
import { connectDB } from '@/lib/mongodb/connection';
import { Team, Cluster, PitchSchedule, Investment } from '@/lib/mongodb/models';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return new Response('Unauthorized', { status: 401 });
    }

    await connectDB();

    // Get user's team
    const team = await Team.findOne({ members: session.userId });
    if (!team) {
      return new Response('Team not found', { status: 404 });
    }

    const clusterId = team.clusterId;

    // Create a readable stream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const sendUpdate = async () => {
          try {
            // Fetch current state
            const [cluster, activePitch, clusterTeams, investments] = await Promise.all([
              Cluster.findById(clusterId),
              PitchSchedule.findOne({ 
                clusterId, 
                status: 'in_progress' 
              }).populate('teamId'),
              Team.find({ clusterId }).select('_id name totalReceived isFinalized'),
              Investment.find({ investorTeamId: team._id })
            ]);

            if (!cluster) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Cluster not found' })}\n\n`));
              return;
            }

            // Get populated team data
            const pitchingTeam = activePitch?.teamId as any;

            // Build investment states
            const investmentStates: Record<string, {
              amount: number;
              is_draft: boolean;
              draft_locked: boolean;
              is_locked: boolean;
            }> = {};

            investments.forEach((inv: { targetTeamId: { toString: () => string }; amount: number; isDraft: boolean; draftLocked: boolean; isLocked: boolean }) => {
              investmentStates[inv.targetTeamId.toString()] = {
                amount: inv.amount,
                is_draft: inv.isDraft,
                draft_locked: inv.draftLocked,
                is_locked: inv.isLocked
              };
            });

            // Check if all teams finalized
            const allFinalized = clusterTeams.every((t: { isFinalized: boolean }) => t.isFinalized);

            // Build market data (only if all finalized and bidding closed)
            let marketData: Array<{ teamId: string; teamName: string; totalReceived: number }> = [];
            if (allFinalized && !cluster.biddingOpen) {
              marketData = clusterTeams.map((t: { _id: { toString: () => string }; name: string; totalReceived: number }) => ({
                teamId: t._id.toString(),
                teamName: t.name,
                totalReceived: t.totalReceived || 0
              })).sort((a: { totalReceived: number }, b: { totalReceived: number }) => b.totalReceived - a.totalReceived);
            }

            const data = {
              isPitching: !!activePitch,
              currentPitchingTeamId: pitchingTeam?._id?.toString() || null,
              currentPitchingTeamName: pitchingTeam?.name || null,
              pitchStartTime: activePitch?.actualStart || null,
              pitchDuration: activePitch?.pitchDurationSeconds || cluster.pitchDurationSeconds,
              biddingOpen: cluster.biddingOpen,
              investmentStates,
              allFinalized,
              marketData,
              timestamp: Date.now()
            };

            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch (error) {
            console.error('SSE update error:', error);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Update failed' })}\n\n`));
          }
        };

        // Send initial data
        await sendUpdate();

        // Set up interval for updates (every 3 seconds)
        const intervalId = setInterval(sendUpdate, 3000);

        // Clean up on client disconnect
        request.signal.addEventListener('abort', () => {
          clearInterval(intervalId);
          controller.close();
        });
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('SSE stream error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
