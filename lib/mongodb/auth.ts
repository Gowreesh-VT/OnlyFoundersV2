import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import connectDB from './connection';
import { User, IUser } from './models';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = '7d';
const SESSION_COOKIE_NAME = 'auth_session';

if (!JWT_SECRET) {
    console.error('CRITICAL: JWT_SECRET environment variable is not set');
}

// ============================================
// Password Utilities
// ============================================

export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
}

// ============================================
// JWT Token Utilities
// ============================================

export interface JWTPayload {
    userId: string;
    email: string;
    role: string;
    iat?: number;
    exp?: number;
}

export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    if (!JWT_SECRET) {
        throw new Error('JWT_SECRET is not configured');
    }
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JWTPayload | null {
    if (!JWT_SECRET) return null;
    try {
        return jwt.verify(token, JWT_SECRET) as JWTPayload;
    } catch {
        return null;
    }
}

// ============================================
// Session Management
// ============================================

export async function createSession(userId: string, email: string, role: string): Promise<string> {
    const token = generateToken({ userId, email, role });
    
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60, // 7 days
        path: '/',
    });
    
    return token;
}

export async function getSession(): Promise<JWTPayload | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    
    if (!token) return null;
    return verifyToken(token);
}

export async function destroySession(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE_NAME);
}

// ============================================
// User Authentication
// ============================================

export async function authenticateUser(email: string, password: string): Promise<IUser | null> {
    await connectDB();
    
    const user = await User.findOne({ email: email.toLowerCase(), isActive: true });
    if (!user) return null;
    
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) return null;
    
    // Update login tracking
    await User.findByIdAndUpdate(user._id, {
        lastLoginAt: new Date(),
        $inc: { loginCount: 1 }
    });
    
    return user;
}

export async function getCurrentUser(): Promise<IUser | null> {
    const session = await getSession();
    if (!session) return null;
    
    await connectDB();
    const user = await User.findById(session.userId)
        .populate('teamId')
        .populate('collegeId')
        .populate('assignedClusterId');
    
    return user;
}

// ============================================
// User Creation (for admin import)
// ============================================

export async function createUser(userData: {
    email: string;
    password: string;
    fullName: string;
    phoneNumber?: string;
    role?: string;
    teamId?: string;
    collegeId?: string;
    entityId?: string;
    qrToken?: string;
}): Promise<IUser> {
    await connectDB();
    
    const hashedPassword = await hashPassword(userData.password);
    
    const user = new User({
        ...userData,
        password: hashedPassword,
        email: userData.email.toLowerCase()
    });
    
    await user.save();
    return user;
}

// ============================================
// Authorization Helpers
// ============================================

export async function requireAuth(): Promise<JWTPayload> {
    const session = await getSession();
    if (!session) {
        throw new Error('Authentication required');
    }
    return session;
}

export async function requireRole(allowedRoles: string[]): Promise<JWTPayload> {
    const session = await requireAuth();
    if (!allowedRoles.includes(session.role)) {
        throw new Error('Unauthorized: insufficient permissions');
    }
    return session;
}

export async function isSuperAdmin(): Promise<boolean> {
    const session = await getSession();
    return session?.role === 'super_admin';
}

export async function isClusterAdmin(): Promise<boolean> {
    const session = await getSession();
    return session?.role === 'cluster_monitor' || session?.role === 'super_admin';
}
