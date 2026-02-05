-- ============================================
-- OnlyFounders Investment Event - Database Schema V2
-- ============================================
-- Event: Live founder investment simulation
-- Scale: 300 participants, 50 teams, 5 clusters
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- ENUMS (Drop and recreate to ensure clean state)
-- ============================================

-- Drop existing types if they exist
DROP TYPE IF EXISTS investment_action CASCADE;
DROP TYPE IF EXISTS pitch_status CASCADE;
DROP TYPE IF EXISTS entry_status CASCADE;
DROP TYPE IF EXISTS event_stage CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;

-- Create types
CREATE TYPE user_role AS ENUM ('participant', 'team_lead', 'cluster_monitor', 'gate_volunteer', 'super_admin');
CREATE TYPE event_stage AS ENUM ('onboarding', 'entry_validation', 'pitching', 'bidding', 'locked', 'results_published');
CREATE TYPE entry_status AS ENUM ('valid', 'invalid', 'expired');
CREATE TYPE pitch_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');
CREATE TYPE investment_action AS ENUM ('created', 'updated', 'deleted');

-- ============================================
-- COLLEGES TABLE
-- ============================================

CREATE TABLE colleges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    location VARCHAR(255),
    logo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- PROFILES TABLE (Enhanced with photo for ID card)
-- ============================================

CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20),
    role user_role DEFAULT 'participant',
    team_id UUID,
    college_id UUID REFERENCES colleges(id) ON DELETE SET NULL,
    assigned_cluster_id UUID, -- For admin/cluster_monitor role (max 3 admins per cluster)
    
    -- ID Card & QR
    entity_id VARCHAR(20) UNIQUE, -- Auto-generated E-ID (e.g., OF-2026-A7F3)
    qr_token TEXT, -- Signed JWT for QR validation
    qr_generated_at TIMESTAMP WITH TIME ZONE,
    photo_url TEXT, -- Compressed photo for ID card (max 1MB)
    photo_uploaded_at TIMESTAMP WITH TIME ZONE,
    
    -- Activity tracking
    last_login_at TIMESTAMP WITH TIME ZONE,
    login_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Event preferences
    dietary_preferences TEXT, -- For catering logistics
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- CLUSTERS TABLE
-- ============================================

CREATE TABLE clusters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL, -- e.g., "Cluster A"
    monitor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    location VARCHAR(255), -- Physical location for pitching
    
    -- Pitch management
    pitch_order INTEGER[], -- Array of team positions [1,2,3...10]
    current_pitching_team_id UUID,
    current_stage event_stage DEFAULT 'onboarding',
    
    -- Settings
    max_teams INTEGER DEFAULT 10,
    pitch_duration_seconds INTEGER DEFAULT 180, -- 3 minutes default
    bidding_deadline TIMESTAMP WITH TIME ZONE,
    bidding_open BOOLEAN DEFAULT FALSE,
    
    -- Results
    is_complete BOOLEAN DEFAULT FALSE,
    winner_team_id UUID,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- TEAMS TABLE (Multi-pitch support with domain)
-- ============================================

CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    college_id UUID REFERENCES colleges(id) ON DELETE SET NULL,
    cluster_id UUID REFERENCES clusters(id) ON DELETE SET NULL,
    
    -- Domain/Category
    domain VARCHAR(100), -- 'fintech', 'edtech', 'healthtech', 'agritech', 'saas', etc.
    tags TEXT[], -- ['b2b', 'ai', 'blockchain']
    
    -- Financial tracking
    balance DECIMAL(12, 2) DEFAULT 1000000.00, -- ₹10,00,000 starting capital
    total_invested DECIMAL(12, 2) DEFAULT 0.00,
    total_received DECIMAL(12, 2) DEFAULT 0.00,
    
    -- Status flags
    is_finalized BOOLEAN DEFAULT FALSE, -- Portfolio locked by team lead
    is_qualified BOOLEAN DEFAULT FALSE, -- Winner of cluster
    
    -- Additional metadata
    social_links JSONB DEFAULT '{}', -- {twitter, linkedin, github, website}
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign keys after tables exist
ALTER TABLE profiles ADD CONSTRAINT fk_profiles_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;
ALTER TABLE profiles ADD CONSTRAINT fk_profiles_assigned_cluster FOREIGN KEY (assigned_cluster_id) REFERENCES clusters(id) ON DELETE SET NULL;
ALTER TABLE clusters ADD CONSTRAINT fk_clusters_current_pitching_team FOREIGN KEY (current_pitching_team_id) REFERENCES teams(id) ON DELETE SET NULL;
ALTER TABLE clusters ADD CONSTRAINT fk_clusters_winner_team FOREIGN KEY (winner_team_id) REFERENCES teams(id) ON DELETE SET NULL;

