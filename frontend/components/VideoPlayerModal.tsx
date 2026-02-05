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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 md:p-12 animate-in fade-in duration-300">
            <div className="relative w-full max-w-6xl aspect-video bg-surface rounded-sm border border-white/10 shadow-[0_50px_100px_rgba(0,0,0,0.9)] overflow-hidden group">
                {/* Header Controls */}
                <div className="absolute top-0 inset-x-0 p-6 flex items-start justify-between bg-gradient-to-b from-black/80 to-transparent z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                            <h3 className="text-sm font-black text-white uppercase italic tracking-widest">{filename}</h3>
                            <span className="text-[9px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-sm border border-primary/20">LIVE PLAYER</span>
                        </div>
                        <div className="flex items-center gap-4">
                            {url && (
                                <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[9px] text-text-secondary hover:text-primary transition-colors flex items-center gap-1.5 uppercase tracking-widest"
                                >
                                    <Info className="w-3 h-3" />
                                    Debug: Raw Access Stream
                                </a>
                            )}
                            <div className="flex items-center gap-2 px-2 py-0.5 bg-black/40 rounded-sm border border-white/5">
                                <span className="text-[7px] font-black text-white uppercase italic tracking-widest">Studio 1.0 Runtime</span>
                                <div className="w-1 h-1 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,1)] animate-pulse" />
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {url && !loading && !error && (
                            <div className="flex items-center gap-2">
                                <button className="p-2 bg-white/5 hover:bg-white/10 rounded-sm text-white transition-all" onClick={() => window.location.assign(url!)}>
                                    <Download className="w-4 h-4" />
                                </button>
                                <button className="p-2 bg-white/5 hover:bg-white/10 rounded-sm text-white transition-all">
                                    <Maximize2 className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 bg-white/5 hover:bg-primary transition-all rounded-sm text-white group/close"
                        >
                            <X className="w-5 h-5 group-hover/close:rotate-90 transition-transform" />
                        </button>
                    </div>
                </div>

                {/* Main Player Area */}
                <div className="absolute inset-0 flex items-center justify-center bg-black">
                    {loading ? (
                        <div className="flex flex-col items-center gap-4">
                            <Loader2 className="w-12 h-12 text-primary animate-spin" />
                            <p className="text-[10px] font-black text-text-secondary uppercase tracking-[0.3em] animate-pulse">Establishing Secure Stream...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center gap-6 text-center px-10 max-w-md">
                            <div className="p-4 rounded-full bg-error/10 border border-error/20">
                                <AlertCircle className="w-10 h-10 text-error" />
                            </div>
                            <div>
                                <h4 className="text-lg font-black text-white uppercase italic mb-2">Transmission Terminated</h4>
                                <p className="text-[11px] text-text-secondary font-bold uppercase tracking-tight leading-relaxed">
                                    The stream could not be established. This may be due to a CORS violation or an invalid media payload in the vault.
                                </p>
                            </div>
                            <div className="flex gap-4">
                                <button
                                    onClick={onClose}
                                    className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-sm text-[10px] font-black uppercase tracking-widest transition-all"
                                >
                                    Dismiss
                                </button>
                                {url && (
                                    <a
                                        href={url}
                                        download
                                        className="px-6 py-3 bg-primary hover:bg-primary-hover text-white rounded-sm text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-primary/20 italic"
                                    >
                                        Attempt Direct Download
                                    </a>
                                )}
                            </div>
                        </div>
                    ) : url ? (
                        <video
                            id="studio-player"
                            key={url}
                            src={url}
                            controls
                            autoPlay
                            playsInline
                            preload="auto"
                            className="w-full h-full object-contain"
                            onError={(e) => {
                                const videoElement = e.currentTarget;
                                const videoError = videoElement.error;
                                console.error('HTML5 Video Error Details:', {
                                    code: videoError?.code,
                                    message: videoError?.message,
                                    src: videoElement.src,
                                    networkState: videoElement.networkState,
                                    readyState: videoElement.readyState
                                });

                                let msg = 'Media protocol failed: Resource has invalid or inaccessible content.';
                                if (videoError?.code === 1) msg = 'Playback aborted by user.';
                                if (videoError?.code === 2) msg = 'Network error during transmission.';
                                if (videoError?.code === 3) msg = 'Resource decoding failed (Corrupted file or Unsupported format).';
                                if (videoError?.code === 4) msg = 'Source not supported or access denied (CORS).';

                                setError(msg);
                            }}
                        />
                    ) : null}
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
