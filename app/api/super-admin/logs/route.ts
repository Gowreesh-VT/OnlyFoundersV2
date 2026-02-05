import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb/connection';
import { AuditLog, User } from '@/lib/mongodb/models';
import { getCurrentUser } from '@/lib/mongodb/auth';

// GET: Fetch audit logs
export async function GET(request: NextRequest) {
    try {
        await connectDB();

        // Get current authenticated user
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Check if user is super_admin
        const user = await User.findById(currentUser.id).select('role');

        if (user?.role !== 'super_admin') {
            return NextResponse.json(
                { error: 'Forbidden - Super Admin access required' },
                { status: 403 }
            );
        }

        // Parse query params
        const url = new URL(request.url);
        const limit = parseInt(url.searchParams.get('limit') || '100');
        const offset = parseInt(url.searchParams.get('offset') || '0');
        const eventType = url.searchParams.get('event_type');

        // Build query
        const filter: any = {};
        if (eventType) {
            filter.eventType = eventType;
        }

        const logs = await AuditLog.find(filter)
            .sort({ createdAt: -1 })
            .skip(offset)
            .limit(limit);

        // Get total count
        const total = await AuditLog.countDocuments(filter);

        return NextResponse.json({
            logs: logs || [],
            total,
            limit,
            offset,
        });
    } catch (error) {
        console.error('Logs fetch error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