-- ============================================
-- PITCH SCHEDULE (Multiple pitches per team)
-- ============================================

CREATE TABLE pitch_schedule (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cluster_id UUID REFERENCES clusters(id) ON DELETE CASCADE NOT NULL,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
    
    -- Pitch details
    pitch_title VARCHAR(255),
    pitch_abstract TEXT,
    pitch_deck_url TEXT, -- Slide deck if uploaded
    demo_url TEXT, -- Product demo link
    
    -- Timing
    scheduled_start TIMESTAMP WITH TIME ZONE NOT NULL,
    scheduled_end TIMESTAMP WITH TIME ZONE,
    actual_start TIMESTAMP WITH TIME ZONE,
    actual_end TIMESTAMP WITH TIME ZONE,
    pitch_duration_seconds INTEGER DEFAULT 180,
    
    -- Status
    status pitch_status DEFAULT 'scheduled',
    pitch_position INTEGER, -- Order in cluster (1, 2, 3...)
    
    -- Completion
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- NOTES TABLE (Participant observations during pitches)
-- ============================================

CREATE TABLE notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    author_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    target_team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    pitch_session_id UUID REFERENCES pitch_schedule(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INVESTMENTS TABLE
-- ============================================

CREATE TABLE investments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    investor_team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
    target_team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    
    -- Investment metadata
    reasoning TEXT, -- Why did they invest?
    confidence_level INTEGER CHECK (confidence_level BETWEEN 1 AND 5),
    is_locked BOOLEAN DEFAULT FALSE, -- Lock after bidding deadline
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(investor_team_id, target_team_id), -- One investment per team pair
    CHECK (investor_team_id != target_team_id) -- Cannot invest in yourself
);

-- ============================================
-- INVESTMENT HISTORY (Audit trail for all changes)
-- ============================================

CREATE TABLE investment_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    investment_id UUID, -- NULL if deleted
    investor_team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
    target_team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    action investment_action NOT NULL,
    performed_by UUID REFERENCES profiles(id),
    
    -- Snapshot of reasoning at time of action
    reasoning TEXT,
    confidence_level INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ENTRY LOGS TABLE (Gate scanning records)
-- ============================================

CREATE TABLE entry_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_id VARCHAR(20) NOT NULL,
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    scanned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    status entry_status NOT NULL,
    location VARCHAR(255),
    scan_type VARCHAR(20) DEFAULT 'entry', -- 'entry' or 'exit'
    scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- QR SCAN SESSIONS (Track entry/exit patterns)
-- ============================================

CREATE TABLE scan_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    entry_scan_id UUID REFERENCES entry_logs(id),
    exit_scan_id UUID REFERENCES entry_logs(id),
    
    -- Session timing
    session_start TIMESTAMP WITH TIME ZONE,
    session_end TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE, -- FALSE when exited
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- AUDIT LOGS TABLE (Immutable dispute records)
-- ============================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL, -- e.g., 'investment_created', 'pitch_started', 'admin_override'
    actor_id UUID REFERENCES profiles(id),
    target_id UUID, -- Generic reference (team_id, investment_id, etc.)
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- GLOBAL EVENT STATE (Enhanced with deadlines)
-- ============================================

CREATE TABLE event_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    current_stage event_stage DEFAULT 'onboarding',
    
    -- Kill switch
    is_frozen BOOLEAN DEFAULT FALSE,
    frozen_at TIMESTAMP WITH TIME ZONE,
    frozen_by UUID REFERENCES profiles(id),
    
    -- Event timeline
    registration_deadline TIMESTAMP WITH TIME ZONE,
    entry_start_time TIMESTAMP WITH TIME ZONE,
    entry_end_time TIMESTAMP WITH TIME ZONE,
    pitching_start_time TIMESTAMP WITH TIME ZONE,
    pitching_end_time TIMESTAMP WITH TIME ZONE,
    bidding_deadline TIMESTAMP WITH TIME ZONE,
    results_announcement_time TIMESTAMP WITH TIME ZONE,
    
    -- Flexible configuration
    settings JSONB DEFAULT '{}', -- Any additional event settings
    
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default event state
INSERT INTO event_state (current_stage) VALUES ('onboarding');

-- ============================================
-- LEADERBOARD CACHE (Pre-computed rankings)
-- ============================================

CREATE TABLE leaderboard_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cluster_id UUID REFERENCES clusters(id) ON DELETE CASCADE NOT NULL,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
    
    -- Rankings
    rank INTEGER,
    total_received DECIMAL(12, 2) DEFAULT 0.00,
    unique_investors INTEGER DEFAULT 0,
    score DECIMAL(12, 2) DEFAULT 0.00, -- Weighted formula
    
    last_calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cluster_id, team_id)
);

