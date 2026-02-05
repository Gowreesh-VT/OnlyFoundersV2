import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

// SECURITY: No fallback - QR_SECRET must be set in environment
const QR_SECRET = process.env.QR_SECRET;

export async function POST(request: NextRequest) {
  try {

    if (!QR_SECRET) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userProfile || !['gate_volunteer', 'admin', 'super_admin'].includes(userProfile.role)) {
      return NextResponse.json(
        { error: 'Unauthorized - Gate volunteer access required' },
        { status: 403 }
      );
    }

    const { qrData, gateLocation } = await request.json();

    if (!qrData || typeof qrData !== 'string') {
      return NextResponse.json(
        { error: 'Invalid QR data' },
        { status: 400 }
      );
    }

    // Parse QR token format: entityId:timestamp:signature
    const parts = qrData.split(':');
    if (parts.length !== 3) {
      return NextResponse.json(
        { error: 'Invalid QR token format' },
        { status: 400 }
      );
    }

    const [entityId, timestamp, providedSignature] = parts;

    // Verify timestamp is not too old (24 hours)
    const qrTimestamp = parseInt(timestamp);
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    if (isNaN(qrTimestamp) || now - qrTimestamp > maxAge) {
      return NextResponse.json(
        { error: 'QR code expired' },
        { status: 400 }
      );
    }

    // Verify HMAC signature
    const message = `${entityId}:${timestamp}`;
    const expectedSignature = crypto
      .createHmac('sha256', QR_SECRET)
      .update(message)
      .digest('hex');

    if (providedSignature !== expectedSignature) {
      return NextResponse.json(
        { error: 'Invalid QR signature' },
        { status: 400 }
      );
    }

    // Fetch participant from database - supabase already created above
    const gateVolunteerId = user.id;

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        email,
        phone_number,
        role,
        photo_url,
        entity_id,
        college_id,
        team_id
      `)
      .eq('entity_id', entityId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Participant not found' },
        { status: 404 }
      );
    }

    // Check last scan session
    const { data: lastSession } = await supabase
      .from('scan_sessions')
      .select('session_start, session_end, is_active')
      .eq('profile_id', profile.id)
      .order('session_start', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Get total scan count (completed sessions)
    const { count: scanCount } = await supabase
      .from('scan_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('profile_id', profile.id);

    // Fetch college name
    let collegeName = null;
    if (profile.college_id) {
      const { data: college } = await supabase
        .from('colleges')
        .select('name')
        .eq('id', profile.college_id)
        .single();

      if (college) {
        collegeName = college.name;
      }
    }

    // Fetch team and cluster info
    let teamName = null;
    let clusterName = null;
    let clusterTier = null;

    if (profile.team_id) {
      const { data: team } = await supabase
        .from('teams')
        .select(`
          name,
          cluster_id,
          clusters (
            name,
            tier
          )
        `)
        .eq('id', profile.team_id)
        .single();

      if (team) {
        teamName = team.name;
        // clusters is returned as an object when using single()
        if (team.clusters && typeof team.clusters === 'object' && !Array.isArray(team.clusters)) {
          clusterName = (team.clusters as any).name;
          clusterTier = (team.clusters as any).tier;
        }
      }
    }

    // Log this entry scan
    const { data: entryLog, error: entryLogError } = await supabase
      .from('entry_logs')
      .insert({
        entity_id: entityId,
        profile_id: profile.id,
        scanned_by: gateVolunteerId,
        status: 'valid',
        location: gateLocation || 'GATE1',
        scan_type: 'entry',
      })
      .select()
      .single();

    if (entryLogError) {
      console.error('Error logging entry:', entryLogError);
    }

    if (entryLog && !lastSession?.is_active) {

      const { error: sessionError } = await supabase
        .from('scan_sessions')
        .insert({
          profile_id: profile.id,
          entry_scan_id: entryLog.id,
          session_start: new Date().toISOString(),
          is_active: true,
        });

      if (sessionError) {
        console.error('Error creating session:', sessionError);
      }
    }

    return NextResponse.json({
      verified: true,
      participant: {
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        phone_number: profile.phone_number,
        role: profile.role,
        photo_url: profile.photo_url,
        entity_id: profile.entity_id,
        college: collegeName,
        team: teamName,
        cluster: clusterName,
        cluster_tier: clusterTier,
        verified_at: new Date().toISOString(),
        last_scanned: lastSession?.session_start || null,
        last_scanned_by: null,
        total_scans: (scanCount || 0) + 1,
        is_active_session: lastSession?.is_active || false,
      },
    });

  } catch (error) {
    console.error('QR verification error:', error);
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    );
  }
}