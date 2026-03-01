'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api, Video } from '@/lib/api';

interface Props {
    video: Video;
    onClose: () => void;
}

export default function VideoPlayerModal({ video, onClose }: Props) {
    const [url, setUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const fetchUrl = async () => {
            try {
                const data = await api.getVideoDownloadUrl(video.id);
                setUrl(data.url);
            } catch (err) {
                console.error('Video Load Error:', err);
                setError('Failed to load media stream');
            } finally {
                setLoading(false);
            }
        };
        fetchUrl();

        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, [video.id]);

    if (!mounted) return null;

    const formatSize = (bytes?: number) => {
        if (!bytes) return '0 MB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const modalContent = (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#111] rounded-3xl overflow-hidden shadow-2xl w-full max-w-4xl relative border border-transparent dark:border-white/10">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/20 dark:bg-black/40 hover:bg-white/40 dark:hover:bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-all"
                >
                    <span className="material-symbols-outlined">close</span>
                </button>
                <div className="aspect-video bg-black flex items-center justify-center">
                    {loading ? (
                        <span className="material-symbols-outlined animate-spin text-white/50 text-4xl">sync</span>
                    ) : error ? (
                        <div className="text-white text-center">
                            <span className="material-symbols-outlined text-[var(--color-error)] text-4xl mb-2">error</span>
                            <p className="text-sm font-bold">{error}</p>
                        </div>
                    ) : url ? (
                        <video
                            src={url}
                            controls
                            autoPlay
                            className="w-full h-full object-contain"
                        />
                    ) : null}
                </div>
                <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white truncate">{video.original_filename}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Size: {formatSize(video.file_size_bytes)} • Last Modified: {new Date(video.created_at).toLocaleString()}
                    </p>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
