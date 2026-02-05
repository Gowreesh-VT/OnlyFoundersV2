import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb/connection';
import { User, College, Team } from '@/lib/mongodb/models';
import { getCurrentUser } from '@/lib/mongodb/auth';

// GET - Fetch single college with details
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
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

        // Fetch college
        const college = await College.findById(id);

        if (!college) {
            return NextResponse.json({ error: 'College not found' }, { status: 404 });
        }

        // Get stats
        const studentCount = await User.countDocuments({ 
            collegeId: id, 
            role: { $in: ['participant', 'team_lead'] }
        });

        const teamCount = await Team.countDocuments({ collegeId: id });

        const admins = await User.find({ collegeId: id, role: 'admin' })
            .select('_id fullName email');

        return NextResponse.json({
            college: {
                id: college._id,
                name: college.name,
                location: college.location,
                logoUrl: college.logoUrl,
                status: college.status,
                students: studentCount || 0,
                teams: teamCount || 0,
                admins: admins.map(a => ({
                    id: a._id,
                    full_name: a.fullName,
                    email: a.email,
                })) || [],
            },
        });
    } catch (error) {
        console.error('Get college error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH - Update college
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { name, location, logoUrl, status, internalDetails } = body;

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

        // Update college
        const updateData: Record<string, unknown> = {};
        if (name) updateData.name = name;
        if (location !== undefined) updateData.location = location;
        if (logoUrl !== undefined) updateData.logoUrl = logoUrl;
        if (status) updateData.status = status;
        if (internalDetails !== undefined) updateData.internalDetails = internalDetails;

        const college = await College.findByIdAndUpdate(id, updateData, { new: true });

        if (!college) {
            return NextResponse.json({ error: 'Failed to update college' }, { status: 500 });
        }

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
        console.error('Update college error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE - Delete college
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
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

        // Delete college
        await College.findByIdAndDelete(id);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete college error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
