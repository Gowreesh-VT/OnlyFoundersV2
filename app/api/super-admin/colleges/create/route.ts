import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb/connection';
import { User, College } from '@/lib/mongodb/models';
import { getCurrentUser } from '@/lib/mongodb/auth';

// POST - Create a new college (super admin only)
export async function POST(request: NextRequest) {
    try {
        const { name, location, logoUrl, status } = await request.json();

        if (!name) {
            return NextResponse.json({ error: 'College name is required' }, { status: 400 });
        }

        await connectDB();

        // Verify user is super admin
        const currentUser = await getCurrentUser();
        if (!currentUser) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const user = await User.findById(currentUser.id).select('role');

        if (user?.role !== 'super_admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        // Create college
        const college = await College.create({
            name,
            location: location || undefined,
            logoUrl: logoUrl || undefined,
            status: status || 'active',
        });

        return NextResponse.json({ 
            college: {
                id: college._id,
                name: college.name,
                location: college.location,
                logoUrl: college.logoUrl,
                status: college.status,
            }
        });
    } catch (error) {
        console.error('Create college error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
