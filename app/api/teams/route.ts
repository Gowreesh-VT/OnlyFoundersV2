import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb/connection';
import { User, Team, Investment, Note } from '@/lib/mongodb/models';
import { getSession } from '@/lib/mongodb/auth';
import mongoose from 'mongoose';

// ------------------------------------------------------------------
// GET: Fetch team data
// ------------------------------------------------------------------
export async function GET(request: NextRequest) {
    try {
        await connectDB();
        
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const teamId = searchParams.get('teamId');

        // If specific team requested
        if (teamId) {
            const team = await Team.findById(teamId)
                .populate('collegeId')
                .populate('clusterId');
            
            if (!team) {
                return NextResponse.json({ error: 'Team not found' }, { status: 404 });
            }

            const members = await User.find({ teamId: team._id })
                .select('_id fullName email role photoUrl entityId');

            // Get investments made by this team
            const investmentsMade = await Investment.find({ investorTeamId: team._id })
                .populate('targetTeamId');

            // Get investments received by this team
            const investmentsReceived = await Investment.find({ targetTeamId: team._id })
                .populate('investorTeamId');

            return NextResponse.json({
                team: {
                    id: team._id,
                    name: team.name,
                    domain: team.domain,
                    tags: team.tags,
                    balance: team.balance,
                    total_invested: team.totalInvested,
                    total_received: team.totalReceived,
                    is_finalized: team.isFinalized,
                    is_qualified: team.isQualified,
                    social_links: team.socialLinks,
                    college: team.collegeId,
                    cluster: team.clusterId,
                    members: members.map(m => ({
                        id: m._id,
                        full_name: m.fullName,
                        email: m.email,
                        role: m.role,
                        photo_url: m.photoUrl,
                        entity_id: m.entityId
                    })),
                    investments_made: investmentsMade.map(i => ({
                        id: i._id,
                        target_team: i.targetTeamId,
                        amount: i.amount,
                        reasoning: i.reasoning,
                        confidence_level: i.confidenceLevel,
                        is_locked: i.isLocked
                    })),
                    investments_received: investmentsReceived.map(i => ({
                        id: i._id,
                        investor_team: i.investorTeamId,
                        amount: i.amount
                    }))
                }
            });
        }

        // Get user's team
        const user = await User.findById(session.userId);
        if (!user || !user.teamId) {
            return NextResponse.json({ error: 'User has no team' }, { status: 404 });
        }

        const team = await Team.findById(user.teamId)
            .populate('collegeId')
            .populate('clusterId');

        if (!team) {
            return NextResponse.json({ error: 'Team not found' }, { status: 404 });
        }

        const members = await User.find({ teamId: team._id })
            .select('_id fullName email role photoUrl entityId');

        return NextResponse.json({
            team: {
                id: team._id,
                name: team.name,
                domain: team.domain,
                tags: team.tags,
                balance: team.balance,
                total_invested: team.totalInvested,
                total_received: team.totalReceived,
                is_finalized: team.isFinalized,
                college: team.collegeId,
                cluster: team.clusterId,
                members: members.map(m => ({
                    id: m._id,
                    full_name: m.fullName,
                    email: m.email,
                    role: m.role,
                    photo_url: m.photoUrl,
                    entity_id: m.entityId
                }))
            }
        });

    } catch (error) {
        console.error('Teams GET error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// ------------------------------------------------------------------
// POST: Team actions (invest, add note, etc.)
// ------------------------------------------------------------------
export async function POST(request: NextRequest) {
    try {
        await connectDB();
        
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const user = await User.findById(session.userId);
        if (!user || !user.teamId) {
            return NextResponse.json({ error: 'User has no team' }, { status: 403 });
        }

        const body = await request.json();
        const { action, payload } = body;

        switch (action) {
            case 'INVEST':
                return await handleInvest(user, payload);

            case 'UPDATE_INVESTMENT':
                return await handleUpdateInvestment(user, payload);

            case 'DELETE_INVESTMENT':
                return await handleDeleteInvestment(user, payload);

            case 'ADD_NOTE':
                return await handleAddNote(user, payload);

            case 'FINALIZE_PORTFOLIO':
                return await handleFinalizePortfolio(user);

            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

    } catch (error) {
        console.error('Teams POST error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// ------------------------------------------------------------------
// Handler Functions
// ------------------------------------------------------------------

async function handleInvest(user: any, payload: any) {
    const { targetTeamId, amount, reasoning, confidenceLevel } = payload;

    // Verify user is team lead
    if (!['team_lead', 'super_admin'].includes(user.role)) {
        return NextResponse.json({ error: 'Only team leads can invest' }, { status: 403 });
    }

    // Get investor team
    const investorTeam = await Team.findById(user.teamId);
    if (!investorTeam) {
        return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Check if team is finalized
    if (investorTeam.isFinalized) {
        return NextResponse.json({ error: 'Portfolio is finalized' }, { status: 400 });
    }

    // Check balance
    if (investorTeam.balance < amount) {
        return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
    }

    // Check if already invested in this team
    const existingInvestment = await Investment.findOne({
        investorTeamId: user.teamId,
        targetTeamId
    });

    if (existingInvestment) {
        return NextResponse.json({ error: 'Already invested in this team' }, { status: 400 });
    }

    // Cannot invest in own team
    if (user.teamId.toString() === targetTeamId) {
        return NextResponse.json({ error: 'Cannot invest in own team' }, { status: 400 });
    }

    // Create investment
    const investment = await Investment.create({
        investorTeamId: user.teamId,
        targetTeamId,
        amount,
        reasoning,
        confidenceLevel
    });

    // Update balances
    await Team.findByIdAndUpdate(user.teamId, {
        $inc: { balance: -amount, totalInvested: amount }
    });

    await Team.findByIdAndUpdate(targetTeamId, {
        $inc: { totalReceived: amount }
    });

    return NextResponse.json({ success: true, investmentId: investment._id });
}

async function handleUpdateInvestment(user: any, payload: any) {
    const { investmentId, amount, reasoning, confidenceLevel } = payload;

    const investment = await Investment.findById(investmentId);
    if (!investment) {
        return NextResponse.json({ error: 'Investment not found' }, { status: 404 });
    }

    // Verify ownership
    if (investment.investorTeamId.toString() !== user.teamId.toString()) {
        return NextResponse.json({ error: 'Not your investment' }, { status: 403 });
    }

    if (investment.isLocked) {
        return NextResponse.json({ error: 'Investment is locked' }, { status: 400 });
    }

    const amountDiff = amount - investment.amount;
    const investorTeam = await Team.findById(user.teamId);

    if (investorTeam && amountDiff > investorTeam.balance) {
        return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
    }

    // Update investment
    investment.amount = amount;
    investment.reasoning = reasoning;
    investment.confidenceLevel = confidenceLevel;
    await investment.save();

    // Update balances
    await Team.findByIdAndUpdate(user.teamId, {
        $inc: { balance: -amountDiff, totalInvested: amountDiff }
    });

    await Team.findByIdAndUpdate(investment.targetTeamId, {
        $inc: { totalReceived: amountDiff }
    });

    return NextResponse.json({ success: true });
}

async function handleDeleteInvestment(user: any, payload: any) {
    const { investmentId } = payload;

    const investment = await Investment.findById(investmentId);
    if (!investment) {
        return NextResponse.json({ error: 'Investment not found' }, { status: 404 });
    }

    if (investment.investorTeamId.toString() !== user.teamId.toString()) {
        return NextResponse.json({ error: 'Not your investment' }, { status: 403 });
    }

    if (investment.isLocked) {
        return NextResponse.json({ error: 'Investment is locked' }, { status: 400 });
    }

    // Restore balances
    await Team.findByIdAndUpdate(user.teamId, {
        $inc: { balance: investment.amount, totalInvested: -investment.amount }
    });

    await Team.findByIdAndUpdate(investment.targetTeamId, {
        $inc: { totalReceived: -investment.amount }
    });

    await Investment.findByIdAndDelete(investmentId);

    return NextResponse.json({ success: true });
}

async function handleAddNote(user: any, payload: any) {
    const { targetTeamId, pitchSessionId, content } = payload;

    const note = await Note.create({
        authorTeamId: user.teamId,
        authorId: user._id,
        targetTeamId,
        pitchSessionId,
        content
    });

    return NextResponse.json({ success: true, noteId: note._id });
}

async function handleFinalizePortfolio(user: any) {
    if (!['team_lead', 'super_admin'].includes(user.role)) {
        return NextResponse.json({ error: 'Only team leads can finalize' }, { status: 403 });
    }

    await Team.findByIdAndUpdate(user.teamId, { isFinalized: true });

    // Lock all investments
    await Investment.updateMany(
        { investorTeamId: user.teamId },
        { isLocked: true }
    );

    return NextResponse.json({ success: true });
}
