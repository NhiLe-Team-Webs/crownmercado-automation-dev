'use client';

import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { Upload, AlertCircle, Sparkles, Download, CheckCircle, RefreshCw } from 'lucide-react';
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
            let uploadedParts: any[] = [];

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

            // Note: Since this refactor relies purely on chunked upload success without SSE, 
            // we simulate a backend completion here for the upload stage.
            localStorage.removeItem(fingerprint);

            // Get download URL immediately
            try {
                const { url: dUrl } = await api.getVideoDownloadUrl(video_id, 'attachment');
                setDownloadUrl(dUrl);
            } catch (e) {
                // If it's not ready yet
            }

            setUploading(false);
            setCompletedVideoId(video_id);
            onUploadComplete(video_id);

        } catch (err: any) {
            if (err.name === 'AbortError') return;
            setError(err.message || 'Transmission failed');
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
                className={`relative w-full rounded-2xl overflow-hidden bg-[#F1F1F1] border border-gray-200 transition-all duration-300 ${isDragOver ? 'ring-2 ring-blue-500 bg-blue-50' : ''} ${file && !uploading && !completedVideoId ? 'ring-2 ring-blue-500' : ''}`}
                style={{ aspectRatio: '16/9' }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {/* Select File Layer */}
                <div className={`absolute inset-0 flex flex-col items-center justify-center text-gray-700 bg-[#F9F9F9] z-10 transition-opacity duration-300 ${file ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                    <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm border border-gray-100 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="w-10 h-10 text-gray-400" />
                    </div>
                    <p className="text-xl font-medium text-gray-900">Select file to upload</p>
                    <p className="text-sm text-gray-500 mt-2">Supported: MP4, MOV, AVI, MKV (max 2GB)</p>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-8 px-8 py-2.5 bg-[#065FD4] text-white font-bold rounded-full uppercase tracking-wide text-xs shadow-md active:scale-95 transition-all"
                    >
                        Select File
                    </button>
                    <input type="file" ref={fileInputRef} accept="video/*" className="hidden" onChange={handleFileChange} />
                </div>

                {/* Preview Video */}
                {file && (
                    <video
                        src={URL.createObjectURL(file)}
                        playsInline
                        controls
                        className={`w-full h-full object-contain bg-black ${completedVideoId ? 'block' : 'hidden'}`}
                    />
                )}

                {/* Progress Overlay */}
                <div className={`absolute inset-0 z-40 bg-white/95 flex flex-col items-center justify-center transition-opacity duration-500 ${uploading ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                    <div className="w-80 flex flex-col gap-6 text-center">
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${progress}%` }}></div>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{progress}%</p>
                            <h3 className="text-lg font-bold text-gray-900">{status}...</h3>
                        </div>
                        <button onClick={cancelUpload} className="text-sm text-gray-500 hover:text-red-600 underline transition-colors">
                            Cancel Processing
                        </button>
                    </div>
                </div>

                {/* Error Overlay */}
                <div className={`absolute inset-0 z-50 bg-white/95 flex flex-col items-center justify-center transition-opacity duration-500 ${error ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                    <div className="w-80 flex flex-col gap-4 text-center">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                            <AlertCircle className="text-red-600 w-8 h-8" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">Something went wrong</h3>
                        <p className="text-sm text-gray-500">{error}</p>
                        <button
                            onClick={() => setError(null)}
                            className="h-11 bg-black text-white font-bold rounded-full hover:bg-gray-800 transition-all px-8"
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
                        className="px-12 h-14 bg-black text-white font-bold rounded-full shadow-2xl hover:bg-gray-800 active:scale-[0.98] transition-all flex items-center justify-center gap-3 tracking-wider"
                    >
                        <Sparkles className="w-6 h-6" />
                        <span>START PROCESSING</span>
                    </button>

                    <div className="flex items-center gap-2 px-4 py-1.5 bg-gray-100 rounded-full border border-gray-200 text-gray-500">
                        <span className="text-[11px] font-bold truncate max-w-[150px] text-gray-900">{file.name}</span>
                        <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                        <span className="text-[11px] font-bold">{formatFileSize(file.size)}</span>
                        <button onClick={() => fileInputRef.current?.click()} className="ml-1 text-gray-400 hover:text-blue-600 transition-colors">
                            <RefreshCw className="w-4 h-4" />
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
                            className="h-11 px-8 bg-[#065FD4] text-white font-bold text-sm rounded-full shadow-lg hover:bg-blue-700 transition-all flex items-center gap-2 uppercase tracking-wider"
                        >
                            <Download className="w-5 h-5" /> Download Video
                        </button>
                        <button
                            onClick={() => {
                                setFile(null);
                                setCompletedVideoId(null);
                                setProgress(0);
                            }}
                            className="h-11 px-6 border border-gray-300 text-gray-700 font-bold text-sm rounded-full hover:bg-gray-100 uppercase tracking-wider transition-all"
                        >
                            Try Another
                        </button>
                    </div>
                    <div className="flex items-center gap-2 py-1.5 px-4 bg-green-50 text-green-700 rounded-full border border-green-100">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-xs font-bold">{file?.name}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
