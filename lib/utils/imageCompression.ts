// Image compression utility for ID card photos
// Max file size: 1MB
// Output format: JPEG

/**
 * Get optimized image URL for Supabase Storage
 * Adds transformation parameters for lower resolution and faster loading
 */
export function getOptimizedImageUrl(url: string | null | undefined, size: 'thumbnail' | 'small' | 'medium' = 'small'): string | null {
    if (!url) return null;
    
    // If it's a Supabase URL, add transformation parameters
    if (url.includes('supabase')) {
        const params = new URLSearchParams();
        
        switch (size) {
            case 'thumbnail':
                params.append('width', '80');
                params.append('height', '80');
                params.append('quality', '60');
                break;
            case 'small':
                params.append('width', '200');
                params.append('height', '200');
                params.append('quality', '70');
                break;
            case 'medium':
                params.append('width', '400');
                params.append('height', '400');
                params.append('quality', '80');
                break;
        }
        
        return `${url}?${params.toString()}`;
    }
    
    return url;
}

export interface CompressionOptions {
    maxSizeMB: number;
    maxWidthOrHeight: number;
    useWebWorker?: boolean;
    quality: number;
}

export async function compressImage(
    file: File,
    options: CompressionOptions = {
        maxSizeMB: 1,
        maxWidthOrHeight: 800,
        quality: 0.85,
    }
): Promise<File> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const img = new Image();
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                if (width > height) {
                    if (width > options.maxWidthOrHeight) {
                        height = (height * options.maxWidthOrHeight) / width;
                        width = options.maxWidthOrHeight;
                    }
                } else {
                    if (height > options.maxWidthOrHeight) {
                        width = (width * options.maxWidthOrHeight) / height;
                        height = options.maxWidthOrHeight;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Failed to get canvas context'));
                    return;
                }

                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error('Failed to compress image'));
                            return;
                        }

                        const sizeMB = blob.size / 1024 / 1024;
                        
                        if (sizeMB > options.maxSizeMB) {
                            const newQuality = Math.max(0.5, options.quality - 0.1);
                            compressImage(file, { ...options, quality: newQuality })
                                .then(resolve)
                                .catch(reject);
                        } else {
                            // Create file from blob
                            const compressedFile = new File(
                                [blob],
                                file.name.replace(/\.[^/.]+$/, '.jpg'),
                                { type: 'image/jpeg' }
                            );
                            resolve(compressedFile);
                        }
                    },
                    'image/jpeg',
                    options.quality
                );
            };
            
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = e.target?.result as string;
        };
        
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

export function validateImageFile(file: File): { valid: boolean; error?: string } {
    // Check file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        return {
            valid: false,
            error: 'Please upload a JPG, PNG, or WEBP image',
        };
    }
    
    // Check file size (max 10MB before compression)
    const maxSizeBeforeCompression = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSizeBeforeCompression) {
        return {
            valid: false,
            error: 'Image is too large. Please choose a smaller image (max 10MB)',
        };
    }
    
    return { valid: true };
}
