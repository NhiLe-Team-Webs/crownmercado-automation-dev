'use client';

import React, { useState } from 'react';
import { Play, Download, Trash2, MoreVertical, FileVideo, Loader2 } from 'lucide-react';
import { Video, api } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import VideoPlayerModal from './VideoPlayerModal';

interface Props {
    video: Video;
}

export default function VideoCard({ video }: Props) {
    const [showPlayer, setShowPlayer] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const queryClient = useQueryClient();

    const deleteMutation = useMutation({
        mutationFn: api.deleteVideo,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['videos'] });
        },
    });

    const handleDownload = async () => {
        try {
            const { url } = await api.getVideoDownloadUrl(video.id, 'attachment');
            window.location.assign(url);
        } catch (error) {
            console.error('Download failed:', error);
        }
    };

    const handleDelete = async () => {
        if (confirm('Deploy destruction sequence? This data will be purged permanentely.')) {
            setIsDeleting(true);
            try {
                await deleteMutation.mutateAsync(video.id);
            } finally {
                setIsDeleting(false);
            }
        }
    };

    return (
        <>
            <div className={`group bg-surface hover:bg-surface-hover border border-white/5 rounded-sm overflow-hidden transition-all duration-300 hover:translate-y-[-4px] hover:shadow-[0_10px_40px_rgba(0,0,0,0.6)] ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}>
                {/* Thumbnail Placeholder */}
                <div className="aspect-video bg-black/40 relative flex items-center justify-center overflow-hidden border-b border-white/5">
                    <FileVideo className="w-10 h-10 text-white/5 group-hover:scale-110 group-hover:text-primary/20 transition-all duration-700" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />

                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        {video.status === 'completed' && (
                            <button
                                onClick={() => setShowPlayer(true)}
                                className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center scale-90 group-hover:scale-100 transition-transform shadow-2xl shadow-primary/40 pointer-events-auto"
                            >
                                <Play className="w-5 h-5 fill-current ml-1" />
                            </button>
                        )}
                    </div>

                    <div className="absolute bottom-3 left-3 flex items-center gap-2">
                        {video.status === 'completed' ? (
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                        ) : (
                            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(200,16,46,0.6)]" />
                        )}
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white bg-black/80 px-2 py-0.5 rounded-sm">
                            {video.status}
                        </span>
                    </div>
                </div>

                {/* Details */}
                <div className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-2">
                        <h3 className="text-xs font-black text-white uppercase tracking-tight leading-snug truncate italic" title={video.original_filename}>
                            {video.original_filename}
                        </h3>
                        <button className="p-1 hover:bg-white/10 rounded-sm transition-colors shrink-0">
                            <MoreVertical className="w-4 h-4 text-text-secondary" />
                        </button>
                    </div>

                    <div className="flex items-center gap-4 text-[9px] font-bold text-text-secondary uppercase tracking-widest mb-4">
                        <span>{new Date(video.created_at).toLocaleDateString()}</span>
                        <span className="w-1 h-1 rounded-full bg-primary/40" />
                        <span>{(video.file_size_bytes ? video.file_size_bytes / (1024 * 1024) : 0).toFixed(1)} MB</span>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                        <button
                            onClick={handleDownload}
                            className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-primary hover:text-white transition-colors"
                        >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download</span>
                        </button>
                        <button
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="p-2 hover:bg-primary/10 rounded-sm text-text-secondary hover:text-primary transition-colors disabled:opacity-50"
                        >
                            {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
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
