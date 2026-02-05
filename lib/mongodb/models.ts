import mongoose, { Schema, Document, Model } from 'mongoose';

// ============================================
// Enums
// ============================================

export const UserRoles = ['participant', 'team_lead', 'cluster_monitor', 'gate_volunteer', 'admin', 'super_admin'] as const;
export const EventStages = ['onboarding', 'entry_validation', 'pitching', 'bidding', 'locked', 'results_published'] as const;
export const EntryStatuses = ['valid', 'invalid', 'expired'] as const;
export const PitchStatuses = ['scheduled', 'in_progress', 'paused', 'completed', 'cancelled'] as const;
export const InvestmentActions = ['created', 'updated', 'deleted'] as const;

export type UserRole = typeof UserRoles[number];
export type EventStage = typeof EventStages[number];
export type EntryStatus = typeof EntryStatuses[number];
export type PitchStatus = typeof PitchStatuses[number];
export type InvestmentAction = typeof InvestmentActions[number];

// ============================================
// College Schema
// ============================================

export interface ICollege extends Document {
    name: string;
    shortCode?: string;
    location?: string;
    logoUrl?: string;
    adminEmail?: string;
    maxParticipants?: number;
    isActive?: boolean;
    status?: string;
    internalDetails?: string;
    createdAt: Date;
    updatedAt: Date;
}

const collegeSchema = new Schema<ICollege>({
    name: { type: String, required: true, unique: true },
    shortCode: { type: String },
    location: { type: String },
    logoUrl: { type: String },
    adminEmail: { type: String },
    maxParticipants: { type: Number, default: 100 },
    isActive: { type: Boolean, default: true },
    status: { type: String, default: 'active' },
    internalDetails: { type: String }
}, { timestamps: true });

export const College: Model<ICollege> = mongoose.models.College || mongoose.model<ICollege>('College', collegeSchema);

// ============================================
// User Schema (was Profile in Supabase)
// ============================================

export interface IUser extends Document {
    id: string; // Virtual getter from _id
    email: string;
    password: string; // Hashed password
    fullName: string;
    phoneNumber?: string;
    role: UserRole;
    teamId?: mongoose.Types.ObjectId;
    collegeId?: mongoose.Types.ObjectId;
    assignedClusterId?: mongoose.Types.ObjectId;
    memberId?: string; // Generated member ID for admins
    
    // ID Card & QR
    entityId?: string;
    qrToken?: string;
    qrGeneratedAt?: Date;
    photoUrl?: string;
    photoUploadedAt?: Date;
    
    // Activity tracking
    lastLoginAt?: Date;
    loginCount: number;
    isActive: boolean;
    
    // Event preferences
    dietaryPreferences?: string;
    
    createdAt: Date;
    updatedAt: Date;
}

const userSchema = new Schema<IUser>({
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    fullName: { type: String, required: true, trim: true },
    phoneNumber: { type: String, trim: true },
    role: { type: String, enum: UserRoles, default: 'participant' },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team' },
    collegeId: { type: Schema.Types.ObjectId, ref: 'College' },
    assignedClusterId: { type: Schema.Types.ObjectId, ref: 'Cluster' },
    memberId: { type: String }, // Generated member ID for admins
    
    // ID Card & QR
    entityId: { type: String, unique: true, sparse: true },
    qrToken: { type: String },
    qrGeneratedAt: { type: Date },
    photoUrl: { type: String },
    photoUploadedAt: { type: Date },
    
    // Activity tracking
    lastLoginAt: { type: Date },
    loginCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    
    // Event preferences
    dietaryPreferences: { type: String }
}, { timestamps: true });

// Indexes
userSchema.index({ teamId: 1 });
userSchema.index({ collegeId: 1 });
userSchema.index({ role: 1 });
// Note: entityId already has unique index from schema definition
userSchema.index({ isActive: 1 });

export const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', userSchema);

// ============================================
// Cluster Schema
// ============================================

export interface ICluster extends Document {
    name: string;
    monitorId?: mongoose.Types.ObjectId;
    location?: string;
    
