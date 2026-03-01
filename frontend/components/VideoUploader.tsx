'use client';

import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB parts

interface VideoUploaderProps {
    projectId?: string;
    onUploadComplete: (videoId: string) => void;
    onClose?: () => void;
}

export default function VideoUploader({ onUploadComplete, onClose }: VideoUploaderProps) {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState<string>('UPLOADING');
    const [error, setError] = useState<string | null>(null);
    const [completedVideoId, setCompletedVideoId] = useState<string | null>(null);
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const getFileFingerprint = (f: File) => `upload_${f.name}_${f.size}_${f.lastModified}`;

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

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement> | { target: { files: FileList | null } }) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            if (selectedFile.size > 2 * 1024 * 1024 * 1024) {
                setError("File too large. Maximum size is 2GB");
                return;
            }
            setFile(selectedFile);
            setError(null);
            setProgress(0);
            setStatus('UPLOADING');
            setCompletedVideoId(null);
            setDownloadUrl(null);
        }
    };

    const cancelUpload = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setStatus('CANCELED');
            setUploading(false);
            if (file) {
                localStorage.removeItem(getFileFingerprint(file));
            }
        }
    };

    const startUpload = async () => {
        if (!file) return;
        const fingerprint = getFileFingerprint(file);

        try {
            setUploading(true);
            setError(null);
            abortControllerRef.current = new AbortController();

            const storedState = localStorage.getItem(fingerprint);
            let upload_id: string;
            let video_id: string;
            let uploadedParts: { PartNumber: number, ETag: string }[] = [];

            if (storedState) {
                const state = JSON.parse(storedState);
                upload_id = state.upload_id;
                video_id = state.video_id;
                uploadedParts = state.uploadedParts || [];
                setStatus('RESUMING');
            } else {
                setStatus('UPLOADING');
                const result = await api.initiateUpload(file.name, file.type);
                upload_id = result.upload_id;
                video_id = result.video_id;
            }

            const totalParts = Math.ceil(file.size / CHUNK_SIZE);
            const uploadedPartNumbers = new Set(uploadedParts.map(p => p.PartNumber));

            for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
                if (abortControllerRef.current.signal.aborted) return;

                if (uploadedPartNumbers.has(partNumber)) {
                    setProgress(Math.round((partNumber / totalParts) * 100));
                    continue;
                }

                const start = (partNumber - 1) * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, file.size);
                const chunk = file.slice(start, end);

                setStatus('UPLOADING');
                const { url } = await api.getPresignedUrl(video_id, upload_id, partNumber);
                const etag = await api.uploadChunk(url, chunk);
                if (!etag) throw new Error(`Transmission failed for segment ${partNumber}: ETag missing`);

                uploadedParts.push({ PartNumber: partNumber, ETag: etag.replace(/"/g, '') });
                uploadedPartNumbers.add(partNumber);

                localStorage.setItem(fingerprint, JSON.stringify({ upload_id, video_id, uploadedParts }));
                setProgress(Math.round((partNumber / totalParts) * 100));
            }

            setStatus('PROCESSING');
            await api.completeUpload(video_id, upload_id, uploadedParts);

            localStorage.removeItem(fingerprint);

            try {
                const { url: dUrl } = await api.getVideoDownloadUrl(video_id, 'attachment');
                setDownloadUrl(dUrl);
            } catch (e) {
                // Ignore missing URL at this stage
            }

            setUploading(false);
            setCompletedVideoId(video_id);
            onUploadComplete(video_id);

        } catch (err: unknown) {
            if (err instanceof Error && err.name === 'AbortError') return;
            setError(err instanceof Error ? err.message : 'Transmission failed');
            setUploading(false);
        } finally {
            abortControllerRef.current = null;
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        if (!uploading) setIsDragOver(true);
    };
    const handleDragLeave = () => setIsDragOver(false);
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        if (uploading) return;
        if (e.dataTransfer.files.length) {
            handleFileChange({ target: { files: e.dataTransfer.files } });
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    return (
        <div className="w-full max-w-[800px] flex flex-col items-center gap-6">
            <div
                className={`relative w-full rounded-2xl overflow-hidden bg-[#F1F1F1] dark:bg-[#111] border border-gray-200 dark:border-white/10 transition-all duration-300 ${isDragOver ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''} ${file && !uploading && !completedVideoId ? 'ring-2 ring-blue-500' : ''}`}
                style={{ aspectRatio: '16/9' }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {/* Select File Layer */}
                <div className={`absolute inset-0 flex flex-col items-center justify-center text-gray-700 bg-[#F9F9F9] dark:bg-black z-10 transition-opacity duration-300 ${file ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                    <div className="w-20 h-20 bg-white dark:bg-[#222] rounded-full flex items-center justify-center mb-6 shadow-sm border border-gray-100 dark:border-white/10 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                        <span className="material-symbols-outlined text-4xl text-gray-400">upload</span>
                    </div>
                    <p className="text-xl font-medium text-gray-900 dark:text-white">Select file to upload</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Supported: MP4, MOV, AVI, MKV (max 2GB)</p>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-8 px-8 py-2.5 bg-[var(--color-action)] text-white font-bold rounded-full uppercase tracking-wide text-xs shadow-md active:scale-95 transition-all"
                    >
                        Select File
                    </button>
                    <input type="file" ref={fileInputRef} accept="video/mp4,video/quicktime,video/x-msvideo,video/x-matroska,video/*" className="hidden" onChange={handleFileChange} />
                </div>

                {/* Preview Video */}
                {file && (
                    <video
                        src={URL.createObjectURL(file)}
                        playsInline
                        controls
                        className="absolute inset-0 z-20 w-full h-full object-contain bg-black"
                    />
                )}

                {/* Progress Overlay */}
                <div className={`absolute inset-0 z-40 bg-white/95 dark:bg-black/95 flex flex-col items-center justify-center transition-opacity duration-500 ${uploading ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                    <div className="w-80 flex flex-col gap-6 text-center">
                        <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${progress}%` }}></div>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{progress}%</p>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{status}</h3>
                        </div>
                        <button onClick={cancelUpload} className="text-sm text-gray-500 hover:text-red-600 dark:hover:text-red-400 underline transition-colors">
                            Cancel Processing
                        </button>
                    </div>
                </div>

                {/* Error Overlay */}
                <div className={`absolute inset-0 z-50 bg-white/95 dark:bg-black/95 flex flex-col items-center justify-center transition-opacity duration-500 ${error ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                    <div className="w-80 flex flex-col gap-4 text-center">
                        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto">
                            <span className="material-symbols-outlined text-3xl text-red-600 dark:text-red-400">error</span>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Something went wrong</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{error}</p>
                        <button
                            onClick={() => setError(null)}
                            className="h-11 bg-black dark:bg-white text-white dark:text-black font-bold rounded-full hover:bg-gray-800 dark:hover:bg-gray-200 transition-all px-8"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            </div>

            {/* Action Area */}
            {file && !completedVideoId && !uploading && !error && (
                <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
                    <button
                        onClick={startUpload}
                        className="px-12 h-14 bg-black dark:bg-white text-white dark:text-black font-bold rounded-full shadow-2xl hover:bg-gray-800 dark:hover:bg-gray-200 active:scale-[0.98] transition-all flex items-center justify-center gap-3 tracking-wider"
                    >
                        <span className="material-symbols-outlined text-2xl animate-spin" style={status === 'UPLOADING' ? {} : { animation: 'none' }}>
                            auto_awesome
                        </span>
                        <span>START PROCESSING</span>
                    </button>

                    <div className="flex items-center gap-2 px-4 py-1.5 bg-gray-100 dark:bg-[#222] rounded-full border border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400">
                        <span className="material-symbols-outlined text-sm">movie</span>
                        <span className="text-[11px] font-bold truncate max-w-[150px] text-gray-900 dark:text-gray-200">{file.name}</span>
                        <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                        <span className="text-[11px] font-bold">{formatFileSize(file.size)}</span>
                        <button onClick={() => fileInputRef.current?.click()} className="ml-1 text-gray-400 hover:text-blue-600 transition-colors">
                            <span className="material-symbols-outlined text-sm">sync</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Success Actions */}
            {completedVideoId && (
                <div className="flex flex-col items-center gap-4 animate-in slide-in-from-bottom-2 duration-500">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => {
                                if (downloadUrl) window.location.assign(downloadUrl);
                            }}
                            className="h-11 px-8 bg-[var(--color-action)] text-white font-bold text-sm rounded-full shadow-lg hover:bg-blue-700 transition-all flex items-center gap-2 uppercase tracking-wider"
                        >
                            <span className="material-symbols-outlined text-lg">download</span> Download Video
                        </button>
                        <button
                            onClick={() => {
                                setFile(null);
                                setCompletedVideoId(null);
                                setProgress(0);
                            }}
                            className="h-11 px-6 border border-gray-300 dark:border-white/20 text-gray-700 dark:text-gray-300 font-bold text-sm rounded-full hover:bg-gray-100 dark:hover:bg-white/10 uppercase tracking-wider transition-all"
                        >
                            Try Another
                        </button>
                    </div>
                    <div className="flex items-center gap-2 py-1.5 px-4 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-full border border-green-100 dark:border-green-500/20">
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        <span className="text-xs font-bold">{file?.name}</span>
                    </div>
                </div>
            )}
        </div>
    );
}

