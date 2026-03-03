'use client';

import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB parts
const MAX_TOTAL_BYTES = 2 * 1024 * 1024 * 1024; // 2GB total

interface VideoUploaderProps {
    projectId?: string;
    onUploadComplete: (videoId: string) => void;
    onBatchComplete?: (videoIds: string[]) => void;
    onClose?: () => void;
}

export default function VideoUploader({ onUploadComplete, onBatchComplete, onClose }: VideoUploaderProps) {
    const [files, setFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState<string>('UPLOADING');
    const [currentFileIndex, setCurrentFileIndex] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [completedVideoIds, setCompletedVideoIds] = useState<string[]>([]);
    const [downloadUrls, setDownloadUrls] = useState<Record<string, string>>({});
    const [isDragOver, setIsDragOver] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const getFileFingerprint = (f: File) => `upload_${f.name}_${f.size}_${f.lastModified}`;

    const formatFileSize = (bytes: number) => {
        if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

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
        const fileList = e.target.files;
        if (!fileList || fileList.length === 0) return;

        const selectedFiles = Array.from(fileList);
        const totalBytes = selectedFiles.reduce((sum, f) => sum + f.size, 0);

        if (totalBytes > MAX_TOTAL_BYTES) {
            setError(`Tổng dung lượng tối đa 2GB. Hiện tại: ${formatFileSize(totalBytes)}`);
            return;
        }

        setFiles(selectedFiles);
        setError(null);
        setProgress(0);
        setStatus('UPLOADING');
        setCompletedVideoIds([]);
        setDownloadUrls({});
    };

    const cancelUpload = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setStatus('CANCELED');
            setUploading(false);
            files.forEach((f) => localStorage.removeItem(getFileFingerprint(f)));
        }
    };

    const uploadSingleFile = async (file: File): Promise<string> => {
        const fingerprint = getFileFingerprint(file);

        const storedState = localStorage.getItem(fingerprint);
        let upload_id: string;
        let video_id: string;
        let uploadedParts: { PartNumber: number; ETag: string }[] = [];

        if (storedState) {
            const state = JSON.parse(storedState);
            upload_id = state.upload_id;
            video_id = state.video_id;
            uploadedParts = state.uploadedParts || [];
        } else {
            const result = await api.initiateUpload(file.name, file.type);
            upload_id = result.upload_id;
            video_id = result.video_id;
        }

        const totalParts = Math.ceil(file.size / CHUNK_SIZE);
        const uploadedPartNumbers = new Set(uploadedParts.map((p) => p.PartNumber));

        for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
            if (abortControllerRef.current?.signal.aborted) throw new DOMException('Aborted', 'AbortError');

            if (uploadedPartNumbers.has(partNumber)) continue;

            const start = (partNumber - 1) * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, file.size);
            const chunk = file.slice(start, end);

            const { url } = await api.getPresignedUrl(video_id, upload_id, partNumber);
            const etag = await api.uploadChunk(url, chunk);
            if (!etag) throw new Error(`Transmission failed for segment ${partNumber}: ETag missing`);

            uploadedParts.push({ PartNumber: partNumber, ETag: etag.replace(/"/g, '') });
            uploadedPartNumbers.add(partNumber);
            localStorage.setItem(fingerprint, JSON.stringify({ upload_id, video_id, uploadedParts }));
        }

        setStatus('PROCESSING');
        await api.completeUpload(video_id, upload_id, uploadedParts);
        localStorage.removeItem(fingerprint);

        return video_id;
    };

    const startUpload = async () => {
        if (files.length === 0) return;

        try {
            setUploading(true);
            setError(null);
            abortControllerRef.current = new AbortController();

            const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
            let uploadedSoFar = 0;
            const videoIds: string[] = [];

            for (let i = 0; i < files.length; i++) {
                if (abortControllerRef.current?.signal.aborted) return;

                const file = files[i];
                setCurrentFileIndex(i);
                setStatus(i === 0 && uploadedSoFar === 0 ? 'UPLOADING' : `Uploading ${file.name}...`);

                const video_id = await uploadSingleFile(file);
                videoIds.push(video_id);
                setCompletedVideoIds((prev) => [...prev, video_id]);
                onUploadComplete(video_id);

                uploadedSoFar += file.size;
                setProgress(Math.round((uploadedSoFar / totalBytes) * 100));

                try {
                    const { url: dUrl } = await api.getVideoDownloadUrl(video_id, 'attachment');
                    setDownloadUrls((prev) => ({ ...prev, [video_id]: dUrl }));
                } catch {
                    // Ignore
                }
            }

            setUploading(false);
            onBatchComplete?.(videoIds);
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

    const hasFiles = files.length > 0;
    const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
    const allCompleted = completedVideoIds.length > 0 && completedVideoIds.length === files.length;

    return (
        <div className="w-full max-w-[800px] flex flex-col items-center gap-6">
            <div
                className={`relative w-full rounded-2xl overflow-hidden bg-[#F1F1F1] dark:bg-[#111] border border-gray-200 dark:border-white/10 transition-all duration-300 ${isDragOver ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''} ${hasFiles && !uploading && !allCompleted ? 'ring-2 ring-blue-500' : ''}`}
                style={{ aspectRatio: '16/9' }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {/* Select File Layer */}
                <div className={`absolute inset-0 flex flex-col items-center justify-center text-gray-700 bg-[#F9F9F9] dark:bg-black z-10 transition-opacity duration-300 ${hasFiles ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                    <div className="w-20 h-20 bg-white dark:bg-[#222] rounded-full flex items-center justify-center mb-6 shadow-sm border border-gray-100 dark:border-white/10 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                        <span className="material-symbols-outlined text-4xl text-gray-400">upload</span>
                    </div>
                    <p className="text-xl font-medium text-gray-900 dark:text-white">Select files to upload</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Supported: MP4, MOV, AVI, MKV (max 2GB total)</p>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-8 px-8 py-2.5 bg-[var(--color-action)] text-white font-bold rounded-full uppercase tracking-wide text-xs shadow-md active:scale-95 transition-all"
                    >
                        Select Files
                    </button>
                    <input type="file" ref={fileInputRef} accept="video/mp4,video/quicktime,video/x-msvideo,video/x-matroska,video/*" multiple className="hidden" onChange={handleFileChange} />
                </div>

                {/* Preview Video (first file) */}
                {hasFiles && files[0] && (
                    <video
                        src={URL.createObjectURL(files[0])}
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
                            {files.length > 1 && <p className="text-sm text-gray-500 mt-1">File {currentFileIndex + 1} of {files.length}</p>}
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

            {/* File List (when files selected) */}
            {hasFiles && (
                <div className="w-full flex flex-col gap-2">
                    {files.map((f, idx) => (
                        <div
                            key={`${f.name}-${f.size}-${idx}`}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-[#222] rounded-lg border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300"
                        >
                            <span className="text-xs font-medium text-gray-500">#{idx + 1}</span>
                            <span className="material-symbols-outlined text-sm text-gray-400">movie</span>
                            <span className="text-sm font-medium truncate flex-1">{f.name}</span>
                            <span className="text-xs text-gray-500">{formatFileSize(f.size)}</span>
                            {idx < completedVideoIds.length && (
                                <span className="material-symbols-outlined text-green-600 text-sm">check_circle</span>
                            )}
                        </div>
                    ))}
                    <p className="text-xs text-gray-500">Total: {formatFileSize(totalBytes)}</p>
                </div>
            )}

            {/* Action Area */}
            {hasFiles && !allCompleted && !uploading && !error && (
                <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
                    <button
                        onClick={startUpload}
                        className="px-12 h-14 bg-black dark:bg-white text-white dark:text-black font-bold rounded-full shadow-2xl hover:bg-gray-800 dark:hover:bg-gray-200 active:scale-[0.98] transition-all flex items-center justify-center gap-3 tracking-wider"
                    >
                        <span className="material-symbols-outlined text-2xl" style={uploading ? { animation: 'spin 1s linear infinite' } : {}}>
                            auto_awesome
                        </span>
                        <span>START PROCESSING</span>
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="text-sm text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 underline transition-colors">
                        Change files
                    </button>
                </div>
            )}

            {/* Success Actions */}
            {allCompleted && completedVideoIds.length > 0 && (
                <div className="flex flex-col items-center gap-4 animate-in slide-in-from-bottom-2 duration-500 w-full">
                    <div className="flex flex-wrap gap-2 justify-center">
                        {completedVideoIds.map((videoId, idx) => (
                            <button
                                key={videoId}
                                onClick={() => {
                                    const url = downloadUrls[videoId];
                                    if (url) window.location.assign(url);
                                }}
                                className="h-11 px-6 bg-[var(--color-action)] text-white font-bold text-sm rounded-full shadow-lg hover:bg-blue-700 transition-all flex items-center gap-2 uppercase tracking-wider"
                            >
                                <span className="material-symbols-outlined text-lg">download</span>
                                {files[idx]?.name ?? `Video ${idx + 1}`}
                            </button>
                        ))}
                        <button
                            onClick={() => {
                                setFiles([]);
                                setCompletedVideoIds([]);
                                setDownloadUrls({});
                                setProgress(0);
                                if (fileInputRef.current) fileInputRef.current.value = '';
                            }}
                            className="h-11 px-6 border border-gray-300 dark:border-white/20 text-gray-700 dark:text-gray-300 font-bold text-sm rounded-full hover:bg-gray-100 dark:hover:bg-white/10 uppercase tracking-wider transition-all"
                        >
                            Try Another
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2 py-1.5 px-4 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-full border border-green-100 dark:border-green-500/20">
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        <span className="text-xs font-bold">{completedVideoIds.length} file(s) uploaded</span>
                    </div>
                </div>
            )}
        </div>
    );
}
