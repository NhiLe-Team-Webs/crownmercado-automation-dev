'use client';

import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB parts

interface VideoUploaderProps {
    projectId?: string;
    onUploadComplete: (videoId: string) => void;
    onClose?: () => void;
}

import { Upload, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function VideoUploader({ onUploadComplete, onClose }: VideoUploaderProps) {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState<string>('Select files to upload');
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const getFileFingerprint = (f: File) => `upload_${f.name}_${f.size}_${f.lastModified}`;

    // Prevent accidental tab closure
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (uploading) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [uploading]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            setError(null);
            setProgress(0);
            setStatus('Ready to ingest');
            // Auto-trigger upload if we have a file
            setTimeout(() => startUpload(selectedFile), 100);
        }
    };

    const cancelUpload = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setStatus('Aborting pipeline...');
            setUploading(false);
            setError('Ingress terminated by operator.');

            // Clear resumable state on explicit cancel
            if (file) {
                localStorage.removeItem(getFileFingerprint(file));
            }
        }
    };

    const startUpload = async (fileToUpload: File) => {
        if (!fileToUpload) return;
        const fingerprint = getFileFingerprint(fileToUpload);

        try {
            setUploading(true);
            setError(null);
            abortControllerRef.current = new AbortController();

            // Check for resumable state
            const storedState = localStorage.getItem(fingerprint);
            let upload_id: string;
            let video_id: string;
            let uploadedParts: any[] = [];

            if (storedState) {
                const state = JSON.parse(storedState);
                upload_id = state.upload_id;
                video_id = state.video_id;
                uploadedParts = state.uploadedParts || [];
                setStatus('Resuming previous pipeline...');
            } else {
                setStatus('Initiating pipeline...');
                const result = await api.initiateUpload(fileToUpload.name, fileToUpload.type);
                upload_id = result.upload_id;
                video_id = result.video_id;
            }

            const totalParts = Math.ceil(fileToUpload.size / CHUNK_SIZE);
            const uploadedPartNumbers = new Set(uploadedParts.map(p => p.PartNumber));

            for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
                if (abortControllerRef.current.signal.aborted) return;

                // Skip if already uploaded
                if (uploadedPartNumbers.has(partNumber)) {
                    setProgress(Math.round((partNumber / totalParts) * 100));
                    continue;
                }

                const start = (partNumber - 1) * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, fileToUpload.size);
                const chunk = fileToUpload.slice(start, end);

                setStatus(`Syncing segment ${partNumber}/${totalParts}`);
                const { url } = await api.getPresignedUrl(video_id, upload_id, partNumber);
                const etag = await api.uploadChunk(url, chunk);
                if (!etag) throw new Error(`Transmission failed for segment ${partNumber}: ETag missing`);

                uploadedParts.push({ PartNumber: partNumber, ETag: etag.replace(/"/g, '') });
                uploadedPartNumbers.add(partNumber);

                // Save progress to localStorage
                localStorage.setItem(fingerprint, JSON.stringify({
                    upload_id,
                    video_id,
                    uploadedParts
                }));

                setProgress(Math.round((partNumber / totalParts) * 100));
            }

            setStatus('Finalizing deployment...');
            await api.completeUpload(video_id, upload_id, uploadedParts);

            // Clear storage on success
            localStorage.removeItem(fingerprint);

            setUploading(false);
            onUploadComplete(video_id);
        } catch (err: any) {
            if (err.name === 'AbortError') return;
            setError(err.message || 'Transmission failed');
            setUploading(false);
        } finally {
            abortControllerRef.current = null;
        }
    };

    return (
        <div className="bg-[#1C1C1C] w-full max-w-3xl mx-auto rounded-2xl border border-[#333333] shadow-2xl overflow-hidden flex flex-col h-[600px] animate-in fade-in zoom-in duration-300 relative">
            {onClose && (
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 p-2 text-text-secondary hover:text-white transition-colors z-50"
                >
                    <X size={24} />
                </button>
            )}
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                {!uploading && !error && progress < 100 && (
                    <div className="animate-in fade-in duration-500 w-full">
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="w-32 h-32 rounded-full bg-black/30 flex items-center justify-center mb-8 mx-auto cursor-pointer hover:bg-black/50 transition-all border border-dashed border-white/10 hover:border-primary group"
                        >
                            <Upload size={48} className="text-text-secondary group-hover:text-primary transition-colors" />
                        </div>
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleFileChange}
                            accept="video/*"
                        />
                        <h4 className="text-xl font-medium text-white mb-2">Drag and drop video files to upload</h4>

                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="px-8 py-2.5 bg-primary hover:bg-primary-hover text-white font-bold rounded-lg transition-all active:scale-95 shadow-lg shadow-primary/20"
                        >
                            SELECT FILES
                        </button>
                    </div>
                )}

                {uploading && (
                    <div className="w-full max-w-md animate-in fade-in duration-300">
                        <div className="w-24 h-24 rounded-full border-4 border-primary/20 border-t-primary animate-spin mb-8 mx-auto" />
                        <h4 className="text-2xl font-bold text-white mb-4">Ingesting bytes...</h4>
                        <p className="text-sm text-text-secondary uppercase tracking-[0.2em] font-black mb-8">{status}</p>
                        <button
                            onClick={cancelUpload}
                            className="px-6 py-2 border border-primary/40 text-primary text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-primary/10 transition-all"
                        >
                            Cancel Ingress
                        </button>
                    </div>
                )}

                {!uploading && progress === 100 && (
                    <div className="animate-in zoom-in duration-500">
                        <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mb-8 mx-auto">
                            <CheckCircle2 size={56} className="text-green-500" />
                        </div>
                        <h4 className="text-2xl font-bold text-white mb-2">Upload Complete</h4>
                        <p className="text-sm text-text-secondary mb-8">Your video has been successfully added to the vault.</p>
                        <Link href="/library" className="text-primary font-bold hover:underline uppercase tracking-widest text-sm">Return to Library</Link>
                    </div>
                )}

                {error && (
                    <div className="animate-in shake duration-500">
                        <div className="w-24 h-24 rounded-full bg-red-500/20 flex items-center justify-center mb-8 mx-auto">
                            <AlertCircle size={56} className="text-red-500" />
                        </div>
                        <h4 className="text-2xl font-bold text-white mb-2">Deployment Failed</h4>
                        <p className="text-sm text-red-400 mb-8 max-w-md">{error}</p>
                        <button onClick={() => {
                            setError(null);
                            setProgress(0);
                            setFile(null);
                        }} className="text-white bg-white/10 px-6 py-2 rounded-lg font-bold hover:bg-white/20 transition-all uppercase text-xs tracking-widest">Restart Pipeline</button>
                    </div>
                )}
            </div>

            {/* Progress Bar Footer */}
            {(uploading || (progress > 0 && progress < 100)) && (
                <div className="px-12 py-8 bg-black/40 border-t border-[#333333]">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Loader2 size={16} className="text-primary animate-spin" />
                            <span className="text-xs font-bold text-text-secondary uppercase tracking-widest">TRANSMISSION: {progress}%</span>
                        </div>
                        <span className="text-xs font-black text-white italic">{(file?.size ? (file.size * progress / 100 / (1024 * 1024)).toFixed(1) : 0)} MB / {(file?.size ? (file.size / (1024 * 1024)).toFixed(1) : 0)} MB</span>
                    </div>
                    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary shadow-[0_0_10px_#C8102E] transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
