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
            <div className={`group bg-surface/30 backdrop-blur-3xl border border-white/5 rounded-[2rem] overflow-hidden transition-all duration-700 hover:scale-[1.02] hover:shadow-[0_40px_80px_rgba(0,0,0,0.8)] relative h-full flex flex-col ${isDeleting ? 'opacity-30 pointer-events-none' : ''}`}>

                {/* Thumbnail Layer */}
                <div className="aspect-video bg-black/40 relative flex items-center justify-center overflow-hidden">
                    <FileVideo className="w-12 h-12 text-white/5 group-hover:scale-110 group-hover:text-primary/20 transition-all duration-1000" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />

                    {/* Active Overlay */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-center justify-center bg-primary/10 backdrop-blur-[4px]">
                        {video.status === 'completed' && (
                            <button
                                onClick={() => setShowPlayer(true)}
                                className="w-16 h-16 rounded-2xl bg-primary text-white flex items-center justify-center scale-75 group-hover:scale-100 transition-all duration-500 shadow-2xl shadow-primary/50 pointer-events-auto transform hover:rotate-6 active:scale-90"
                            >
                                <Play className="w-6 h-6 fill-current ml-1" />
                            </button>
                        )}
                    </div>

                    {/* Status Badge */}
                    <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 group-hover:border-primary/40 transition-colors duration-500">
                        {video.status === 'completed' ? (
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,1)] animate-pulse" />
                        ) : (
                            <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_10px_rgba(200,16,46,1)] animate-[ping_1.5s_infinite]" />
                        )}
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white italic">
                            {video.status}
                        </span>
                    </div>

                    {/* Corner Tag */}
                    <div className="absolute bottom-4 right-4 text-[9px] font-black text-white/40 uppercase tracking-widest border border-white/5 px-2 py-0.5 rounded-md">
                        SRV-X1
                    </div>
                </div>

                {/* Details Container */}
                <div className="p-8 flex-1 flex flex-col">
                    <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="min-w-0">
                            <h3 className="text-[13px] font-black text-white uppercase tracking-tight leading-tight italic group-hover:text-primary transition-colors duration-500 line-clamp-2" title={video.original_filename}>
                                {video.original_filename}
                            </h3>
                        </div>
                        <button className="w-8 h-8 flex items-center justify-center hover:bg-white/5 rounded-lg border border-transparent hover:border-white/10 transition-all shrink-0">
                            <MoreVertical className="w-4 h-4 text-text-secondary" />
                        </button>
                    </div>

                    <div className="flex items-center gap-4 text-[10px] font-black text-text-secondary uppercase tracking-[0.2em] mb-auto opacity-60">
                        <span className="flex items-center gap-1.5">
                            <div className="w-1 h-1 rounded-full bg-primary/40" />
                            {new Date(video.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                        <div className="h-4 w-[1px] bg-white/10" />
                        <span>{(video.file_size_bytes ? video.file_size_bytes / (1024 * 1024) : 0).toFixed(1)} MB</span>
                    </div>

                    {/* Actions Rail */}
                    <div className="flex items-center justify-between pt-6 mt-6 border-t border-white/5">
                        <button
                            onClick={handleDownload}
                            className="flex items-center gap-2.5 text-[10px] font-black uppercase tracking-[0.3em] text-primary hover:text-white transition-all transform active:scale-95 italic group/dl"
                        >
                            <div className="p-2 bg-primary/10 rounded-lg group-hover/dl:bg-primary transition-colors">
                                <Download className="w-4 h-4 group-hover/dl:text-white" />
                            </div>
                            <span className="hidden sm:inline">Ingress Pool</span>
                        </button>
                        <button
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-primary/10 border border-white/5 hover:border-primary/20 rounded-xl text-text-secondary hover:text-primary transition-all transform active:scale-90 disabled:opacity-50"
                        >
                            {isDeleting ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : <Trash2 className="w-4.5 h-4.5" />}
                        </button>
                    </div>
                </div>

                {/* Bottom Red Line Indicator */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary scale-x-0 group-hover:scale-x-100 transition-transform duration-700 origin-center opacity-40 shadow-[0_-5px_15px_rgba(200,16,46,0.3)]" />
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
