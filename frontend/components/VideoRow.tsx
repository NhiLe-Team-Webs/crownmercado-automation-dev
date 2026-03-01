'use client';

import React, { useState } from 'react';
import { Play, Download, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { Video, api } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import VideoPlayerModal from './VideoPlayerModal';
import Link from 'next/link';

interface Props {
    video: Video;
}

export default function VideoRow({ video }: Props) {
    const [showPlayer, setShowPlayer] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const queryClient = useQueryClient();

    const deleteMutation = useMutation({
        mutationFn: api.deleteVideo,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['videos'] });
        },
    });

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
        if (confirm(`Delete "${video.original_filename}"? This data will be purged permanentely.`)) {
            try {
                await deleteMutation.mutateAsync(video.id);
            } catch (error) {
                console.error('Delete failed:', error);
            }
        }
    };

    const isInterrupted = video.status === 'uploading';
    const isDeleting = deleteMutation.isPending;

    return (
        <>
            <div
                className={`group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden cursor-pointer ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}
                onClick={() => {
                    if (video.status === 'completed') {
                        setShowPlayer(true);
                    }
                }}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <div className="relative aspect-video bg-black overflow-hidden flex items-center justify-center">
                    {/* Mock thumbnail/video. Ideally you'd use a real thumbnail or small video clip */}
                    {video.status === 'completed' ? (
                        <div className={`w-full h-full bg-slate-800 transition-opacity duration-500 ${isHovered ? 'opacity-100' : 'opacity-80'}`} />
                    ) : (
                        <div className="w-full h-full bg-slate-900 opacity-80" />
                    )}

                    <div className="absolute inset-0 bg-black/10 opacity-100 group-hover:opacity-0 transition-opacity pointer-events-none"></div>

                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-10 h-10 bg-white/20 backdrop-blur-md border border-white/30 rounded-full flex items-center justify-center shadow-lg">
                            {isInterrupted ? (
                                <AlertCircle className="text-white fill-current w-5 h-5" />
                            ) : (
                                <Play className="text-white fill-current w-5 h-5 ml-0.5" />
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
                    <h3 className="font-bold text-gray-900 line-clamp-1 text-sm group-hover:text-blue-600 transition-colors">
                        {video.original_filename}
                    </h3>

                    <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            {new Date(video.created_at).toLocaleDateString()}
                        </span>

                        <div className="flex items-center gap-3">
                            {isInterrupted ? (
                                <Link
                                    href="/upload"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-primary hover:underline text-[11px] font-bold flex items-center gap-1 uppercase"
                                >
                                    Resume
                                </Link>
                            ) : (
                                <button
                                    onClick={handleDownload}
                                    className="text-blue-600 hover:underline text-[11px] font-bold flex items-center gap-1"
                                >
                                    <Download size={16} /> Download
                                </button>
                            )}

                            <button
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="text-red-600 hover:underline text-[11px] font-bold flex items-center gap-1 disabled:opacity-50"
                            >
                                {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Delete
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {showPlayer && (
                <VideoPlayerModal
                    videoId={video.id}
                    filename={video.original_filename}
                    onClose={() => setShowPlayer(false)}
                />
            )}
        </>
    );
}
