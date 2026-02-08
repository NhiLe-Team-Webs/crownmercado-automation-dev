'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Maximize2, Download, AlertCircle, Loader2, Info } from 'lucide-react';
import { api } from '@/lib/api';

interface Props {
    videoId: string;
    filename: string;
    onClose: () => void;
}

export default function VideoPlayerModal({ videoId, filename, onClose }: Props) {
    const [url, setUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const fetchUrl = async () => {
            try {
                const data = await api.getVideoDownloadUrl(videoId);
                setUrl(data.url);
            } catch (err) {
                console.error('Video Load Error:', err);
                setError('Failed to load media stream from vault');
            } finally {
                setLoading(false);
            }
        };
        fetchUrl();

        // Prevent scrolling on body when modal is open
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, [videoId]);

    if (!mounted) return null;

    const modalContent = (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black animate-in fade-in duration-300">
            <button
                onClick={onClose}
                className="absolute top-6 right-6 z-50 p-2 text-white/50 hover:text-white transition-colors"
                title="Close"
            >
                <X size={32} />
            </button>

            <div className="w-full h-full flex items-center justify-center p-4">
                {loading ? (
                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                ) : error ? (
                    <div className="text-white text-center p-8">
                        <p className="text-lg font-bold mb-4">{error}</p>
                        <button onClick={onClose} className="px-6 py-2 bg-primary rounded-lg font-bold">Close Player</button>
                    </div>
                ) : url ? (
                    <video
                        src={url}
                        controls
                        autoPlay
                        className="max-w-full max-h-full shadow-2xl"
                    />
                ) : null}
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
