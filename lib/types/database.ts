// ============================================
// OnlyFounders Investment Event - TypeScript Types V2
// ============================================

export type UserRole = 'participant' | 'team_lead' | 'cluster_monitor' | 'gate_volunteer' | 'super_admin';
export type EventStage = 'onboarding' | 'entry_validation' | 'pitching' | 'bidding' | 'locked' | 'results_published';
export type EntryStatus = 'valid' | 'invalid' | 'expired';
export type PitchStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type InvestmentAction = 'created' | 'updated' | 'deleted';

// ============================================
// College
// ============================================

export interface College {
    id: string;
    name: string;
    location?: string;
    logo_url?: string;
    created_at: string;
    updated_at: string;
}

// ============================================
// Profile (User with ID card photo)
// ============================================

export interface Profile {
    id: string; // UUID from auth.users
    email: string;
    full_name: string;
    phone_number?: string;
    role: UserRole;
    team_id?: string;
    college_id?: string;
    
    // ID Card & QR
    entity_id?: string; // OF-2026-XXXX
    qr_token?: string;
    qr_generated_at?: string;
    photo_url?: string; // Compressed photo for ID card (max 1MB)
    photo_uploaded_at?: string;
    
    // Activity tracking
    last_login_at?: string;
    login_count: number;
    is_active: boolean;
    
    // Event preferences
    dietary_preferences?: string;
    
    created_at: string;
    updated_at: string;
    
    // Relations (when expanded)
    team?: Team;
    college?: College;
}

// ============================================
// Cluster
// ============================================

export interface Cluster {
    id: string;
    name: string;
    monitor_id?: string;
    location?: string;
    
    // Pitch management
    pitch_order?: number[];
    current_pitching_team_id?: string;
    current_stage: EventStage;
    
    // Settings
    max_teams: number;
    pitch_duration_seconds: number;
    bidding_deadline?: string;
    bidding_open: boolean;
    
    // Results
    is_complete: boolean;
    winner_team_id?: string;
    
    created_at: string;
    updated_at: string;
    
    // Relations
    monitor?: Profile;
    current_pitching_team?: Team;
    winner_team?: Team;
}

// ============================================
// Team (with domain/category)
// ============================================

export interface Team {
    id: string;
    name: string;
    college_id?: string;
    cluster_id?: string;
    
    // Domain/Category
    domain?: string; // 'fintech', 'edtech', 'healthtech', etc.
    tags?: string[]; // ['b2b', 'ai', 'blockchain']
    
    // Financial tracking
    balance: number; // ₹10,00,000
    total_invested: number;
    total_received: number;
    
    // Status flags
    is_finalized: boolean;
    is_qualified: boolean;
    
    // Additional metadata
    social_links?: {
        twitter?: string;
        linkedin?: string;
        github?: string;
        website?: string;
        [key: string]: string | undefined;
    };
    
    created_at: string;
    updated_at: string;
    
    // Relations
    college?: College;
    cluster?: Cluster;
    members?: Profile[];
}

// ============================================
// Pitch Schedule (Multiple pitches per team)
// ============================================

export interface PitchSchedule {
    id: string;
    cluster_id: string;
    team_id: string;
    
    // Pitch details
    pitch_title?: string;
    pitch_abstract?: string;
    pitch_deck_url?: string;
    demo_url?: string;
    
    // Timing
    scheduled_start: string;
    scheduled_end?: string;
    actual_start?: string;
    actual_end?: string;
    pitch_duration_seconds: number;
    
    // Status
    status: PitchStatus;
    pitch_position?: number;
    
    // Completion
    is_completed: boolean;
    completed_at?: string;
    
    created_at: string;
    updated_at: string;
    
    // Relations
    cluster?: Cluster;
    team?: Team;
}

// ============================================
// Note
// ============================================

export interface Note {
    id: string;
    author_team_id: string;
    author_id: string;
    target_team_id: string;
    pitch_session_id?: string;
    content: string;
    created_at: string;
    updated_at: string;
    
    // Relations
    author_team?: Team;
    author?: Profile;
    target_team?: Team;
    pitch_session?: PitchSchedule;
}

// ============================================
// Investment
// ============================================

export interface Investment {
    id: string;
    investor_team_id: string;
    target_team_id: string;
    amount: number;
    
    // Investment metadata
    reasoning?: string;
    confidence_level?: number; // 1-5
    is_locked: boolean;
    
    created_at: string;
    updated_at: string;
    
    // Relations
    investor_team?: Team;
    target_team?: Team;
}

// ============================================
// Investment History (Audit trail)
// ============================================

export interface InvestmentHistory {
    id: string;
    investment_id?: string;
    investor_team_id: string;
    target_team_id: string;
    amount: number;
    action: InvestmentAction;
    performed_by?: string;
    
    // Snapshot
    reasoning?: string;
    confidence_level?: number;
    
    created_at: string;
    
    // Relations
    investor_team?: Team;
    target_team?: Team;
    performer?: Profile;
}