-- ============================================
-- CLUSTER RESULTS (Winner calculation)
-- ============================================

CREATE TABLE cluster_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cluster_id UUID REFERENCES clusters(id) ON DELETE CASCADE UNIQUE,
    winner_team_id UUID REFERENCES teams(id),
    
    -- Statistics
    total_investment_pool DECIMAL(12, 2),
    participating_teams INTEGER,
    calculation_formula VARCHAR(255),
    
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    finalized BOOLEAN DEFAULT FALSE
);

-- ============================================
-- ANNOUNCEMENTS (Real-time broadcasts)
-- ============================================

CREATE TABLE announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, urgent
    target_audience VARCHAR(50) DEFAULT 'all', -- all, cluster_A, team_leads, etc.
    created_by UUID REFERENCES profiles(id),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_profiles_team ON profiles(team_id);
CREATE INDEX idx_profiles_college ON profiles(college_id);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_entity_id ON profiles(entity_id);
CREATE INDEX idx_profiles_is_active ON profiles(is_active);

CREATE INDEX idx_teams_cluster ON teams(cluster_id);
CREATE INDEX idx_teams_college ON teams(college_id);
CREATE INDEX idx_teams_domain ON teams(domain);
CREATE INDEX idx_teams_qualified ON teams(is_qualified);

CREATE INDEX idx_clusters_winner ON clusters(winner_team_id);
CREATE INDEX idx_clusters_complete ON clusters(is_complete);

CREATE INDEX idx_pitch_schedule_cluster ON pitch_schedule(cluster_id);
CREATE INDEX idx_pitch_schedule_team ON pitch_schedule(team_id);
CREATE INDEX idx_pitch_schedule_status ON pitch_schedule(status);
CREATE INDEX idx_pitch_schedule_scheduled_start ON pitch_schedule(scheduled_start);

CREATE INDEX idx_investments_investor ON investments(investor_team_id);
CREATE INDEX idx_investments_target ON investments(target_team_id);
CREATE INDEX idx_investments_locked ON investments(is_locked);

CREATE INDEX idx_investment_history_investor ON investment_history(investor_team_id);
CREATE INDEX idx_investment_history_target ON investment_history(target_team_id);
CREATE INDEX idx_investment_history_created_at ON investment_history(created_at);

CREATE INDEX idx_notes_author_team ON notes(author_team_id);
CREATE INDEX idx_notes_target_team ON notes(target_team_id);
CREATE INDEX idx_notes_pitch_session ON notes(pitch_session_id);

CREATE INDEX idx_entry_logs_entity ON entry_logs(entity_id);
CREATE INDEX idx_entry_logs_profile ON entry_logs(profile_id);
CREATE INDEX idx_entry_logs_scanned_at ON entry_logs(scanned_at);
CREATE INDEX idx_entry_logs_scan_type ON entry_logs(scan_type);

CREATE INDEX idx_scan_sessions_profile ON scan_sessions(profile_id);
CREATE INDEX idx_scan_sessions_active ON scan_sessions(is_active);
CREATE INDEX idx_scan_sessions_start ON scan_sessions(session_start);

CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

CREATE INDEX idx_leaderboard_cluster ON leaderboard_cache(cluster_id);
CREATE INDEX idx_leaderboard_rank ON leaderboard_cache(rank);

