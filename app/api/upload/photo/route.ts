import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb/connection';
import { User } from '@/lib/mongodb/models';
import { getSession } from '@/lib/mongodb/auth';
import { createAdminClient } from '@/lib/supabase/server';
import crypto from 'crypto';

// Supabase storage bucket name
const BUCKET_NAME = 'participant-photos';

// Allowed MIME types for photos
const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif'
];

// File magic bytes for validation
const FILE_SIGNATURES: Record<string, number[][]> = {
    'image/jpeg': [[0xFF, 0xD8, 0xFF]],
    'image/jpg': [[0xFF, 0xD8, 0xFF]],
    'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
    'image/webp': [[0x52, 0x49, 0x46, 0x46]],
    'image/gif': [[0x47, 0x49, 0x46, 0x38]]
};

// Maximum file size: 1.2MB
const MAX_FILE_SIZE = 1.2 * 1024 * 1024;

function validateFileMagicBytes(buffer: ArrayBuffer, mimeType: string): boolean {
    const uint8Array = new Uint8Array(buffer);
    const signatures = FILE_SIGNATURES[mimeType];
    
    if (!signatures) return false;
    
    return signatures.some(signature => 
        signature.every((byte, index) => uint8Array[index] === byte)
    );
}

function sanitizeFilename(filename: string): string {
    return filename
        .replace(/[\/\\:*?"<>|]/g, '')
        .replace(/\.\./g, '')
        .trim();
}

export async function POST(request: NextRequest) {
    try {
        await connectDB();
        
        // Verify user is authenticated
        const session = await getSession();
        if (!session) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        // Parse multipart form data
        const formData = await request.formData();
        const file = (formData.get('photo') || formData.get('file')) as File | null;
        
        if (!file) {
            return NextResponse.json(
                { error: 'No file provided' },
                { status: 400 }
            );
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { error: 'File size exceeds maximum limit of 1.2MB' },
                { status: 400 }
            );
        }

        // Validate MIME type
        if (!ALLOWED_MIME_TYPES.includes(file.type)) {
            return NextResponse.json(
                { error: 'Invalid file type. Allowed types: JPEG, PNG, WebP, GIF' },
                { status: 400 }
            );
        }

        // Validate file magic bytes
        const fileBuffer = await file.arrayBuffer();
        if (!validateFileMagicBytes(fileBuffer, file.type)) {
            return NextResponse.json(
                { error: 'File content does not match declared type' },
                { status: 400 }
            );
        }

        // Generate safe filename
        const sanitizedName = sanitizeFilename(file.name);
        const fileExtension = sanitizedName.split('.').pop()?.toLowerCase() || 'jpg';
        const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
        
        if (!allowedExtensions.includes(fileExtension)) {
            return NextResponse.json(
                { error: 'Invalid file extension' },
                { status: 400 }
            );
        }

        // Create unique filename
        const uniqueId = crypto.randomBytes(8).toString('hex');
        const fileName = `${session.userId}_${uniqueId}.${fileExtension}`;
        
        // Upload to Supabase Storage
        const supabase = createAdminClient();
        
        // Get current user to check for old photo to delete
        const currentUser = await User.findById(session.userId);
        const oldPhotoUrl = currentUser?.photoUrl;

        // Delete old photo from Supabase if it exists
        if (oldPhotoUrl && oldPhotoUrl.includes('supabase')) {
            try {
                // Extract the file path from the URL
                const urlParts = oldPhotoUrl.split('/storage/v1/object/public/participant-photos/');
                if (urlParts.length > 1) {
                    const oldFilePath = urlParts[1];
                    await supabase.storage.from(BUCKET_NAME).remove([oldFilePath]);
                }
            } catch (deleteError) {
                console.warn('Failed to delete old photo:', deleteError);
            }
        }

        // Upload new photo
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(fileName, Buffer.from(fileBuffer), {
                contentType: file.type,
                upsert: true // Overwrite if exists
            });

        if (error) {
            console.error('Supabase upload error:', error);
            return NextResponse.json(
                { error: 'Failed to upload photo' },
                { status: 500 }
            );
        }

        // Get the public URL
        const { data: urlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(fileName);

        const photoUrl = urlData.publicUrl;

        // Update user profile in MongoDB
        await User.findByIdAndUpdate(session.userId, {
            photoUrl,
            photoUploadedAt: new Date()
        });

        return NextResponse.json({
            success: true,
            photoUrl
        });

    } catch (error: any) {
        console.error('Photo upload error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
