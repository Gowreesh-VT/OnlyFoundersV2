import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb/connection';
import { User, EventState } from '@/lib/mongodb/models';
import { getCurrentUser } from '@/lib/mongodb/auth';

// Type for hackathon settings
type HackathonSettings = {
    id?: string;
    collegeId?: string;
    hackathonName: string;
    startDate: string | null;
    endDate: string | null;
    submissionDeadline: string | null;
    lateSubmissionsAllowed: boolean;
    penaltyDeduction: number;
};

const defaultSettings: Omit<HackathonSettings, 'id' | 'collegeId'> = {
    hackathonName: 'OnlyFounders Hackathon',
    startDate: null,
    endDate: null,
    submissionDeadline: null,
    lateSubmissionsAllowed: false,
    penaltyDeduction: 10,
};

export async function GET(request: NextRequest) {
    try {
        await connectDB();

        // Get current user
        const currentUser = await getCurrentUser();
        if (!currentUser) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        // Get user profile with college
        const user = await User.findById(currentUser.id).select('role collegeId');

        if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        if (!user.collegeId) {
            return NextResponse.json({ settings: defaultSettings });
        }

        // Get hackathon settings for this college (using EventState with key)
        const settings = await EventState.findOne({ key: `hackathon_settings_${user.collegeId}` });

        // Return settings or defaults
        return NextResponse.json({
            settings: settings?.value ? JSON.parse(settings.value) : { ...defaultSettings, collegeId: user.collegeId }
        });
    } catch (error) {
        console.error('Get settings error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        await connectDB();

        // Get current user
        const currentUser = await getCurrentUser();
        if (!currentUser) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        // Get user profile with college
        const user = await User.findById(currentUser.id).select('role collegeId');

        if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        if (!user.collegeId) {
            return NextResponse.json({ error: 'No college associated' }, { status: 400 });
        }

        const settingsData = {
            collegeId: user.collegeId.toString(),
            hackathonName: body.hackathon_name || 'OnlyFounders Hackathon',
            startDate: body.start_date || null,
            endDate: body.end_date || null,
            submissionDeadline: body.submission_deadline || null,
            lateSubmissionsAllowed: body.late_submissions_allowed ?? false,
            penaltyDeduction: body.penalty_deduction ?? 10,
        };

        // Upsert settings using EventState
        await EventState.findOneAndUpdate(
            { key: `hackathon_settings_${user.collegeId}` },
            { 
                key: `hackathon_settings_${user.collegeId}`,
                value: JSON.stringify(settingsData),
            },
            { upsert: true, new: true }
        );

        return NextResponse.json({ settings: settingsData });
    } catch (error) {
        console.error('Update settings error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