// ============================================
// Entry Log (Gate scanning)
// ============================================

export interface EntryLog {
    id: string;
    entity_id: string;
    profile_id: string;
    scanned_by?: string;
    status: EntryStatus;
    location?: string;
    scan_type: 'entry' | 'exit';
    scanned_at: string;
    
    // Relations
    profile?: Profile;
    scanner?: Profile;
}

// ============================================
// QR Scan Session
// ============================================

export interface ScanSession {
    id: string;
    profile_id: string;
    entry_scan_id?: string;
    exit_scan_id?: string;
    
    // Session timing
    session_start?: string;
    session_end?: string;
    duration_minutes?: number;
    
    // Status
    is_active: boolean;
    
    created_at: string;
    updated_at: string;
    
    // Relations
    profile?: Profile;
    entry_scan?: EntryLog;
    exit_scan?: EntryLog;
}

// ============================================
// Audit Log
// ============================================

export interface AuditLog {
    id: string;
    event_type: string; // 'investment_created', 'pitch_started', etc.
    actor_id?: string;
    target_id?: string;
    metadata?: Record<string, any>;
    ip_address?: string;
    created_at: string;
    
    // Relations
    actor?: Profile;
}

// ============================================
// Event State (Global configuration)
// ============================================

export interface EventState {
    id: string;
    current_stage: EventStage;
    
    // Kill switch
    is_frozen: boolean;
    frozen_at?: string;
    frozen_by?: string;
    
    // Event timeline
    registration_deadline?: string;
    entry_start_time?: string;
    entry_end_time?: string;
    pitching_start_time?: string;
    pitching_end_time?: string;
    bidding_deadline?: string;
    results_announcement_time?: string;
    
    // Flexible configuration
    settings?: Record<string, any>;
    
    updated_at: string;
}

// ============================================
// Leaderboard Cache
// ============================================

export interface LeaderboardCache {
    id: string;
    cluster_id: string;
    team_id: string;
    
    // Rankings
    rank: number;
    total_received: number;
    unique_investors: number;
    score: number;
    
    last_calculated_at: string;
    
    // Relations
    cluster?: Cluster;
    team?: Team;
}

// ============================================
// Cluster Results
// ============================================

export interface ClusterResults {
    id: string;
    cluster_id: string;
    winner_team_id?: string;
    
    // Statistics
    total_investment_pool?: number;
    participating_teams?: number;
    calculation_formula?: string;
    
    calculated_at: string;
    finalized: boolean;
    
    // Relations
    cluster?: Cluster;
    winner_team?: Team;
}

// ============================================
// Announcement
// ============================================

export interface Announcement {
    id: string;
    title: string;
    message: string;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    target_audience: string; // 'all', 'cluster_A', 'team_leads', etc.
    created_by?: string;
    expires_at?: string;
    is_active: boolean;
    created_at: string;
    
    // Relations
    creator?: Profile;
}

// ============================================
// View Types
// ============================================

export interface ClusterStanding {
    team_id: string;
    team_name: string;
    cluster_id: string;
    cluster_name: string;
    domain?: string;
    total_received: number;
    total_invested: number;
    remaining_balance: number;
    is_qualified: boolean;
    unique_investors: number;
    college_name?: string;
}

export interface ActivePitch {
    cluster_id: string;
    cluster_name: string;
    location?: string;
    pitch_session_id: string;
    pitching_team_id: string;
    pitching_team_name: string;
    domain?: string;
    pitch_title?: string;
    pitch_abstract?: string;
    actual_start: string;
    pitch_duration_seconds: number;
    elapsed_seconds: number;
    status: PitchStatus;
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T> {
    data?: T;
    error?: string;
    message?: string;
}

export interface BulkImportResponse {
    success: number;
    failed: number;
    errors: Array<{
        row: number;
        email: string;
        error: string;
    }>;
    created_colleges: string[];
    created_teams: string[];
}

// ============================================
// Form Input Types
// ============================================

export interface BulkImportParticipant {
    fullName: string;
    email: string;
    collegeName: string;
    teamName: string;
    role: 'participant' | 'team_lead';
    phoneNumber?: string;
    domain?: string; // For the team
}

export interface CreateInvestmentInput {
    investor_team_id: string;
    target_team_id: string;
    amount: number;
    reasoning?: string;
    confidence_level?: number;
}

export interface UpdatePitchScheduleInput {
    pitch_title?: string;
    pitch_abstract?: string;
    pitch_deck_url?: string;
    demo_url?: string;
    scheduled_start?: string;
    status?: PitchStatus;
}

export interface CreateAnnouncementInput {
    title: string;
    message: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    target_audience?: string;
    expires_at?: string;
}

// ============================================
// Utility Types
// ============================================

export type TeamWithMembers = Team & {
    members: Profile[];
};

export type ClusterWithTeams = Cluster & {
    teams: Team[];
};

export type InvestmentWithRelations = Investment & {
    investor_team: Team;
    target_team: Team;
};
