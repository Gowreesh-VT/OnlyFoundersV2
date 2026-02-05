"use client";

import { useState, useRef, useEffect } from 'react';
import { X, Plus, AlertCircle, CheckCircle2 } from 'lucide-react';

interface PhotoUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    userName: string;
}

export default function PhotoUploadModal({ isOpen, onClose, userId, userName }: PhotoUploadModalProps) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isOpen) {
            setSelectedFile(null);
            setPreview(null);
            setError(null);
            setSuccess(false);
        }
    }, [isOpen]);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setError(null);

        // Validate file type
        if (!file.type.startsWith('image/')) {
            setError('Please select an image file');
            return;
        }

        // Validate file size (1.2MB max)
        const maxSize = 1.2 * 1024 * 1024; // 1.2MB in bytes
        if (file.size > maxSize) {
            setError('Image size must be less than 1.2MB');
            return;
        }

        setSelectedFile(file);

        // Create preview
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleUpload = async () => {
        if (!selectedFile) return;

        setUploading(true);
        setError(null);

        try {
            // Use server-side API for secure upload with validation
            const formData = new FormData();
            formData.append('file', selectedFile);

            const response = await fetch('/api/upload/photo', {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Upload failed');
            }

            setSuccess(true);
            setTimeout(() => {
                onClose();
            }, 1500);
        } catch (err: any) {
            setError(err.message || 'Failed to upload photo. Please try again.');
            console.error('Upload error:', err);
        } finally {
            setUploading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black p-4">
            <div className="w-full max-w-md relative">
                {/* Diamond Logo with Glow */}
                <div className="flex justify-center mb-8">
                    <div className="w-20 h-20 rotate-45 border-2 border-primary relative gold-glow bg-black flex items-center justify-center">
                        <div className="w-10 h-10 -rotate-45">
                            <svg viewBox="0 0 24 24" fill="#FFD700" className="w-full h-full">
                                <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
                                <path d="M2 17L12 22L22 17L12 12L2 17Z" opacity="0.7"/>
                                <path d="M2 12L12 17L22 12" opacity="0.5"/>
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Upload Area */}
                <div className="border-2 border-primary p-8 mb-6 relative">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                        disabled={uploading || success}
                    />

                    {preview ? (
                        <div className="relative">
                            <img src={preview} alt="Preview" className="w-full h-64 object-cover mb-4" />
                            {!success && !uploading && (
                                <button
                                    onClick={() => {
                                        setPreview(null);
                                        setSelectedFile(null);
                                    }}
                                    className="absolute top-2 right-2 bg-black/80 text-primary p-2 hover:bg-black transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            )}
                        </div>
                    ) : (
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="w-full h-64 flex flex-col items-center justify-center gap-4 hover:border-primary-hover transition-colors group cursor-pointer"
                        >
                            <Plus size={48} className="text-primary" strokeWidth={1.5} />
                            <div className="text-center">
                                <p className="tech-text text-primary mb-2">Upload Photo</p>
                                <p className="tech-text text-primary">To Initialize</p>
                                <p className="tech-text text-gray-600 text-xs mt-3">Max Size: 1.2 MB</p>
                            </div>
                        </button>
                    )}
                </div>

                {/* Status Messages */}
                <div className="mb-6">
                    {uploading && (
                        <p className="tech-text text-gray-500 text-center">
                            Uploading To Secure Storage...
                        </p>
                    )}
                    {success && (
                        <div className="flex items-center justify-center gap-2 text-success">
                            <CheckCircle2 size={20} />
                            <p className="tech-text">Upload Successful</p>
                        </div>
                    )}
                    {error && (
                        <div className="flex items-center justify-center gap-2 text-error">
                            <AlertCircle size={20} />
                            <p className="tech-text">{error}</p>
                        </div>
                    )}
                </div>

                {/* Pending Verification Text */}
                <p className="tech-text text-gray-600 text-center mb-4">
                    Pending Identity Verification...
                </p>

                {/* Mandatory Notice */}
                <div className="bg-surface-elevated border-l-4 border-primary p-4 mb-6">
                    <p className="tech-text text-primary">
                        &gt; Mandatory: Upload Identity Image
                    </p>
                </div>

                {/* Upload Button */}
                {selectedFile && !success && (
                    <button
                        onClick={handleUpload}
                        disabled={uploading}
                        className="w-full bg-primary hover:bg-primary-hover text-black font-bold py-4 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="tech-text">
                            {uploading ? 'Uploading...' : 'Confirm Upload'}
                        </span>
                    </button>
                )}

                {/* Footer */}
                <div className="mt-8 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
                        <span className="tech-text text-gray-600">Secure Connection</span>
                    </div>
                    <span className="tech-text text-gray-700">OnlyFounders V2.0</span>
                </div>
            </div>
        </div>
    );
}
