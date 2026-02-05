import { createAnonClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/teams - Fetch user's team information
export async function GET(request: NextRequest) {
    try {
        const supabase = await createAnonClient();

        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json(
                { error: 'Not authenticated' },
                { status: 401 }
            );
        }

        // Get user's profile
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (profileError) {
            console.error('Profile fetch error:', profileError);
            return NextResponse.json(
                { error: 'Failed to fetch team information' },
                { status: 500 }
            );
        }

        if (!profile.team_id) {
            return NextResponse.json({ team: null });
        }

        // Get team info with cluster and college
        const { data: team, error: teamError } = await supabase
            .from('teams')
            .select(`
                *,
                cluster:clusters!teams_cluster_id_fkey(
                    id,
                    name,
                    pitch_order
                ),
                college:colleges(
                    id,
                    name
                )
            `)
            .eq('id', profile.team_id)
            .single();

        if (teamError) {
            console.error('Team fetch error:', teamError);
            return NextResponse.json(
                { error: 'Failed to fetch team information' },
                { status: 500 }
            );
        }

        // Get all team members
        const { data: members, error: membersError } = await supabase
            .from('profiles')
            .select('id, full_name, email, role, entity_id')
            .eq('team_id', profile.team_id);

        if (membersError) {
            console.error('Members fetch error:', membersError);
        }

        return NextResponse.json({
            team: {
                ...team,
                members: members || []
            },
            isLeader: profile.role === 'team_lead'
        });
    } catch (error) {
        console.error('Teams API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
