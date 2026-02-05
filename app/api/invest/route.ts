import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb/connection";
import { User, Team, Cluster, Investment, PitchSchedule, AuditLog } from "@/lib/mongodb/models";
import { getSession } from "@/lib/mongodb/auth";
import mongoose from "mongoose";

export async function GET(request: NextRequest) {
    try {
        await connectDB();

        // 1. Verify user is authenticated
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 2. Get user profile with team
        const user = await User.findById(session.userId);
        if (!user) {
            return NextResponse.json({ error: "Profile not found" }, { status: 404 });
        }

        if (!user.teamId) {
            return NextResponse.json({ error: "No team assigned" }, { status: 400 });
        }

        // Get user's team
        const userTeam = await Team.findById(user.teamId);
        if (!userTeam) {
            return NextResponse.json({ error: "Team not found" }, { status: 404 });
        }

        if (!userTeam.clusterId) {
            return NextResponse.json({ error: "Team not in a cluster" }, { status: 400 });
        }

        // 3. Get cluster data
        const cluster = await Cluster.findById(userTeam.clusterId);
        if (!cluster) {
            return NextResponse.json({ error: "Cluster not found" }, { status: 404 });
        }

        // 4. Get all teams in cluster
        const teamsData = await Team.find({ clusterId: userTeam.clusterId })
            .select('_id name domain balance totalInvested totalReceived isFinalized isQualified');

        // 5. Get pitch schedule for these teams (to know pitch status)
        const teamIds = teamsData.map(t => t._id);
        const pitchSchedules = await PitchSchedule.find({ teamId: { $in: teamIds } })
            .select('teamId pitchTitle pitchAbstract status isCompleted');

        // 6. Get currently pitching team
        const currentPitchingTeamId = cluster.currentPitchingTeamId?.toString();

        // Merge pitch info with teams
        const teamsWithPitch = teamsData.map(team => {
            const pitch = pitchSchedules.find(p => p.teamId.toString() === team._id.toString());
            return {
                id: team._id,
                name: team.name,
                domain: team.domain,
                balance: team.balance,
                total_invested: team.totalInvested,
                total_received: team.totalReceived,
                is_finalized: team.isFinalized,
                is_qualified: team.isQualified,
                pitch_title: pitch?.pitchTitle,
                pitch_abstract: pitch?.pitchAbstract,
                pitch_status: pitch?.status,
                pitch_completed: pitch?.isCompleted ?? false,
                is_pitching: team._id.toString() === currentPitchingTeamId
            };
        });

        // Filter out user's own team for investment targets
        const targetTeams = teamsWithPitch.filter(t => t.id.toString() !== userTeam._id.toString());

        // 7. Get user's existing investments (drafts and locked)
        const investments = await Investment.find({ investorTeamId: userTeam._id })
            .select('targetTeamId amount isDraft draftLocked isLocked');

        // 8. Calculate market valuation for each team (only from finalized investments)
        const allFinalizedInvestments = await Investment.find({
            targetTeamId: { $in: teamIds },
            isLocked: true
        }).select('targetTeamId amount');

        const marketValuations: Record<string, number> = {};
        allFinalizedInvestments.forEach(inv => {
            const tid = inv.targetTeamId.toString();
            marketValuations[tid] = (marketValuations[tid] || 0) + inv.amount;
        });

        // 9. Check if all teams in cluster have finalized
        const allTeamsFinalized = teamsData.every(t => t.isFinalized);

        return NextResponse.json({
            profile: {
                id: user._id,
                email: user.email,
                full_name: user.fullName,
                role: user.role
            },
            myTeam: {
                id: userTeam._id,
                name: userTeam.name,
                domain: userTeam.domain,
                balance: userTeam.balance,
                total_invested: userTeam.totalInvested,
                total_received: userTeam.totalReceived,
                is_finalized: userTeam.isFinalized,
                is_qualified: userTeam.isQualified,
                cluster_id: userTeam.clusterId
            },
            cluster: {
                id: cluster._id,
                name: cluster.name,
                current_stage: cluster.currentStage,
                current_pitching_team_id: currentPitchingTeamId,
                bidding_open: cluster.biddingOpen,
                bidding_deadline: cluster.biddingDeadline,
                max_teams: cluster.maxTeams,
                pitch_duration_seconds: cluster.pitchDurationSeconds
            },
            targetTeams,
            investments: investments.map(inv => ({
                target_team_id: inv.targetTeamId,
                amount: inv.amount,
                is_draft: inv.isDraft,
                draft_locked: inv.draftLocked,
                is_locked: inv.isLocked
            })),
            marketValuations: allTeamsFinalized ? marketValuations : {},
            allTeamsFinalized
        });

    } catch (error) {
        console.error("Invest API error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// POST - Handle various investment actions
export async function POST(request: NextRequest) {
    try {
        await connectDB();

        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
        }

        const user = await User.findById(session.userId);
        if (!user) {
            return NextResponse.json({ error: "Profile not found", success: false }, { status: 404 });
        }

        if (!user.teamId) {
            return NextResponse.json({ error: "No team assigned", success: false }, { status: 400 });
        }

        // Only team leads can place investments
        if (user.role !== 'team_lead' && user.role !== 'super_admin') {
            return NextResponse.json({ error: "Only team leads can manage investments", success: false }, { status: 403 });
        }

        const userTeam = await Team.findById(user.teamId);
        if (!userTeam) {
            return NextResponse.json({ error: "Team not found", success: false }, { status: 404 });
        }

        const cluster = await Cluster.findById(userTeam.clusterId);
        if (!cluster) {
            return NextResponse.json({ error: "Cluster not found", success: false }, { status: 404 });
        }

        const body = await request.json();
        const { action, investments, targetTeamId, amount } = body;

        switch (action) {
            case 'SAVE_DRAFT':
                // Save draft during pitching phase - for the currently pitching team
                return await handleSaveDraft(user, userTeam, cluster, targetTeamId, amount);

            case 'EDIT_DRAFT':
                // Edit a draft during bidding phase (after all pitches complete)
                return await handleEditDraft(user, userTeam, cluster, targetTeamId, amount);

            case 'COMMIT_PORTFOLIO':
                // Final commit of all investments
                return await handleCommitPortfolio(user, userTeam, cluster, investments);

            default:
                // Legacy support - treat as COMMIT_PORTFOLIO
                if (investments && Array.isArray(investments)) {
                    return await handleCommitPortfolio(user, userTeam, cluster, investments);
                }
                return NextResponse.json({ error: "Invalid action", success: false }, { status: 400 });
        }

    } catch (error) {
        console.error("Invest POST error:", error);
        return NextResponse.json({ error: "Internal server error", success: false }, { status: 500 });
    }
}

// Save draft during pitching (for the team currently pitching)
async function handleSaveDraft(user: any, userTeam: any, cluster: any, targetTeamId: string, amount: number) {
    // Verify we're in pitching stage
    if (cluster.currentStage !== 'pitching') {
        return NextResponse.json({ error: "Drafts can only be placed during pitching", success: false }, { status: 400 });
    }

    // Verify there's a team currently pitching
    if (!cluster.currentPitchingTeamId) {
        return NextResponse.json({ error: "No team is currently pitching", success: false }, { status: 400 });
    }

    // Verify the target is the currently pitching team
    if (cluster.currentPitchingTeamId.toString() !== targetTeamId) {
        return NextResponse.json({ error: "Can only draft for the currently pitching team", success: false }, { status: 400 });
    }

    // Can't draft for your own team
    if (userTeam._id.toString() === targetTeamId) {
        return NextResponse.json({ error: "Cannot invest in your own team", success: false }, { status: 400 });
    }

    // Check if draft for this team is already locked (pitch completed)
    const existingInv = await Investment.findOne({
        investorTeamId: userTeam._id,
        targetTeamId: new mongoose.Types.ObjectId(targetTeamId)
    });

    if (existingInv?.draftLocked) {
        return NextResponse.json({ error: "Draft for this team is locked", success: false }, { status: 400 });
    }

    // Calculate current draft total (excluding this target)
    const otherDrafts = await Investment.find({
        investorTeamId: userTeam._id,
        targetTeamId: { $ne: new mongoose.Types.ObjectId(targetTeamId) }
    });
    const otherTotal = otherDrafts.reduce((sum, inv) => sum + inv.amount, 0);

    if (otherTotal + amount > userTeam.balance) {
        return NextResponse.json({ error: "Total exceeds available balance", success: false }, { status: 400 });
    }

    // Upsert the draft investment
    await Investment.findOneAndUpdate(
        {
            investorTeamId: userTeam._id,
            targetTeamId: new mongoose.Types.ObjectId(targetTeamId)
        },
        {
            amount,
            isDraft: true,
            draftLocked: false,
            isLocked: false
        },
        { upsert: true, new: true }
    );

    return NextResponse.json({ success: true, message: "Draft saved" });
}

// Edit draft during bidding phase
async function handleEditDraft(user: any, userTeam: any, cluster: any, targetTeamId: string, amount: number) {
    // Verify we're in bidding stage
    if (cluster.currentStage !== 'bidding' || !cluster.biddingOpen) {
        return NextResponse.json({ error: "Editing is only allowed during bidding phase", success: false }, { status: 400 });
    }

    // Team must not be finalized
    if (userTeam.isFinalized) {
        return NextResponse.json({ error: "Portfolio already committed", success: false }, { status: 400 });
    }

    // Calculate current total (excluding this target)
    const otherDrafts = await Investment.find({
        investorTeamId: userTeam._id,
        targetTeamId: { $ne: new mongoose.Types.ObjectId(targetTeamId) }
    });
    const otherTotal = otherDrafts.reduce((sum, inv) => sum + inv.amount, 0);

    if (otherTotal + amount > userTeam.balance) {
        return NextResponse.json({ error: "Total exceeds available balance", success: false }, { status: 400 });
    }

    // Update the draft
    await Investment.findOneAndUpdate(
        {
            investorTeamId: userTeam._id,
            targetTeamId: new mongoose.Types.ObjectId(targetTeamId)
        },
        { amount },
        { upsert: true }
    );

    return NextResponse.json({ success: true, message: "Draft updated" });
}

// Commit final portfolio
async function handleCommitPortfolio(user: any, userTeam: any, cluster: any, investments: any[]) {
    // Verify bidding is open
    if (cluster.currentStage !== 'bidding' || !cluster.biddingOpen) {
        return NextResponse.json({ error: "Market is not open for committing", success: false }, { status: 400 });
    }

    // Team must not be finalized
    if (userTeam.isFinalized) {
        return NextResponse.json({ error: "Portfolio already locked", success: false }, { status: 400 });
    }

    if (!investments || !Array.isArray(investments) || investments.length === 0) {
        return NextResponse.json({ error: "No investments provided", success: false }, { status: 400 });
    }

    // Validate total doesn't exceed balance
    const totalAmount = investments.reduce((sum: number, inv: any) => sum + Number(inv.amount), 0);
    if (totalAmount > userTeam.balance) {
        return NextResponse.json({ error: "Total exceeds available balance", success: false }, { status: 400 });
    }

    const dbSession = await mongoose.startSession();

    try {
        await dbSession.withTransaction(async () => {
            for (const inv of investments) {
                if (inv.amount <= 0) continue;

                const targetTeamId = new mongoose.Types.ObjectId(inv.target_team_id);

                // Check if there was a previous investment (draft) to calculate difference
                const existingInv = await Investment.findOne({
                    investorTeamId: userTeam._id,
                    targetTeamId: targetTeamId
                }).session(dbSession);

                const previousAmount = existingInv?.amount || 0;
                const difference = inv.amount - previousAmount;

                // Update or create investment as locked
                await Investment.findOneAndUpdate(
                    {
                        investorTeamId: userTeam._id,
                        targetTeamId: targetTeamId
                    },
                    {
                        amount: inv.amount,
                        isDraft: false,
                        draftLocked: true,
                        isLocked: true
                    },
                    { upsert: true, session: dbSession }
                );

                // Update target team's total_received (only by the difference)
                if (difference !== 0) {
                    await Team.findByIdAndUpdate(
                        targetTeamId,
                        { $inc: { totalReceived: difference } },
                        { session: dbSession }
                    );
                }
            }

            // Update investor team
            await Team.findByIdAndUpdate(
                userTeam._id,
                {
                    balance: userTeam.balance - totalAmount,
                    $inc: { totalInvested: totalAmount },
                    isFinalized: true
                },
                { session: dbSession }
            );

            // Audit log
            await AuditLog.create([{
                eventType: "PORTFOLIO_COMMITTED",
                actorId: user._id,
                targetId: userTeam._id,
                metadata: { investments, total: totalAmount }
            }], { session: dbSession });
        });

        return NextResponse.json({
            success: true,
            message: "Portfolio locked successfully!",
            total_invested: totalAmount
        });

    } finally {
        await dbSession.endSession();
    }
}