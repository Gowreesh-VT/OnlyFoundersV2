import { createAdminClient, createAnonClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        // SECURITY: Verify user is authenticated
        const supabaseAuth = await createAnonClient();
        const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
        
        if (authError || !user) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        const supabase = createAdminClient();

        const { data: colleges, error } = await supabase
            .from('colleges')
            .select('*')
            .order('name');

        if (error) {
            return NextResponse.json(
                { error: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({ colleges: colleges || [] });
    } catch (error: any) {
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