CREATE INDEX idx_announcements_active ON announcements(is_active);
CREATE INDEX idx_announcements_target ON announcements(target_audience);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

ALTER TABLE colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE pitch_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE investment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE entry_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE cluster_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Colleges
CREATE POLICY "Colleges viewable by authenticated" ON colleges FOR SELECT 
    USING (auth.role() = 'authenticated');
CREATE POLICY "Super admin can manage colleges" ON colleges FOR ALL 
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- Profiles: Read all, update own
CREATE POLICY "Profiles viewable by authenticated" ON profiles FOR SELECT 
    USING (auth.role() = 'authenticated');
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE 
    USING (auth.uid() = id);

-- Teams: Viewable by same cluster members, cluster monitors, and super admins
CREATE POLICY "Teams viewable by cluster members and admins" ON teams FOR SELECT 
    USING (
        -- Cluster members can view teams in their cluster
        cluster_id IN (
            SELECT t.cluster_id FROM teams t
            JOIN profiles p ON p.team_id = t.id
            WHERE p.id = auth.uid()
        )
        OR
        -- Cluster monitors can view teams in their assigned cluster
        cluster_id IN (
            SELECT assigned_cluster_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'cluster_monitor')
        )
        OR
        -- Cluster monitors (legacy: monitor_id on cluster)
        cluster_id IN (
            SELECT id FROM clusters WHERE monitor_id = auth.uid()
        )
        OR
        -- Super admins can view all teams
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    );

-- Pitch Schedule: Viewable by all, managed by admins
CREATE POLICY "Pitch schedule viewable by authenticated" ON pitch_schedule FOR SELECT
    USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage pitch schedule" ON pitch_schedule FOR ALL
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('cluster_monitor', 'super_admin')));

-- Investments: Team members can view/create their team's investments
CREATE POLICY "Team can view investments" ON investments FOR SELECT
    USING (
        investor_team_id IN (SELECT team_id FROM profiles WHERE id = auth.uid())
        OR target_team_id IN (SELECT team_id FROM profiles WHERE id = auth.uid())
    );
CREATE POLICY "Team lead can create investments" ON investments FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('team_lead', 'super_admin')
            AND team_id = investor_team_id
        )
    );
CREATE POLICY "Team lead can update investments" ON investments FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('team_lead', 'super_admin')
            AND team_id = investor_team_id
        )
    );

-- Investment History: Viewable by team members
CREATE POLICY "Team can view investment history" ON investment_history FOR SELECT
    USING (
        investor_team_id IN (SELECT team_id FROM profiles WHERE id = auth.uid())
        OR target_team_id IN (SELECT team_id FROM profiles WHERE id = auth.uid())
    );

-- Notes: Can create for own team, view notes about teams in your cluster
CREATE POLICY "Users can create notes" ON notes FOR INSERT
    WITH CHECK (
        author_id = auth.uid() 
        AND author_team_id IN (SELECT team_id FROM profiles WHERE id = auth.uid())
    );
CREATE POLICY "Users can view cluster notes" ON notes FOR SELECT
    USING (
        author_team_id IN (
            SELECT t.id FROM teams t
            WHERE t.cluster_id IN (
                SELECT t2.cluster_id FROM teams t2
                JOIN profiles p ON p.team_id = t2.id
                WHERE p.id = auth.uid()
            )
        )
    );

-- Entry logs & Scan Sessions: Gate volunteers and super admin
CREATE POLICY "Gate volunteers can create entry logs" ON entry_logs FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('gate_volunteer', 'super_admin')
        )
    );
CREATE POLICY "Staff can view entry logs" ON entry_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('gate_volunteer', 'cluster_monitor', 'super_admin')
        )
        OR profile_id = auth.uid()
    );

CREATE POLICY "Staff can manage scan sessions" ON scan_sessions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('gate_volunteer', 'super_admin')
        )
        OR profile_id = auth.uid()
    );

-- Clusters: Monitors can update their cluster
CREATE POLICY "Monitors can update cluster" ON clusters FOR UPDATE
    USING (monitor_id = auth.uid());
CREATE POLICY "All authenticated can view clusters" ON clusters FOR SELECT
    USING (auth.role() = 'authenticated');

-- Leaderboard: Viewable by all
CREATE POLICY "Leaderboard viewable by authenticated" ON leaderboard_cache FOR SELECT
    USING (auth.role() = 'authenticated');

