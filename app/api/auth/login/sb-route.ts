import { createAnonClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/security/rate-limit';

export async function POST(request: NextRequest) {
    try {
        // SECURITY: Rate limit login attempts (5 per minute per IP)
        const clientIP = getClientIP(request);
        const rateLimit = checkRateLimit(`login:${clientIP}`, {
            windowMs: 60000,
            maxAttempts: 5
        });

        if (!rateLimit.success) {
            return rateLimitResponse(rateLimit.resetIn);
        }

        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email and password are required' },
                { status: 400 }
            );
        }

        const supabase = await createAnonClient();

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            return NextResponse.json(
                { error: error.message },
                { status: 401 }
            );
        }

        // Fetch user profile with college and team info
        const { data: profile } = await supabase
            .from('profiles')
            .select(`
        *,
        college:colleges(*)
      `)
            .eq('id', data.user.id)
            .single();

        // Get user's team
        const { data: teamMember } = await supabase
            .from('team_members')
            .select(`
        team:teams(
          *,
          college:colleges(*)
        )
      `)
            .eq('user_id', data.user.id)
            .single();

        return NextResponse.json({
            user: {
                id: data.user.id,
                email: data.user.email,
                profile,
                team: teamMember?.team || null,
            },
            // SECURITY: Session is set via cookies, not exposed in response
        });
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
