import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/mongodb/auth';
import connectDB from '@/lib/mongodb/connection';
import { User, College } from '@/lib/mongodb/models';
import bcrypt from 'bcryptjs';

// GET - Fetch admins for a college
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        
        // Verify user is super admin
        const currentUser = await getCurrentUser();
        if (!currentUser) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        if (currentUser.role !== 'super_admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        await connectDB();

        // Fetch admins for this college
        const admins = await User.find({
            collegeId: id,
            role: 'admin'
        })
        .select('_id fullName email memberId createdAt')
        .sort({ createdAt: -1 })
        .lean();

        // Transform to expected format
        const formattedAdmins = admins.map(admin => ({
            id: admin._id.toString(),
            full_name: admin.fullName,
            email: admin.email,
            member_id: admin.memberId,
            created_at: admin.createdAt
        }));

        return NextResponse.json({ admins: formattedAdmins });
    } catch (error) {
        console.error('Get admins error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST - Create a new admin for a college
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: collegeId } = await params;
        const { email, password, fullName } = await request.json();

        if (!email || !password || !fullName) {
            return NextResponse.json({ error: 'Email, password, and full name are required' }, { status: 400 });
        }

        // Verify user is super admin
        const currentUser = await getCurrentUser();
        if (!currentUser) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        if (currentUser.role !== 'super_admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        await connectDB();

        // Check if email already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return NextResponse.json({ error: 'Email already in use' }, { status: 400 });
        }

        // Get college to generate member ID
        const college = await College.findById(collegeId);
        if (!college) {
            return NextResponse.json({ error: 'College not found' }, { status: 404 });
        }

        // Generate member ID
        const collegeCode = college.name
            .split(' ')
            .map((w: string) => w[0])
            .join('')
            .toUpperCase()
            .slice(0, 4);
        const year = new Date().getFullYear().toString().slice(-2);
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        const memberId = `OF-${collegeCode}-${year}-${randomNum}`;

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create admin user
        const newAdmin = await User.create({
            email: email.toLowerCase(),
            password: hashedPassword,
            fullName,
            role: 'admin',
            collegeId,
            memberId,
        });

        return NextResponse.json({ 
            admin: {
                id: newAdmin._id.toString(),
                email: newAdmin.email,
                full_name: newAdmin.fullName,
                role: newAdmin.role,
                college_id: newAdmin.collegeId,
                member_id: newAdmin.memberId,
                created_at: newAdmin.createdAt
            }
        });
    } catch (error) {
        console.error('Create admin error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