-- Cluster Results: Viewable by all
CREATE POLICY "Results viewable by authenticated" ON cluster_results FOR SELECT
    USING (auth.role() = 'authenticated');

-- Announcements: Viewable by all
CREATE POLICY "Announcements viewable by authenticated" ON announcements FOR SELECT
    USING (auth.role() = 'authenticated' AND is_active = TRUE);
CREATE POLICY "Admins can manage announcements" ON announcements FOR ALL
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('cluster_monitor', 'super_admin')));

-- Event state: Super admin only
CREATE POLICY "Super admin can manage event state" ON event_state FOR ALL
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));
CREATE POLICY "All can view event state" ON event_state FOR SELECT
    USING (auth.role() = 'authenticated');

-- Audit logs: Append-only, viewable by super admin
CREATE POLICY "System can create audit logs" ON audit_logs FOR INSERT
    WITH CHECK (true);
CREATE POLICY "Super admin can view audit logs" ON audit_logs FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_clusters_updated_at BEFORE UPDATE ON clusters FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_colleges_updated_at BEFORE UPDATE ON colleges FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_notes_updated_at BEFORE UPDATE ON notes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_pitch_schedule_updated_at BEFORE UPDATE ON pitch_schedule FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_investments_updated_at BEFORE UPDATE ON investments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_scan_sessions_updated_at BEFORE UPDATE ON scan_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Track login activity
CREATE OR REPLACE FUNCTION track_user_login()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE profiles 
    SET last_login_at = NOW(),
        login_count = login_count + 1
    WHERE id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Investment history tracking
CREATE OR REPLACE FUNCTION log_investment_history()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO investment_history (investment_id, investor_team_id, target_team_id, amount, action, performed_by, reasoning, confidence_level)
        VALUES (NEW.id, NEW.investor_team_id, NEW.target_team_id, NEW.amount, 'created', auth.uid(), NEW.reasoning, NEW.confidence_level);
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO investment_history (investment_id, investor_team_id, target_team_id, amount, action, performed_by, reasoning, confidence_level)
        VALUES (NEW.id, NEW.investor_team_id, NEW.target_team_id, NEW.amount, 'updated', auth.uid(), NEW.reasoning, NEW.confidence_level);
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO investment_history (investment_id, investor_team_id, target_team_id, amount, action, performed_by, reasoning, confidence_level)
        VALUES (OLD.id, OLD.investor_team_id, OLD.target_team_id, OLD.amount, 'deleted', auth.uid(), OLD.reasoning, OLD.confidence_level);
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_investment_changes
    AFTER INSERT OR UPDATE OR DELETE ON investments
    FOR EACH ROW
    EXECUTE FUNCTION log_investment_history();

-- Update team balances after investment
CREATE OR REPLACE FUNCTION update_team_balances()
RETURNS TRIGGER AS $$
BEGIN
    -- Update investor's total invested
    UPDATE teams 
    SET total_invested = (
        SELECT COALESCE(SUM(amount), 0) 
        FROM investments 
        WHERE investor_team_id = COALESCE(NEW.investor_team_id, OLD.investor_team_id)
    )
    WHERE id = COALESCE(NEW.investor_team_id, OLD.investor_team_id);
    
    -- Update target's total received
    UPDATE teams 
    SET total_received = (
        SELECT COALESCE(SUM(amount), 0) 
        FROM investments 
        WHERE target_team_id = COALESCE(NEW.target_team_id, OLD.target_team_id)
    )
    WHERE id = COALESCE(NEW.target_team_id, OLD.target_team_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_investment_change
    AFTER INSERT OR UPDATE OR DELETE ON investments
    FOR EACH ROW
    EXECUTE FUNCTION update_team_balances();

-- Validate investment doesn't exceed balance
CREATE OR REPLACE FUNCTION validate_investment_balance()
RETURNS TRIGGER AS $$
DECLARE
    current_balance DECIMAL(12, 2);
    total_invested DECIMAL(12, 2);
BEGIN
    SELECT balance INTO current_balance FROM teams WHERE id = NEW.investor_team_id;
    
    SELECT COALESCE(SUM(amount), 0) INTO total_invested 
    FROM investments 
    WHERE investor_team_id = NEW.investor_team_id 
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID);
    
    IF (total_invested + NEW.amount) > current_balance THEN
        RAISE EXCEPTION 'Investment exceeds available balance (Balance: ₹%, Already Invested: ₹%, Attempting: ₹%)', 
            current_balance, total_invested, NEW.amount;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_investment_balance
    BEFORE INSERT OR UPDATE ON investments
    FOR EACH ROW
    EXECUTE FUNCTION validate_investment_balance();

