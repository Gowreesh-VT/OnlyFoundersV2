/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAnonClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// Cluster definitions
const CLUSTERS = [
  'ALPHA_SECTOR',
  'BETA_SECTOR',
  'GAMMA_SECTOR',
  'DELTA_SECTOR',
  'EPSILON_SECTOR'
];

// ------------------------------------------------------------------
// GET HANDLER: Dashboard Stats
// ------------------------------------------------------------------
export async function GET() {
  try {
    const supabase = await createAnonClient();
    const supabaseAdmin = createAdminClient();

    // 1. Verify user is super admin
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // 2. Get Global User Count (Total Users)
    const { count: totalGlobalUsers } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    // 3. Fetch all colleges
    const { data: colleges, error: collegesError } = await supabaseAdmin
      .from('colleges')
      .select('*')
      .order('name');

    if (collegesError) {
      return NextResponse.json({ error: 'Failed to fetch colleges' }, { status: 500 });
    }

    // 4. Get stats for each college
    const collegesWithStats = await Promise.all(
      (colleges || []).map(async (college) => {

        // Count profiles in this college
        const { count: studentCount } = await supabaseAdmin
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('college_id', college.id);

        // Count teams
        const { count: teamCount } = await supabaseAdmin
          .from('teams')
          .select('*', { count: 'exact', head: true })
          .eq('college_id', college.id);

        return {
          ...college,
          students: studentCount || 0,
          teams: teamCount || 0,
        };
      })
    );

    // 5. Calculate Aggregates
    const totalColleges = collegesWithStats.length;
    const activeColleges = collegesWithStats.filter(
      c => c.status?.toLowerCase() === 'active'
    ).length;

    const totalTeams = collegesWithStats.reduce(
      (sum, c) => sum + c.teams,
      0
    );

    return NextResponse.json({
      colleges: collegesWithStats,
      stats: {
        totalColleges,
        activeColleges,
        totalUsers: totalGlobalUsers || 0,
        totalTeams,
      },
    });

  } catch (error) {
    console.error('Super admin GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


// ------------------------------------------------------------------
// POST HANDLER: Global Actions (Simulation Only)
// ------------------------------------------------------------------
export async function POST(req: Request) {
  try {
    const supabase = await createAnonClient();
    const supabaseAdmin = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { action, payload } = body;

    switch (action) {

      case 'SHUFFLE_TEAMS':
        return await handleShuffleSimulation(supabaseAdmin);

      case 'SET_PHASE':
        return await handleSetPhase(supabaseAdmin, payload);

      // ✅ NEW ACTION: FETCH USERS FROM PROFILES
      case 'FETCH_USERS':
        return await handleFetchUsers(supabaseAdmin);
        case "UPDATE_ROLE":
  return await handleUpdateRole(supabaseAdmin, payload);

case "UPDATE_PERMISSION":
  return await handleUpdatePermission(supabaseAdmin, payload);

case "ADD_USER":
  return await handleAddUser(supabaseAdmin, payload);
case "DELETE_USER":
  return await handleDeleteUser(supabaseAdmin, payload);

case "ASSIGN_CLUSTER":
  return await handleAssignCluster(supabaseAdmin, payload);

case "FETCH_CLUSTERS":
  return await handleFetchClusters(supabaseAdmin);

case "FETCH_CLUSTERS_WITH_TEAMS":
  return await handleFetchClustersWithTeams(supabaseAdmin);

case "REASSIGN_TEAM":
  return await handleReassignTeam(supabaseAdmin, payload);

case "EXECUTE_SHUFFLE":
  return await handleExecuteShuffle(supabaseAdmin);

      default:
        return NextResponse.json({ error: 'Invalid Action' }, { status: 400 });
    }

  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
async function handleDeleteUser(supabaseAdmin: any, payload: any) {
  const { id } = payload;

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      active: false,
      role: "disabled"
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: "Failed to disable user" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "User disabled successfully"
  });
}

async function handleUpdateRole(supabaseAdmin: any, payload: any) {
  const { id, role } = payload;

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ role })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Role update failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
async function handleUpdatePermission(supabaseAdmin: any, payload: any) {
  const { id, key, value } = payload;

  // Fetch current permissions
  const { data: user } = await supabaseAdmin
    .from("profiles")
    .select("permissions")
    .eq("id", id)
    .single();

  const updatedPermissions = {
    ...(user?.permissions || {}),
    [key]: value,
  };

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ permissions: updatedPermissions })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Permission update failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
async function handleAddUser(supabaseAdmin: any, payload: any) {
  const { full_name, email, role } = payload;

  const { error } = await supabaseAdmin
    .from("profiles")
    .insert([
      {
        full_name,
        email,
        role,
        permissions: {
          canImportTeams: false,
          canShuffleTeams: false,
          canManageUsers: false,
        },
        active: true,
      },
    ]);

  if (error) {
    return NextResponse.json({ error: "User creation failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// ------------------------------------------------------------------
// ✅ Logic 1: Shuffle Teams (SIMULATION ONLY)
// ------------------------------------------------------------------
async function handleShuffleSimulation(supabaseAdmin: any) {

  const { data: teams, error } = await supabaseAdmin
    .from('teams')
    .select('id, name');

  if (error || !teams || teams.length === 0) {
    return NextResponse.json({ error: 'No teams to shuffle' }, { status: 400 });
  }

  // Shuffle (Fisher-Yates)
  const shuffled = [...teams];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const assignments: Record<string, any[]> = {};
  CLUSTERS.forEach(c => assignments[c] = []);

  // ✅ Round-robin distribution
  for (let i = 0; i < shuffled.length; i++) {
    const clusterName = CLUSTERS[i % CLUSTERS.length];

    assignments[clusterName].push({
      id: shuffled[i].id,
      name: shuffled[i].name,
      status: "PREVIEW"
    });
  }

  return NextResponse.json({
    success: true,
    data: assignments,
    message: `Generated preview for ${teams.length} teams.`,
  });
}


// ------------------------------------------------------------------
// ✅ Logic 2: Event Phase
// ------------------------------------------------------------------
async function handleSetPhase(supabaseAdmin: any, payload: any) {

  const { phase } = payload;

  const VALID_PHASES = ['NETWORK', 'PITCH', 'VOTE', 'LOCKED'];

  if (!VALID_PHASES.includes(phase)) {
    return NextResponse.json({ error: 'Invalid Phase' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('system_config')
    .update({ current_phase: phase })
    .eq('id', 1);

  if (error) console.error('Phase update failed:', error);

  return NextResponse.json({ success: true, phase });
}


// ------------------------------------------------------------------
// ✅ Logic 3: Fetch Users From Profiles Table (Super Admin Modal)
// ------------------------------------------------------------------
async function handleFetchUsers(supabaseAdmin: any) {

  const { data: users, error } = await supabaseAdmin
    .from("profiles")
    .select(`
      id,
      full_name,
      email,
      role,
      college_id,
      created_at
    `)
    .in("role", ["admin", "super_admin", "team_lead","gate_volunteer", "event_coordinator"]);

  if (error) {
    console.error("Fetch users failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    users: users || [],
  });
}

// ------------------------------------------------------------------
// ✅ Assign User to Cluster (for cluster_monitor role)
// Maximum 3 admins per cluster allowed
// ------------------------------------------------------------------
const MAX_ADMINS_PER_CLUSTER = 3;

async function handleAssignCluster(supabaseAdmin: any, payload: any) {
  const { userId, clusterId } = payload;

  // If unassigning (clusterId is null/empty), just clear the user's assignment
  if (!clusterId) {
    await supabaseAdmin
      .from("clusters")
      .update({ monitor_id: null })
      .eq("monitor_id", userId);
    
    // Also clear assigned_cluster_id on profile
    await supabaseAdmin
      .from("profiles")
      .update({ assigned_cluster_id: null })
      .eq("id", userId);

    return NextResponse.json({ success: true, message: "User unassigned from cluster" });
  }

  // Check how many admins are already assigned to this cluster
  const { data: existingAdmins, error: countError } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("assigned_cluster_id", clusterId)
    .in("role", ["admin", "cluster_monitor"]);

  if (countError) {
    console.error("Count admins error:", countError);
  }

  // Filter out the current user if they're already assigned to this cluster
  const otherAdmins = (existingAdmins || []).filter((a: any) => a.id !== userId);

  if (otherAdmins.length >= MAX_ADMINS_PER_CLUSTER) {
    return NextResponse.json({ 
      error: `Maximum ${MAX_ADMINS_PER_CLUSTER} admins per cluster allowed. This cluster already has ${otherAdmins.length} admins.` 
    }, { status: 400 });
  }

  // Clear user's previous cluster assignment
  await supabaseAdmin
    .from("profiles")
    .update({ assigned_cluster_id: null })
    .eq("id", userId);

  // Also clear old monitor_id reference
  await supabaseAdmin
    .from("clusters")
    .update({ monitor_id: null })
    .eq("monitor_id", userId);

  // Assign user to the new cluster (update profile)
  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .update({ assigned_cluster_id: clusterId })
    .eq("id", userId);

  if (profileError) {
    console.error("Assign cluster to profile failed:", profileError);
    return NextResponse.json({ error: "Failed to assign cluster" }, { status: 500 });
  }

  // Also set as monitor_id on cluster (first admin becomes primary monitor)
  const { data: cluster } = await supabaseAdmin
    .from("clusters")
    .select("monitor_id")
    .eq("id", clusterId)
    .single();

  if (!cluster?.monitor_id) {
    await supabaseAdmin
      .from("clusters")
      .update({ monitor_id: userId })
      .eq("id", clusterId);
  }

  return NextResponse.json({ 
    success: true, 
    message: `User assigned to cluster (${otherAdmins.length + 1}/${MAX_ADMINS_PER_CLUSTER} admins)` 
  });
}

// ------------------------------------------------------------------
// ✅ Fetch All Clusters (with all assigned admins)
// ------------------------------------------------------------------
async function handleFetchClusters(supabaseAdmin: any) {
  const { data: clusters, error } = await supabaseAdmin
    .from("clusters")
    .select(`
      id,
      name,
      location,
      monitor_id,
      monitor:profiles!clusters_monitor_id_fkey(id, full_name, email)
    `)
    .order("name");

  if (error) {
    console.error("Fetch clusters failed:", error);
    return NextResponse.json({ error: "Failed to fetch clusters" }, { status: 500 });
  }

  // Fetch all admins assigned to clusters
  const { data: allAdmins } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email, assigned_cluster_id")
    .not("assigned_cluster_id", "is", null)
    .in("role", ["admin", "cluster_monitor"]);

  // Attach admins to their clusters
  const clustersWithAdmins = (clusters || []).map((cluster: any) => ({
    ...cluster,
    admins: (allAdmins || []).filter((admin: any) => admin.assigned_cluster_id === cluster.id),
    adminCount: (allAdmins || []).filter((admin: any) => admin.assigned_cluster_id === cluster.id).length,
    maxAdmins: MAX_ADMINS_PER_CLUSTER,
  }));

  return NextResponse.json({
    success: true,
    clusters: clustersWithAdmins,
  });
}

// ------------------------------------------------------------------
// ✅ Execute Shuffle - Creates clusters, assigns teams, creates pitch schedule
// ------------------------------------------------------------------
async function handleExecuteShuffle(supabaseAdmin: any) {
  try {
    // 1. Fetch all teams
    const { data: teams, error: teamsError } = await supabaseAdmin
      .from('teams')
      .select('id, name');

    if (teamsError || !teams || teams.length === 0) {
      return NextResponse.json({ error: 'No teams to shuffle' }, { status: 400 });
    }

    // 2. Create or get clusters
    const clusterNames = ['Cluster A', 'Cluster B', 'Cluster C', 'Cluster D', 'Cluster E'];
    const clusterLocations = ['Hall A', 'Hall B', 'Hall C', 'Hall D', 'Hall E'];
    
    const clusterIds: Record<string, string> = {};
    
    for (let i = 0; i < clusterNames.length; i++) {
      const clusterName = clusterNames[i];
      
      // Check if cluster exists
      const { data: existingCluster } = await supabaseAdmin
        .from('clusters')
        .select('id')
        .eq('name', clusterName)
        .single();
      
      if (existingCluster) {
        clusterIds[clusterName] = existingCluster.id;
      } else {
        // Create new cluster
        const { data: newCluster, error: createError } = await supabaseAdmin
          .from('clusters')
          .insert({
            name: clusterName,
            location: clusterLocations[i],
            pitch_duration_seconds: 180, // 3 minutes
            max_teams: 10,
            current_stage: 'onboarding',
            bidding_open: false,
          })
          .select('id')
          .single();
        
        if (createError) {
          console.error(`Failed to create cluster ${clusterName}:`, createError);
          continue;
        }
        clusterIds[clusterName] = newCluster.id;
      }
    }

    // 3. Shuffle teams (Fisher-Yates)
    const shuffled = [...teams];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // 4. Clear existing pitch schedules
    await supabaseAdmin.from('pitch_schedule').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // 5. Assign teams to clusters (round-robin) and create pitch schedules
    const assignments: Record<string, any[]> = {};
    clusterNames.forEach(c => assignments[c] = []);
    
    const pitchPosition: Record<string, number> = {};
    clusterNames.forEach(c => pitchPosition[c] = 1);

    for (let i = 0; i < shuffled.length; i++) {
      const clusterName = clusterNames[i % clusterNames.length];
      const clusterId = clusterIds[clusterName];
      const team = shuffled[i];
      
      // Update team's cluster_id
      const { error: updateError } = await supabaseAdmin
        .from('teams')
        .update({ cluster_id: clusterId })
        .eq('id', team.id);
      
      if (updateError) {
        console.error(`Failed to assign team ${team.name} to cluster:`, updateError);
      }

      // Create pitch schedule entry
      const scheduledStart = new Date();
      scheduledStart.setMinutes(scheduledStart.getMinutes() + (pitchPosition[clusterName] * 5)); // 5 min apart
      
      const { error: scheduleError } = await supabaseAdmin
        .from('pitch_schedule')
        .insert({
          cluster_id: clusterId,
          team_id: team.id,
          scheduled_start: scheduledStart.toISOString(),
          pitch_position: pitchPosition[clusterName],
          status: 'scheduled',
          pitch_duration_seconds: 180,
        });
      
      if (scheduleError) {
        console.error(`Failed to create pitch schedule for team ${team.name}:`, scheduleError);
      }

      assignments[clusterName].push({
        id: team.id,
        name: team.name,
        position: pitchPosition[clusterName],
        status: 'ASSIGNED'
      });
      
      pitchPosition[clusterName]++;
    }

    return NextResponse.json({
      success: true,
      data: assignments,
      clusters: Object.keys(clusterIds).map(name => ({ name, id: clusterIds[name] })),
      message: `Successfully assigned ${teams.length} teams to ${clusterNames.length} clusters with pitch schedules.`,
    });

  } catch (error) {
    console.error('Execute shuffle error:', error);
    return NextResponse.json({ error: 'Failed to execute shuffle' }, { status: 500 });
  }
}

// ------------------------------------------------------------------
// ✅ Fetch Clusters with Teams - Get all clusters and their assigned teams
// ------------------------------------------------------------------
async function handleFetchClustersWithTeams(supabaseAdmin: any) {
  try {
    // Fetch all clusters with their monitor info
    const { data: clusters, error: clustersError } = await supabaseAdmin
      .from('clusters')
      .select(`
        id,
        name,
        location,
        monitor_id,
        current_stage,
        bidding_open,
        monitor:profiles!clusters_monitor_id_fkey(id, full_name, email)
      `)
      .order('name');

    if (clustersError) {
      console.error('Fetch clusters error:', clustersError);
      return NextResponse.json({ error: 'Failed to fetch clusters' }, { status: 500 });
    }

    // Fetch all teams with their cluster assignments
    const { data: teams, error: teamsError } = await supabaseAdmin
      .from('teams')
      .select('id, name, cluster_id, balance, total_invested, total_received')
      .order('name');

    if (teamsError) {
      console.error('Fetch teams error:', teamsError);
      return NextResponse.json({ error: 'Failed to fetch teams' }, { status: 500 });
    }

    // Group teams by cluster
    const clustersWithTeams = (clusters || []).map((cluster: any) => ({
      ...cluster,
      teams: (teams || []).filter((team: any) => team.cluster_id === cluster.id)
    }));

    // Also get unassigned teams
    const unassignedTeams = (teams || []).filter((team: any) => !team.cluster_id);

    return NextResponse.json({
      success: true,
      clusters: clustersWithTeams,
      unassignedTeams,
      totalTeams: teams?.length || 0,
    });

  } catch (error) {
    console.error('Fetch clusters with teams error:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}

// ------------------------------------------------------------------
// ✅ Reassign Team - Move a team to a different cluster
// ------------------------------------------------------------------
async function handleReassignTeam(supabaseAdmin: any, payload: any) {
  const { teamId, newClusterId } = payload;

  if (!teamId) {
    return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
  }

  try {
    // Get old cluster info for audit
    const { data: team } = await supabaseAdmin
      .from('teams')
      .select('name, cluster_id')
      .eq('id', teamId)
      .single();

    const oldClusterId = team?.cluster_id;

    // Update team's cluster assignment
    const { error: updateError } = await supabaseAdmin
      .from('teams')
      .update({ cluster_id: newClusterId || null })
      .eq('id', teamId);

    if (updateError) {
      console.error('Update team cluster error:', updateError);
      return NextResponse.json({ error: 'Failed to reassign team' }, { status: 500 });
    }

    // Update pitch schedule if team has one
    if (newClusterId) {
      // Delete old pitch schedule
      await supabaseAdmin
        .from('pitch_schedule')
        .delete()
        .eq('team_id', teamId);

      // Get next pitch position in new cluster
      const { data: existingSchedules } = await supabaseAdmin
        .from('pitch_schedule')
        .select('pitch_position')
        .eq('cluster_id', newClusterId)
        .order('pitch_position', { ascending: false })
        .limit(1);

      const nextPosition = existingSchedules?.[0]?.pitch_position 
        ? existingSchedules[0].pitch_position + 1 
        : 1;

      // Create new pitch schedule in new cluster
      const scheduledStart = new Date();
      scheduledStart.setMinutes(scheduledStart.getMinutes() + (nextPosition * 5));

      await supabaseAdmin
        .from('pitch_schedule')
        .insert({
          cluster_id: newClusterId,
          team_id: teamId,
          scheduled_start: scheduledStart.toISOString(),
          pitch_position: nextPosition,
          status: 'scheduled',
          pitch_duration_seconds: 180,
        });
    } else {
      // Remove from pitch schedule if unassigning
      await supabaseAdmin
        .from('pitch_schedule')
        .delete()
        .eq('team_id', teamId);
    }

    // Audit log
    await supabaseAdmin.from('audit_logs').insert({
      event_type: 'team_reassigned',
      target_id: teamId,
      metadata: {
        team_name: team?.name,
        old_cluster_id: oldClusterId,
        new_cluster_id: newClusterId,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Team ${team?.name || teamId} reassigned successfully`,
    });

  } catch (error) {
    console.error('Reassign team error:', error);
    return NextResponse.json({ error: 'Failed to reassign team' }, { status: 500 });
  }
}
