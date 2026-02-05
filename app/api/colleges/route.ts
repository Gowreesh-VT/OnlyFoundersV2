import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb/connection';
import { College } from '@/lib/mongodb/models';
import { getSession } from '@/lib/mongodb/auth';

export async function GET() {
    try {
        // Verify user is authenticated
        const session = await getSession();
        if (!session) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        await connectDB();

        const colleges = await College.find({}).sort({ name: 1 });

        return NextResponse.json({ 
            colleges: colleges.map(c => ({
                id: c._id,
                name: c.name,
                location: c.location,
                logo_url: c.logoUrl,
                created_at: c.createdAt,
                updated_at: c.updatedAt
            }))
        });
    } catch (error: unknown) {
        console.error('Get colleges error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