-- Refresh leaderboard for a cluster
CREATE OR REPLACE FUNCTION refresh_leaderboard(p_cluster_id UUID)
RETURNS VOID AS $$
BEGIN
    DELETE FROM leaderboard_cache WHERE cluster_id = p_cluster_id;
    
    INSERT INTO leaderboard_cache (cluster_id, team_id, rank, total_received, unique_investors, score)
    SELECT 
        p_cluster_id,
        team_id,
        ROW_NUMBER() OVER (ORDER BY total_received DESC, unique_investors DESC) as rank,
        total_received,
        unique_investors,
        -- Score formula: 70% weighted on total received, 30% on investor diversity
        (total_received * 0.7) + (unique_investors * 100000 * 0.3) as score
    FROM (
        SELECT 
            t.id as team_id,
            COALESCE(SUM(i.amount), 0) as total_received,
            COUNT(DISTINCT i.investor_team_id) as unique_investors
        FROM teams t
        LEFT JOIN investments i ON i.target_team_id = t.id
        WHERE t.cluster_id = p_cluster_id
        GROUP BY t.id
    ) stats;
END;
$$ LANGUAGE plpgsql;

-- Auto-close scan session on exit
CREATE OR REPLACE FUNCTION close_scan_session()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.scan_type = 'exit' THEN
        UPDATE scan_sessions
        SET exit_scan_id = NEW.id,
            session_end = NEW.scanned_at,
            duration_minutes = EXTRACT(EPOCH FROM (NEW.scanned_at - session_start)) / 60,
            is_active = FALSE
        WHERE profile_id = NEW.profile_id
        AND is_active = TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_close_session
    AFTER INSERT ON entry_logs
    FOR EACH ROW
    EXECUTE FUNCTION close_scan_session();

-- ============================================
-- REALTIME SUBSCRIPTIONS
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE teams;
ALTER PUBLICATION supabase_realtime ADD TABLE investments;
ALTER PUBLICATION supabase_realtime ADD TABLE clusters;
ALTER PUBLICATION supabase_realtime ADD TABLE pitch_schedule;
ALTER PUBLICATION supabase_realtime ADD TABLE notes;
ALTER PUBLICATION supabase_realtime ADD TABLE leaderboard_cache;
ALTER PUBLICATION supabase_realtime ADD TABLE announcements;

-- ============================================
-- HELPER VIEWS
-- ============================================

-- Team standings per cluster
CREATE OR REPLACE VIEW cluster_standings AS
SELECT 
    t.id as team_id,
    t.name as team_name,
    t.cluster_id,
    c.name as cluster_name,
    t.domain,
    t.total_received,
    t.total_invested,
    t.balance - t.total_invested as remaining_balance,
    t.is_qualified,
    (SELECT COUNT(DISTINCT investor_team_id) FROM investments WHERE target_team_id = t.id) as unique_investors,
    col.name as college_name
FROM teams t
LEFT JOIN clusters c ON c.id = t.cluster_id
LEFT JOIN colleges col ON col.id = t.college_id
ORDER BY c.name, t.total_received DESC, unique_investors DESC;

-- Active pitch information
CREATE OR REPLACE VIEW active_pitches AS
SELECT 
    c.id as cluster_id,
    c.name as cluster_name,
    c.location,
    ps.id as pitch_session_id,
    t.id as pitching_team_id,
    t.name as pitching_team_name,
    t.domain,
    ps.pitch_title,
    ps.pitch_abstract,
    ps.actual_start,
    ps.pitch_duration_seconds,
    EXTRACT(EPOCH FROM (NOW() - ps.actual_start))::INTEGER as elapsed_seconds,
    ps.status
FROM clusters c
JOIN pitch_schedule ps ON ps.cluster_id = c.id AND ps.status = 'in_progress'
JOIN teams t ON t.id = ps.team_id;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
