import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Admin client for bypassing RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Create authenticated client
async function createAuthClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch { }
        },
      },
    }
  );
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createAuthClient();

    // Verify user is authenticated and is a cluster admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user profile and verify role
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || !["admin", "super_admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Unauthorized - Not a cluster admin" }, { status: 403 });
    }

    const body = await request.json();
    const { action, payload } = body;

    switch (action) {
      case "START_PITCH":
        return handleStartPitch(payload);
      case "PAUSE_PITCH":
        return handlePausePitch(payload);
      case "RESUME_PITCH":
        return handleResumePitch(payload);
      case "END_PITCH":
        return handleEndPitch(payload);
      case "SKIP_PITCH":
        return handleSkipPitch(payload);
      case "TOGGLE_BIDDING":
        return handleToggleBidding(payload);
      case "GET_ACTIVE_PITCH":
        return handleGetActivePitch(payload);
      case "GET_CLUSTER_DATA":
        return handleGetClusterData(payload);
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Pitch API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {

    const supabase = await createAuthClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clusterId = searchParams.get("clusterId");

    if (clusterId) {
      // Fetch specific cluster's active pitch
      const { data: pitch, error } = await supabaseAdmin
        .from("pitch_schedule")
        .select(`
          *,
          team:teams(id, name, domain, balance, total_received)
        `)
        .eq("cluster_id", clusterId)
        .eq("status", "in_progress")
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Fetch active pitch error:", error);
      }

      // Also fetch cluster info
      const { data: cluster } = await supabaseAdmin
        .from("clusters")
        .select("*")
        .eq("id", clusterId)
        .single();

      return NextResponse.json({
        activePitch: pitch || null,
        cluster: cluster || null,
      });
    }

    // Fetch all active pitches across all clusters
    const { data: pitches, error } = await supabaseAdmin
      .from("pitch_schedule")
      .select(`
        *,
        team:teams(id, name, domain),
        cluster:clusters(id, name, location)
      `)
      .eq("status", "in_progress");

    if (error) {
      console.error("Fetch all active pitches error:", error);
      return NextResponse.json({ error: "Failed to fetch pitches" }, { status: 500 });
    }

    return NextResponse.json({ activePitches: pitches || [] });
  } catch (error) {
    console.error("GET Pitch API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ------------------------------------------------------------------
// START PITCH - Begin a team's pitch session
// ------------------------------------------------------------------
async function handleStartPitch(payload: { pitchId: string; clusterId: string }) {
  const { pitchId, clusterId } = payload;

  // Get the pitch details first
  const { data: pitch, error: fetchError } = await supabaseAdmin
    .from("pitch_schedule")
    .select("*, team:teams(*)")
    .eq("id", pitchId)
    .single();

  if (fetchError || !pitch) {
    return NextResponse.json({ error: "Pitch not found" }, { status: 404 });
  }

  // Update pitch status to in_progress
  const { error: pitchError } = await supabaseAdmin
    .from("pitch_schedule")
    .update({
      status: "in_progress",
      actual_start: new Date().toISOString(),
    })
    .eq("id", pitchId);

  if (pitchError) {
    console.error("Start pitch error:", pitchError);
    return NextResponse.json({ error: "Failed to start pitch" }, { status: 500 });
  }

  // Update cluster's current pitching team
  const { error: clusterError } = await supabaseAdmin
    .from("clusters")
    .update({
      current_pitching_team_id: pitch.team_id,
      current_stage: "pitching",
    })
    .eq("id", clusterId);

  if (clusterError) {
    console.error("Update cluster error:", clusterError);
  }

  // Log the action in audit_logs
  await supabaseAdmin.from("audit_logs").insert({
    action: "PITCH_STARTED",
    entity_type: "pitch_schedule",
    entity_id: pitchId,
    new_data: { team_id: pitch.team_id, started_at: new Date().toISOString() },
  });

  return NextResponse.json({
    success: true,
    pitch: {
      ...pitch,
      status: "in_progress",
      actual_start: new Date().toISOString(),
    },
  });
}

// ------------------------------------------------------------------
// PAUSE PITCH - Pause the timer (stores pause timestamp)
// ------------------------------------------------------------------
async function handlePausePitch(payload: { pitchId: string }) {
  const { pitchId } = payload;

  // Store pause time in a metadata field or separate tracking
  // For simplicity, we'll use a custom approach with actual_end as pause marker
  const { data: pitch, error: fetchError } = await supabaseAdmin
    .from("pitch_schedule")
    .select("*")
    .eq("id", pitchId)
    .single();

  if (fetchError || !pitch) {
    return NextResponse.json({ error: "Pitch not found" }, { status: 404 });
  }

  // Calculate elapsed time and store it
  const startTime = new Date(pitch.actual_start).getTime();
  const now = Date.now();
  const elapsedSeconds = Math.floor((now - startTime) / 1000);

  // We'll store elapsed time by updating pitch_duration_seconds temporarily
  // A better approach would be a separate paused_at field
  const { error } = await supabaseAdmin
    .from("pitch_schedule")
    .update({
      // Store the remaining time so we can resume from there
      pitch_duration_seconds: pitch.pitch_duration_seconds - elapsedSeconds,
    })
    .eq("id", pitchId);

  if (error) {
    return NextResponse.json({ error: "Failed to pause pitch" }, { status: 500 });
  }

  return NextResponse.json({ success: true, elapsedSeconds });
}

// ------------------------------------------------------------------
// RESUME PITCH - Resume from paused state
// ------------------------------------------------------------------
async function handleResumePitch(payload: { pitchId: string }) {
  const { pitchId } = payload;

  // Reset actual_start to now (timer continues from remaining duration)
  const { error } = await supabaseAdmin
    .from("pitch_schedule")
    .update({
      actual_start: new Date().toISOString(),
    })
    .eq("id", pitchId);

  if (error) {
    return NextResponse.json({ error: "Failed to resume pitch" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// ------------------------------------------------------------------
// END PITCH - Complete the pitch session
// ------------------------------------------------------------------
async function handleEndPitch(payload: { pitchId: string; clusterId: string }) {
  const { pitchId, clusterId } = payload;

  const { error: pitchError } = await supabaseAdmin
    .from("pitch_schedule")
    .update({
      status: "completed",
      actual_end: new Date().toISOString(),
      is_completed: true,
      completed_at: new Date().toISOString(),
    })
    .eq("id", pitchId);

  if (pitchError) {
    console.error("End pitch error:", pitchError);
    return NextResponse.json({ error: "Failed to end pitch" }, { status: 500 });
  }

  // Clear cluster's current pitching team
  const { error: clusterError } = await supabaseAdmin
    .from("clusters")
    .update({
      current_pitching_team_id: null,
    })
    .eq("id", clusterId);

  if (clusterError) {
    console.error("Clear cluster pitching team error:", clusterError);
  }

  // Log the action
  await supabaseAdmin.from("audit_logs").insert({
    action: "PITCH_ENDED",
    entity_type: "pitch_schedule",
    entity_id: pitchId,
    new_data: { ended_at: new Date().toISOString() },
  });

  return NextResponse.json({ success: true });
}

// ------------------------------------------------------------------
// SKIP PITCH - Mark as cancelled/skipped (team absent)
// ------------------------------------------------------------------
async function handleSkipPitch(payload: { pitchId: string; clusterId: string }) {
  const { pitchId, clusterId } = payload;

  const { error: pitchError } = await supabaseAdmin
    .from("pitch_schedule")
    .update({
      status: "cancelled",
      actual_end: new Date().toISOString(),
    })
    .eq("id", pitchId);

  if (pitchError) {
    console.error("Skip pitch error:", pitchError);
    return NextResponse.json({ error: "Failed to skip pitch" }, { status: 500 });
  }

  // Clear cluster's current pitching team
  await supabaseAdmin
    .from("clusters")
    .update({ current_pitching_team_id: null })
    .eq("id", clusterId);

  // Log the action
  await supabaseAdmin.from("audit_logs").insert({
    action: "PITCH_SKIPPED",
    entity_type: "pitch_schedule",
    entity_id: pitchId,
    new_data: { skipped_at: new Date().toISOString() },
  });

  return NextResponse.json({ success: true });
}

// ------------------------------------------------------------------
// TOGGLE BIDDING - Open/close investment phase
// ------------------------------------------------------------------
async function handleToggleBidding(payload: { clusterId: string; open: boolean }) {
  const { clusterId, open } = payload;

  const updateData: Record<string, any> = {
    bidding_open: open,
    current_stage: open ? "bidding" : "pitching",
  };

  if (open) {
    // Set bidding deadline to 15 minutes from now
    updateData.bidding_deadline = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  } else {
    updateData.bidding_deadline = null;
  }

  const { error } = await supabaseAdmin
    .from("clusters")
    .update(updateData)
    .eq("id", clusterId);

  if (error) {
    console.error("Toggle bidding error:", error);
    return NextResponse.json({ error: "Failed to toggle bidding" }, { status: 500 });
  }

  // Log the action
  await supabaseAdmin.from("audit_logs").insert({
    action: open ? "BIDDING_OPENED" : "BIDDING_CLOSED",
    entity_type: "cluster",
    entity_id: clusterId,
    new_data: { bidding_open: open, timestamp: new Date().toISOString() },
  });

  return NextResponse.json({ success: true, bidding_open: open });
}

// ------------------------------------------------------------------
// GET ACTIVE PITCH - Fetch current active pitch for a cluster
// ------------------------------------------------------------------
async function handleGetActivePitch(payload: { clusterId: string }) {
  const { clusterId } = payload;

  const { data: pitch, error } = await supabaseAdmin
    .from("pitch_schedule")
    .select(`
      *,
      team:teams(id, name, domain, balance, total_received, total_invested)
    `)
    .eq("cluster_id", clusterId)
    .eq("status", "in_progress")
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Get active pitch error:", error);
    return NextResponse.json({ error: "Failed to fetch active pitch" }, { status: 500 });
  }

  return NextResponse.json({ activePitch: pitch || null });
}

// ------------------------------------------------------------------
// GET CLUSTER DATA - Fetch full cluster info including teams and schedule
// ------------------------------------------------------------------
async function handleGetClusterData(payload: { clusterId: string }) {
  const { clusterId } = payload;

  // Fetch cluster
  const { data: cluster, error: clusterError } = await supabaseAdmin
    .from("clusters")
    .select("*")
    .eq("id", clusterId)
    .single();

  if (clusterError) {
    return NextResponse.json({ error: "Cluster not found" }, { status: 404 });
  }

  // Fetch teams
  const { data: teams } = await supabaseAdmin
    .from("teams")
    .select("*")
    .eq("cluster_id", clusterId)
    .order("total_received", { ascending: false });

  // Fetch pitch schedule
  const { data: schedule } = await supabaseAdmin
    .from("pitch_schedule")
    .select(`*, team:teams(*)`)
    .eq("cluster_id", clusterId)
    .order("pitch_position");

  return NextResponse.json({
    cluster,
    teams: teams || [],
    schedule: schedule || [],
  });
}