    // Pitch management
    pitchOrder?: number[];
    currentPitchingTeamId?: mongoose.Types.ObjectId;
    currentStage: EventStage;
    
    // Settings
    maxTeams: number;
    pitchDurationSeconds: number;
    biddingDeadline?: Date;
    biddingOpen: boolean;
    
    // Results
    isComplete: boolean;
    winnerTeamId?: mongoose.Types.ObjectId;
    
    createdAt: Date;
    updatedAt: Date;
}

const clusterSchema = new Schema<ICluster>({
    name: { type: String, required: true },
    monitorId: { type: Schema.Types.ObjectId, ref: 'User' },
    location: { type: String },
    
    // Pitch management
    pitchOrder: [{ type: Number }],
    currentPitchingTeamId: { type: Schema.Types.ObjectId, ref: 'Team' },
    currentStage: { type: String, enum: EventStages, default: 'onboarding' },
    
    // Settings
    maxTeams: { type: Number, default: 10 },
    pitchDurationSeconds: { type: Number, default: 180 },
    biddingDeadline: { type: Date },
    biddingOpen: { type: Boolean, default: false },
    
    // Results
    isComplete: { type: Boolean, default: false },
    winnerTeamId: { type: Schema.Types.ObjectId, ref: 'Team' }
}, { timestamps: true });

clusterSchema.index({ winnerTeamId: 1 });
clusterSchema.index({ isComplete: 1 });

export const Cluster: Model<ICluster> = mongoose.models.Cluster || mongoose.model<ICluster>('Cluster', clusterSchema);

// ============================================
// Team Schema
// ============================================

export interface ITeam extends Document {
    name: string;
    collegeId?: mongoose.Types.ObjectId;
    clusterId?: mongoose.Types.ObjectId;
    
    // Domain/Category
    domain?: string;
    tags?: string[];
    
    // Financial tracking
    balance: number;
    totalInvested: number;
    totalReceived: number;
    
    // Status flags
    isFinalized: boolean;
    isQualified: boolean;
    
    // Additional metadata
    socialLinks?: {
        twitter?: string;
        linkedin?: string;
        github?: string;
        website?: string;
        [key: string]: string | undefined;
    };
    
    createdAt: Date;
    updatedAt: Date;
}

const teamSchema = new Schema<ITeam>({
    name: { type: String, required: true },
    collegeId: { type: Schema.Types.ObjectId, ref: 'College' },
    clusterId: { type: Schema.Types.ObjectId, ref: 'Cluster' },
    
    // Domain/Category
    domain: { type: String },
    tags: [{ type: String }],
    
    // Financial tracking
    balance: { type: Number, default: 1000000 },
    totalInvested: { type: Number, default: 0 },
    totalReceived: { type: Number, default: 0 },
    
    // Status flags
    isFinalized: { type: Boolean, default: false },
    isQualified: { type: Boolean, default: false },
    
    // Additional metadata
    socialLinks: { type: Schema.Types.Mixed, default: {} }
}, { timestamps: true });

teamSchema.index({ clusterId: 1 });
teamSchema.index({ collegeId: 1 });
teamSchema.index({ domain: 1 });
teamSchema.index({ isQualified: 1 });

export const Team: Model<ITeam> = mongoose.models.Team || mongoose.model<ITeam>('Team', teamSchema);

// ============================================
// Pitch Schedule Schema
// ============================================

export interface IPitchSchedule extends Document {
    clusterId: mongoose.Types.ObjectId;
    teamId: mongoose.Types.ObjectId;
    
    // Pitch details
    pitchTitle?: string;
    pitchAbstract?: string;
    pitchDeckUrl?: string;
    demoUrl?: string;
    
    // Timing
    scheduledStart: Date;
    scheduledEnd?: Date;
    actualStart?: Date;
    actualEnd?: Date;
    pitchDurationSeconds: number;
    
    // Status
    status: PitchStatus;
    pitchPosition?: number;
    
    // Completion
    isCompleted: boolean;
    completedAt?: Date;
    
    createdAt: Date;
    updatedAt: Date;
}

