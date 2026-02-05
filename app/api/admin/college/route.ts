import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb/connection';
import { User, College } from '@/lib/mongodb/models';
import { getCurrentUser } from '@/lib/mongodb/auth';

export async function GET() {
    try {
        await connectDB();

        const currentUser = await getCurrentUser();
        if (!currentUser) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const user = await User.findById(currentUser.id).select('role collegeId');

        if (user?.role !== 'admin' || !user.collegeId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const college = await College.findById(user.collegeId);

        if (!college) {
            return NextResponse.json({ error: 'College not found' }, { status: 404 });
        }

        return NextResponse.json({ 
            college: {
                id: college._id,
                name: college.name,
                shortCode: college.shortCode,
                location: college.location,
                adminEmail: college.adminEmail,
                maxParticipants: college.maxParticipants,
                internalDetails: college.internalDetails,
            }
        });
    } catch (error) {
        console.error('Get college details error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { internalDetails } = body;

        await connectDB();

        const currentUser = await getCurrentUser();
        if (!currentUser) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const user = await User.findById(currentUser.id).select('role collegeId');

        if (user?.role !== 'admin' || !user.collegeId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        if (internalDetails) {
            await College.findByIdAndUpdate(user.collegeId, {
                internalDetails,
                updatedAt: new Date(),
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Update college details error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
