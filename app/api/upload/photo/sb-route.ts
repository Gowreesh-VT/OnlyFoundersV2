import { createAdminClient, createAnonClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

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
    'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF header
    'image/gif': [[0x47, 0x49, 0x46, 0x38]] // GIF8
};

// Maximum file size: 1.2MB
const MAX_FILE_SIZE = 1.2 * 1024 * 1024;

/**
 * Validate file magic bytes to prevent spoofed content-type
 */
function validateFileMagicBytes(buffer: ArrayBuffer, mimeType: string): boolean {
    const uint8Array = new Uint8Array(buffer);
    const signatures = FILE_SIGNATURES[mimeType];
    
    if (!signatures) return false;
    
    return signatures.some(signature => 
        signature.every((byte, index) => uint8Array[index] === byte)
    );
}

/**
 * Sanitize filename to prevent path traversal attacks
 */
function sanitizeFilename(filename: string): string {
    // Remove path separators and dangerous characters
    return filename
        .replace(/[\/\\:*?"<>|]/g, '')
        .replace(/\.\./g, '')
        .trim();
}

export async function POST(request: NextRequest) {
    try {
        // 1. Verify user is authenticated
        const supabase = await createAnonClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        // 2. Parse multipart form data
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        
        if (!file) {
            return NextResponse.json(
                { error: 'No file provided' },
                { status: 400 }
            );
        }

        // 3. Validate file size
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { error: 'File size exceeds maximum limit of 1.2MB' },
                { status: 400 }
            );
        }

        // 4. Validate MIME type
        if (!ALLOWED_MIME_TYPES.includes(file.type)) {
            return NextResponse.json(
                { error: 'Invalid file type. Allowed types: JPEG, PNG, WebP, GIF' },
                { status: 400 }
            );
        }

        // 5. Validate file magic bytes (prevent spoofed content-type)
        const fileBuffer = await file.arrayBuffer();
        if (!validateFileMagicBytes(fileBuffer, file.type)) {
            return NextResponse.json(
                { error: 'File content does not match declared type' },
                { status: 400 }
            );
        }

        // 6. Sanitize filename and generate safe storage path
        const sanitizedName = sanitizeFilename(file.name);
        const fileExtension = sanitizedName.split('.').pop()?.toLowerCase() || 'jpg';
        const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
        
        if (!allowedExtensions.includes(fileExtension)) {
            return NextResponse.json(
                { error: 'Invalid file extension' },
                { status: 400 }
            );
        }

        // 7. Upload to Supabase Storage using admin client
        const supabaseAdmin = createAdminClient();
        const fileName = `${user.id}/photo.${fileExtension}`;
        
        const { error: uploadError } = await supabaseAdmin.storage
            .from('participant-photos')
            .upload(fileName, fileBuffer, {
                upsert: true,
                contentType: file.type,
            });

        if (uploadError) {
            console.error('Upload error:', uploadError);
            return NextResponse.json(
                { error: 'Failed to upload file' },
                { status: 500 }
            );
        }

        // 8. Get public URL
        const { data: urlData } = supabaseAdmin.storage
            .from('participant-photos')
            .getPublicUrl(fileName);

        // 9. Update profile with photo URL
        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({
                photo_url: urlData.publicUrl,
                photo_uploaded_at: new Date().toISOString(),
            })
            .eq('id', user.id);

        if (updateError) {
            console.error('Profile update error:', updateError);
            return NextResponse.json(
                { error: 'Failed to update profile' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            photoUrl: urlData.publicUrl
        });

    } catch (error: any) {
        console.error('Photo upload error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