const pitchScheduleSchema = new Schema<IPitchSchedule>({
    clusterId: { type: Schema.Types.ObjectId, ref: 'Cluster', required: true },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    
    // Pitch details
    pitchTitle: { type: String },
    pitchAbstract: { type: String },
    pitchDeckUrl: { type: String },
    demoUrl: { type: String },
    
    // Timing
    scheduledStart: { type: Date, required: true },
    scheduledEnd: { type: Date },
    actualStart: { type: Date },
    actualEnd: { type: Date },
    pitchDurationSeconds: { type: Number, default: 180 },
    
    // Status
    status: { type: String, enum: PitchStatuses, default: 'scheduled' },
    pitchPosition: { type: Number },
    
    // Completion
    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date }
}, { timestamps: true });

pitchScheduleSchema.index({ clusterId: 1 });
pitchScheduleSchema.index({ teamId: 1 });
pitchScheduleSchema.index({ status: 1 });
pitchScheduleSchema.index({ scheduledStart: 1 });

export const PitchSchedule: Model<IPitchSchedule> = mongoose.models.PitchSchedule || mongoose.model<IPitchSchedule>('PitchSchedule', pitchScheduleSchema);

// ============================================
// Notes Schema
// ============================================

export interface INote extends Document {
    authorTeamId: mongoose.Types.ObjectId;
    authorId: mongoose.Types.ObjectId;
    targetTeamId: mongoose.Types.ObjectId;
    pitchSessionId?: mongoose.Types.ObjectId;
    content: string;
    createdAt: Date;
    updatedAt: Date;
}

const noteSchema = new Schema<INote>({
    authorTeamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    targetTeamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    pitchSessionId: { type: Schema.Types.ObjectId, ref: 'PitchSchedule' },
    content: { type: String, required: true }
}, { timestamps: true });

noteSchema.index({ authorTeamId: 1 });
noteSchema.index({ targetTeamId: 1 });
noteSchema.index({ pitchSessionId: 1 });

export const Note: Model<INote> = mongoose.models.Note || mongoose.model<INote>('Note', noteSchema);

// ============================================
// Investment Schema
// ============================================

export interface IInvestment extends Document {
    investorTeamId: mongoose.Types.ObjectId;
    targetTeamId: mongoose.Types.ObjectId;
    amount: number;
    
    // Investment metadata
    reasoning?: string;
    confidenceLevel?: number;
    isLocked: boolean;
    
    createdAt: Date;
    updatedAt: Date;
}

const investmentSchema = new Schema<IInvestment>({
    investorTeamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    targetTeamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    amount: { type: Number, required: true, min: 0 },
    
    // Investment metadata
    reasoning: { type: String },
    confidenceLevel: { type: Number, min: 1, max: 5 },
    isLocked: { type: Boolean, default: false }
}, { timestamps: true });

investmentSchema.index({ investorTeamId: 1 });
investmentSchema.index({ targetTeamId: 1 });
investmentSchema.index({ isLocked: 1 });
investmentSchema.index({ investorTeamId: 1, targetTeamId: 1 }, { unique: true });

export const Investment: Model<IInvestment> = mongoose.models.Investment || mongoose.model<IInvestment>('Investment', investmentSchema);

// ============================================
// Investment History Schema
// ============================================

export interface IInvestmentHistory extends Document {
    investmentId?: mongoose.Types.ObjectId;
    investorTeamId: mongoose.Types.ObjectId;
    targetTeamId: mongoose.Types.ObjectId;
    amount: number;
    action: InvestmentAction;
    performedBy?: mongoose.Types.ObjectId;
    reasoning?: string;
    confidenceLevel?: number;
    createdAt: Date;
}

const investmentHistorySchema = new Schema<IInvestmentHistory>({
    investmentId: { type: Schema.Types.ObjectId, ref: 'Investment' },
    investorTeamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    targetTeamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    amount: { type: Number, required: true },
    action: { type: String, enum: InvestmentActions, required: true },
    performedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reasoning: { type: String },
    confidenceLevel: { type: Number }
}, { timestamps: { createdAt: true, updatedAt: false } });

