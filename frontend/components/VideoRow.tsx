'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Video, api } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import VideoPlayerModal from './VideoPlayerModal';
import Link from 'next/link';

interface Props {
    video: Video;
}

export default function VideoRow({ video }: Props) {
    const [showPlayer, setShowPlayer] = useState(false);
    const [videoUrl, setVideoUrl] = useState<string>('');
    const videoRef = useRef<HTMLVideoElement>(null);
    const queryClient = useQueryClient();

    const deleteMutation = useMutation({
        mutationFn: api.deleteVideo,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['videos'] });
        },
    });

    useEffect(() => {
        if (video.status === 'completed') {
            api.getVideoDownloadUrl(video.id, 'inline')
                .then(res => setVideoUrl(res.url))
                .catch(err => console.error('Failed to get video url:', err));
        }
    }, [video.id, video.status]);

    const handleDownload = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const { url } = await api.getVideoDownloadUrl(video.id, 'attachment');
            window.location.assign(url);
        } catch (error) {
            console.error('Download failed:', error);
        }
    };

    const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm(`Delete "${video.original_filename}"? This cannot be undone.`)) {
            try {
                await deleteMutation.mutateAsync(video.id);
            } catch (error) {
                console.error('Delete failed:', error);
            }
        }
    };

    const handleMouseEnter = () => {
        if (videoRef.current) {
            videoRef.current.play().catch(() => { });
        }
    };

    const handleMouseLeave = () => {
        if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
        }
    };

    const isInterrupted = video.status === 'uploading';
    const isDeleting = deleteMutation.isPending;

    const formatSize = (bytes?: number) => {
        if (!bytes) return '0 MB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    return (
        <>
            <div
                className={`group bg-white dark:bg-[#111] rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden cursor-pointer ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}
                onClick={() => {
                    if (video.status === 'completed') {
                        setShowPlayer(true);
                    }
                }}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                <div className="relative aspect-video bg-black overflow-hidden flex items-center justify-center">
                    {/* Real Video Preview */}
                    {video.status === 'completed' && videoUrl ? (
                        <video
                            ref={videoRef}
                            src={`${videoUrl}#t=0.1`}
                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500"
                            muted
                            playsInline
                            loop
                        />
                    ) : (
                        <div className="w-full h-full bg-slate-900 opacity-80" />
                    )}

                    <div className="absolute inset-0 bg-black/10 opacity-100 group-hover:opacity-0 transition-opacity pointer-events-none"></div>

                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-10 h-10 bg-white/20 dark:bg-black/40 backdrop-blur-md border border-white/30 dark:border-white/10 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-110">
                            {isInterrupted ? (
                                <span className="material-symbols-outlined text-white text-[20px]">error</span>
                            ) : (
                                <span className="material-symbols-outlined text-white fill-1 text-[20px] ml-0.5">play_arrow</span>
                            )}
                        </div>
                    </div>

                    {!isInterrupted && (
                        <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/80 text-[10px] font-bold text-white rounded-lg">PREVIEW</div>
                    )}
                    {isInterrupted && (
                        <div className="absolute bottom-3 right-3 px-2 py-1 bg-red-600/90 text-[10px] font-bold text-white rounded-lg uppercase">Interrupted</div>
                    )}
                </div>

                <div className="p-4 flex flex-col gap-1">
                    <h3 className="font-bold text-gray-900 dark:text-gray-100 line-clamp-1 text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {video.original_filename}
                    </h3>

                    <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                            {formatSize(video.file_size_bytes)}
                        </span>

                        <div className="flex items-center gap-3">
                            {isInterrupted ? (
                                <Link
                                    href="/upload"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-[var(--color-action)] dark:text-blue-400 hover:underline text-[11px] font-bold flex items-center gap-1 uppercase"
                                >
                                    Resume
                                </Link>
                            ) : (
                                <button
                                    onClick={handleDownload}
                                    className="text-[var(--color-action)] dark:text-blue-400 hover:underline text-[11px] font-bold flex items-center gap-1"
                                >
                                    <span className="material-symbols-outlined text-[16px]">download</span> Download
                                </button>
                            )}

                            <button
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="text-[var(--color-error)] dark:text-red-400 hover:underline text-[11px] font-bold flex items-center gap-1 disabled:opacity-50"
                            >
                                {isDeleting ? (
                                    <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                                ) : (
                                    <span className="material-symbols-outlined text-[16px]">delete</span>
                                )} Delete
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {showPlayer && (
                <VideoPlayerModal
                    video={video}
                    onClose={() => setShowPlayer(false)}
                />
            )}
        </>
    );
}


