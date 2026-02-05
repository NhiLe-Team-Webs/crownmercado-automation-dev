'use client';

import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB parts

interface VideoUploaderProps {
    projectId?: string;
    onUploadComplete: (videoId: string) => void;
}

export default function VideoUploader({ projectId, onUploadComplete }: VideoUploaderProps) {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState<string>('Ready to start');
    const [error, setError] = useState<string | null>(null);
    const [interruptedUploads, setInterruptedUploads] = useState<{ fingerprint: string, filename: string, progress: number }[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // UX Protection: Prevent accidental tab closure during upload
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (uploading) {
                e.preventDefault();
                e.returnValue = 'Are you sure you want to leave? Data transmission in progress.';
                return 'Are you sure you want to leave?';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [uploading]);

    // Resume Detection: Scan for interrupted uploads on mount
    useEffect(() => {
        const scanUploads = () => {
            const found: { fingerprint: string, filename: string, progress: number }[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.startsWith('upload_')) {
                    try {
                        const state = JSON.parse(localStorage.getItem(key)!);
                        if (state.parts && state.parts.length > 0) {
                            const filename = state.filename || key.replace('upload_', '').split('_')[0];
                            const totalParts = state.totalParts || 100;
                            const progress = Math.round((state.parts.length / totalParts) * 100);

                            if (progress < 100) {
                                found.push({ fingerprint: key, filename, progress });
                            }
                        }
                    } catch (e) {
                        console.error("Error parsing upload state", e);
                    }
                }
            }
            setInterruptedUploads(found);
        };
        scanUploads();
    }, [uploading]);

    const getFileFingerprint = (f: File) => {
        return `upload_${f.name}_${f.size}_${f.lastModified}`;
    };

    const saveUploadState = (fingerprint: string, state: any) => {
        localStorage.setItem(fingerprint, JSON.stringify(state));
    };

    const getUploadState = (fingerprint: string) => {
        const saved = localStorage.getItem(fingerprint);
        return saved ? JSON.parse(saved) : null;
    };

    const clearUploadState = (fingerprint: string) => {
        localStorage.removeItem(fingerprint);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            setError(null);

            const fingerprint = getFileFingerprint(selectedFile);
            const savedState = getUploadState(fingerprint);

            if (savedState) {
                const uploadedCount = savedState.parts?.length || 0;
                const totalParts = Math.ceil(selectedFile.size / CHUNK_SIZE);
                const percent = Math.round((uploadedCount / totalParts) * 100);
                setProgress(percent);
                setStatus(`Interrupted found: ${percent}% complete. Ready to resume.`);
            } else {
                setProgress(0);
                setStatus('Media source selected');
            }
        }
    };

    const uploadFile = async () => {
        if (!file) return;

        try {
            setUploading(true);
            setError(null);

            const fingerprint = getFileFingerprint(file);
            const savedState = getUploadState(fingerprint);

            let currentUploadId = savedState?.upload_id;
            let currentVideoId = savedState?.video_id;
            let alreadyUploadedParts = savedState?.parts || [];

            // 1. Initiate Upload
            if (!currentUploadId) {
                setStatus('Initiating secure pipeline...');
                const { upload_id, video_id } = await api.initiateUpload(file.name, file.type);
                currentUploadId = upload_id;
                currentVideoId = video_id;

                saveUploadState(fingerprint, {
                    upload_id: currentUploadId,
                    video_id: currentVideoId,
                    filename: file.name,
                    totalParts: Math.ceil(file.size / CHUNK_SIZE),
                    parts: []
                });
            } else {
                setStatus('Re-establishing stream connection...');
            }

            // 2. Prepare chunks
            const totalParts = Math.ceil(file.size / CHUNK_SIZE);
            const allPartNumbers = Array.from({ length: totalParts }, (_, i) => i + 1);
            const uploadedPartNumbers = new Set(alreadyUploadedParts.map((p: any) => p.PartNumber));
            const missingPartNumbers = allPartNumbers.filter(num => !uploadedPartNumbers.has(num));

            if (missingPartNumbers.length > 0) {
                const currentSessionParts = [...alreadyUploadedParts];

                for (const partNumber of missingPartNumbers) {
                    const start = (partNumber - 1) * CHUNK_SIZE;
                    const end = Math.min(start + CHUNK_SIZE, file.size);
                    const chunk = file.slice(start, end);

                    setStatus(`Deploying segment ${partNumber}/${totalParts}...`);

                    const { url } = await api.getPresignedUrl(currentVideoId, currentUploadId, partNumber);
                    const etag = await api.uploadChunk(url, chunk);

                    if (!etag) throw new Error(`Transmission failed for segment ${partNumber}`);

                    const newPart = {
                        PartNumber: partNumber,
                        ETag: etag.replace(/"/g, '')
                    };

                    currentSessionParts.push(newPart);

                    saveUploadState(fingerprint, {
                        upload_id: currentUploadId,
                        video_id: currentVideoId,
                        filename: file.name,
                        totalParts: totalParts,
                        parts: currentSessionParts
                    });

                    setProgress(Math.round((currentSessionParts.length / totalParts) * 100));
                }
                alreadyUploadedParts = currentSessionParts;
            }

            // 3. Complete Upload
            setStatus('Finalizing asset ingestion...');
            await api.completeUpload(currentVideoId, currentUploadId, alreadyUploadedParts);

            clearUploadState(fingerprint);
            setUploading(false);
            setStatus('Deployment Successful');
            setProgress(100);
            onUploadComplete(currentVideoId);

        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Transmission error detected');
            setStatus('Pipeline compromised');
            setUploading(false);
        }
    };

    return (
        <div className="glass-panel p-10 max-w-4xl mx-auto border border-white/5 shadow-2xl">
            {/* Interrupted Upload Notice */}
            {interruptedUploads.length > 0 && !uploading && !file && (
                <div className="bg-primary/5 border border-primary/20 rounded-sm p-5 mb-8 flex items-center justify-between gap-4 animate-in slide-in-from-top duration-300">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                            <span className="text-primary font-black">!</span>
                        </div>
                        <div>
                            <strong className="block text-primary text-[10px] uppercase font-black tracking-widest mb-1">
                                Interrupted sequence detected
                            </strong>
                            <p className="m-0 text-[10px] text-text-secondary uppercase tracking-tight">
                                Continue <span className="text-white font-bold">{interruptedUploads[0].filename}</span> from {interruptedUploads[0].progress}%.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            clearUploadState(interruptedUploads[0].fingerprint);
                            setInterruptedUploads([]);
                        }}
                        className="text-[9px] font-black uppercase text-text-secondary hover:text-white transition-colors"
                    >
                        Discard & Start New
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-12">
                {/* Left Side: Upload Zone */}
                <div>
                    <h2 className="text-lg font-black text-white uppercase tracking-tighter italic mb-6">
                        Media <span className="text-primary">Source</span>
                    </h2>
                    <div
                        onClick={() => !uploading && fileInputRef.current?.click()}
                        className={`card-hover relative border-2 border-dashed border-white/10 rounded-sm p-16 text-center bg-white/[0.01] transition-all cursor-pointer ${uploading ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary/40'}`}
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            className="hidden"
                            disabled={uploading}
                            accept="video/*"
                        />
                        <div className="text-5xl mb-6 opacity-20 group-hover:opacity-40 transition-opacity">🎬</div>
                        <p className="font-black text-xs text-white uppercase tracking-widest mb-2 leading-relaxed max-w-[200px] mx-auto">
                            {file ? file.name : 'Initialize stream or drop asset'}
                        </p>
                        <p className="text-[9px] font-bold text-text-secondary uppercase tracking-[0.2em]">
                            {file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : 'MP4 • MOV • AVI'}
                        </p>
                    </div>

                    <div className="mt-10">
                        <button
                            onClick={uploadFile}
                            disabled={!file || uploading}
                            className="btn-primary w-full py-4 text-[10px] italic"
                        >
                            {uploading ? 'INGESTING BYTES...' : 'Execute Deployment'}
                        </button>
                    </div>
                </div>

                {/* Right Side: Deployment Status */}
                <div className="md:border-l md:border-white/5 md:pl-12">
                    <h3 className="text-[9px] font-black text-text-secondary uppercase tracking-[0.3em] mb-8">
                        Transmission Status
                    </h3>

                    <div className="bg-black/40 rounded-sm p-6 border border-white/5 mb-8 backdrop-blur-md">
                        <div className="flex justify-between mb-4">
                            <span className="text-[10px] font-black text-text-secondary uppercase tracking-widest italic">{status}</span>
                            <span className="text-[10px] font-black text-primary tracking-widest">{progress}%</span>
                        </div>
                        <div className="progress-container h-1.5">
                            <div className="progress-fill" style={{ width: `${progress}%` }} />
                        </div>
                    </div>

                    <div className="flex flex-col gap-6">
                        <div className={`flex items-center gap-4 transition-opacity ${uploading ? 'opacity-100' : 'opacity-30'}`}>
                            <div className={`w-2 h-2 rounded-full ${uploading ? 'bg-primary animate-ping' : 'bg-white'}`} />
                            <span className="text-[10px] font-black text-white uppercase tracking-widest">Protocol Init</span>
                        </div>
                        <div className={`flex items-center gap-4 transition-opacity ${progress > 0 ? 'opacity-100' : 'opacity-30'}`}>
                            <div className={`w-2 h-2 rounded-full ${progress > 0 && progress < 100 ? 'bg-primary animate-pulse' : progress === 100 ? 'bg-primary' : 'bg-white'}`} />
                            <span className="text-[10px] font-black text-white uppercase tracking-widest">Stream Tunneling</span>
                        </div>
                        <div className={`flex items-center gap-4 transition-opacity ${progress === 100 ? 'opacity-100' : 'opacity-30'}`}>
                            <div className={`w-2 h-2 rounded-full ${progress === 100 ? 'bg-primary' : 'bg-white'}`} />
                            <span className="text-[10px] font-black text-white uppercase tracking-widest">Asset Finalization</span>
                        </div>
                    </div>

                    {error && (
                        <div className="mt-10 p-4 bg-primary/5 border-l-2 border-primary text-[10px] font-black text-white uppercase tracking-widest">
                            ERROR: <span className="text-text-secondary font-bold ml-2">{error}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