investmentHistorySchema.index({ investorTeamId: 1 });
investmentHistorySchema.index({ targetTeamId: 1 });
investmentHistorySchema.index({ createdAt: 1 });

export const InvestmentHistory: Model<IInvestmentHistory> = mongoose.models.InvestmentHistory || mongoose.model<IInvestmentHistory>('InvestmentHistory', investmentHistorySchema);

// ============================================
// Entry Log Schema
// ============================================

export interface IEntryLog extends Document {
    entityId: string;
    profileId?: mongoose.Types.ObjectId;
    scannedBy?: mongoose.Types.ObjectId;
    status: EntryStatus;
    location?: string;
    scanType: 'entry' | 'exit';
    scannedAt: Date;
}

const entryLogSchema = new Schema<IEntryLog>({
    entityId: { type: String, required: true },
    profileId: { type: Schema.Types.ObjectId, ref: 'User' },
    scannedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: EntryStatuses, required: true },
    location: { type: String },
    scanType: { type: String, enum: ['entry', 'exit'], default: 'entry' },
    scannedAt: { type: Date, default: Date.now }
});

entryLogSchema.index({ entityId: 1 });
entryLogSchema.index({ profileId: 1 });
entryLogSchema.index({ scannedAt: 1 });
entryLogSchema.index({ scanType: 1 });

export const EntryLog: Model<IEntryLog> = mongoose.models.EntryLog || mongoose.model<IEntryLog>('EntryLog', entryLogSchema);

// ============================================
// Scan Session Schema
// ============================================

export interface IScanSession extends Document {
    profileId: mongoose.Types.ObjectId;
    entryScanId?: mongoose.Types.ObjectId;
    exitScanId?: mongoose.Types.ObjectId;
    sessionStart?: Date;
    sessionEnd?: Date;
    durationMinutes?: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const scanSessionSchema = new Schema<IScanSession>({
    profileId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    entryScanId: { type: Schema.Types.ObjectId, ref: 'EntryLog' },
    exitScanId: { type: Schema.Types.ObjectId, ref: 'EntryLog' },
    sessionStart: { type: Date },
    sessionEnd: { type: Date },
    durationMinutes: { type: Number },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

scanSessionSchema.index({ profileId: 1 });
scanSessionSchema.index({ isActive: 1 });
scanSessionSchema.index({ sessionStart: 1 });

export const ScanSession: Model<IScanSession> = mongoose.models.ScanSession || mongoose.model<IScanSession>('ScanSession', scanSessionSchema);

// ============================================
// Audit Log Schema
// ============================================

export interface IAuditLog extends Document {
    eventType: string;
    actorId?: mongoose.Types.ObjectId;
    targetId?: mongoose.Types.ObjectId;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>({
    eventType: { type: String, required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User' },
    targetId: { type: Schema.Types.ObjectId },
    metadata: { type: Schema.Types.Mixed, default: {} },
    ipAddress: { type: String }
}, { timestamps: { createdAt: true, updatedAt: false } });

auditLogSchema.index({ eventType: 1 });
auditLogSchema.index({ actorId: 1 });
auditLogSchema.index({ createdAt: 1 });

export const AuditLog: Model<IAuditLog> = mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', auditLogSchema);

// ============================================
// Event State Schema
// ============================================

export interface IEventState extends Document {
    key?: string; // Used for key-value storage like settings
    value?: string; // JSON string value for settings
    
    currentStage: EventStage;
    
    // Kill switch
    isFrozen: boolean;
    frozenAt?: Date;
    frozenBy?: mongoose.Types.ObjectId;
    
    // Event timeline
    registrationDeadline?: Date;
    entryStartTime?: Date;
    entryEndTime?: Date;
    pitchingStartTime?: Date;
    pitchingEndTime?: Date;
    biddingDeadline?: Date;
    resultsAnnouncementTime?: Date;
    
    // Flexible configuration
    settings?: Record<string, unknown>;
    
    updatedAt: Date;
}

const eventStateSchema = new Schema<IEventState>({
    key: { type: String, unique: true, sparse: true }, // For key-value storage
    value: { type: String }, // JSON string for settings
    
    currentStage: { type: String, enum: EventStages, default: 'onboarding' },
    
    // Kill switch
    isFrozen: { type: Boolean, default: false },
    frozenAt: { type: Date },
    frozenBy: { type: Schema.Types.ObjectId, ref: 'User' },
    
    // Event timeline
    registrationDeadline: { type: Date },
    entryStartTime: { type: Date },
    entryEndTime: { type: Date },
    pitchingStartTime: { type: Date },
    pitchingEndTime: { type: Date },
    biddingDeadline: { type: Date },
    resultsAnnouncementTime: { type: Date },
    
    // Flexible configuration
    settings: { type: Schema.Types.Mixed, default: {} }
}, { timestamps: { createdAt: false, updatedAt: true } });

export const EventState: Model<IEventState> = mongoose.models.EventState || mongoose.model<IEventState>('EventState', eventStateSchema);

// ============================================
// Leaderboard Cache Schema
// ============================================

export interface ILeaderboardCache extends Document {
    clusterId: mongoose.Types.ObjectId;
    teamId: mongoose.Types.ObjectId;
    rank?: number;
    totalReceived: number;
    uniqueInvestors: number;
    score: number;
    lastCalculatedAt: Date;
}

const leaderboardCacheSchema = new Schema<ILeaderboardCache>({
    clusterId: { type: Schema.Types.ObjectId, ref: 'Cluster', required: true },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    rank: { type: Number },
    totalReceived: { type: Number, default: 0 },
    uniqueInvestors: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    lastCalculatedAt: { type: Date, default: Date.now }
});

leaderboardCacheSchema.index({ clusterId: 1, teamId: 1 }, { unique: true });
leaderboardCacheSchema.index({ clusterId: 1 });
leaderboardCacheSchema.index({ rank: 1 });

export const LeaderboardCache: Model<ILeaderboardCache> = mongoose.models.LeaderboardCache || mongoose.model<ILeaderboardCache>('LeaderboardCache', leaderboardCacheSchema);

// ============================================
// Cluster Results Schema
// ============================================

export interface IClusterResult extends Document {
    clusterId: mongoose.Types.ObjectId;
    winnerTeamId?: mongoose.Types.ObjectId;
    totalInvestmentPool: number;
    participatingTeams: number;
    calculationFormula?: string;
    calculatedAt: Date;
    finalized: boolean;
}

const clusterResultSchema = new Schema<IClusterResult>({
    clusterId: { type: Schema.Types.ObjectId, ref: 'Cluster', required: true, unique: true },
    winnerTeamId: { type: Schema.Types.ObjectId, ref: 'Team' },
    totalInvestmentPool: { type: Number, default: 0 },
    participatingTeams: { type: Number, default: 0 },
    calculationFormula: { type: String },
    calculatedAt: { type: Date, default: Date.now },
    finalized: { type: Boolean, default: false }
});

export const ClusterResult: Model<IClusterResult> = mongoose.models.ClusterResult || mongoose.model<IClusterResult>('ClusterResult', clusterResultSchema);

// ============================================
// Announcement Schema
// ============================================

export interface IAnnouncement extends Document {
    title: string;
    message: string;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    targetAudience: string;
    createdBy?: mongoose.Types.ObjectId;
    expiresAt?: Date;
    isActive: boolean;
    createdAt: Date;
}

const announcementSchema = new Schema<IAnnouncement>({
    title: { type: String, required: true },
    message: { type: String, required: true },
    priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
    targetAudience: { type: String, default: 'all' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    expiresAt: { type: Date },
    isActive: { type: Boolean, default: true }
}, { timestamps: { createdAt: true, updatedAt: false } });

announcementSchema.index({ isActive: 1 });
announcementSchema.index({ targetAudience: 1 });

export const Announcement: Model<IAnnouncement> = mongoose.models.Announcement || mongoose.model<IAnnouncement>('Announcement', announcementSchema);
