'use client';

import React, { useState } from 'react';
import { Play, Download, Trash2, MoreVertical, Loader2, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { Video, api } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import VideoPlayerModal from './VideoPlayerModal';
import { useUpload } from './Shell';

interface Props {
    video: Video;
}

export default function VideoRow({ video }: Props) {
    const [showPlayer, setShowPlayer] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const queryClient = useQueryClient();
    const { openUploadModal } = useUpload();

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

    const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('Deploy destruction sequence? This data will be purged permanentely.')) {
            setIsDeleting(true);
            try {
                await deleteMutation.mutateAsync(video.id);
            } finally {
                setIsDeleting(false);
            }
        }
    };

    const isInterrupted = video.status === 'uploading';

    return (
        <>
            <tr
                className={`group border-b border-[#333333] last:border-0 hover:bg-white/[0.02] transition-colors ${isDeleting ? 'opacity-30 pointer-events-none' : ''}`}
                onClick={() => {
                    if (video.status === 'completed') {
                        setShowPlayer(true);
                    }
                }}
            >
                <td className="p-4">
                    <div className="flex items-center gap-4">
                        <div className="w-32 aspect-video bg-black rounded relative overflow-hidden flex items-center justify-center shrink-0 border border-white/5">
                            {isInterrupted ? (
                                <AlertCircle size={20} className="text-red-500/60" />
                            ) : (
                                <Play size={20} className="text-white/40 group-hover:text-primary transition-colors" />
                            )}
                        </div>
                        <div className="min-w-0">
                            <div className="font-bold text-sm text-white truncate group-hover:text-primary transition-colors cursor-pointer">
                                {video.original_filename}
                            </div>
                            {isInterrupted && (
                                <div className="text-[11px] text-red-500/80 mt-1 font-bold">
                                    Click "resume upload" and select {video.original_filename} to resume
                                </div>
                            )}
                        </div>
                    </div>
                </td>
                <td className="p-4">
                    {isInterrupted ? (
                        <div className="text-[10px] font-black uppercase text-red-500/80 tracking-widest">
                            Upload interrupted
                        </div>
                    ) : (
                        <StatusBadge status={video.status} />
                    )}
                </td>
                <td className="p-4 text-center">
                    {!isInterrupted && (
                        <div className="text-sm font-medium text-white">{new Date(video.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                    )}
                </td>

                <td className="p-4 pr-8 text-right">
                    <div className="flex items-center justify-end gap-2">
                        {isInterrupted ? (
                            <>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        openUploadModal();
                                    }}
                                    className="px-4 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border border-white/10"
                                >
                                    Resume upload
                                </button>
                                <button
                                    onClick={handleDelete}
                                    className="px-4 py-1.5 bg-white/5 hover:bg-red-500/20 text-text-secondary hover:text-red-500 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border border-white/10 hover:border-red-500/30"
                                >
                                    Delete video
                                </button>
                            </>
                        ) : (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDownload();
                                    }}
                                    className="p-2 hover:bg-white/10 rounded-lg text-text-secondary hover:text-white transition-all transform active:scale-95"
                                    title="Download"
                                >
                                    <Download size={18} />
                                </button>
                                <button
                                    onClick={handleDelete}
                                    disabled={isDeleting}
                                    className="p-2 hover:bg-primary/20 rounded-lg text-text-secondary hover:text-primary transition-all transform active:scale-95"
                                    title="Delete"
                                >
                                    {isDeleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                                </button>
                                <button className="p-2 hover:bg-white/10 rounded-lg text-text-secondary hover:text-white" onClick={(e) => e.stopPropagation()}>
                                    <MoreVertical size={18} />
                                </button>
                            </div>
                        )}
                    </div>
                </td>
            </tr>

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

function StatusBadge({ status }: { status: string }) {
    const configs: Record<string, { icon: any; label: string; color: string; bg: string }> = {
        completed: { icon: CheckCircle2, label: 'Processed', color: 'text-green-500', bg: 'bg-green-500/10' },
        uploading: { icon: Clock, label: 'Uploading', color: 'text-primary', bg: 'bg-primary/10' },
        processing: { icon: Clock, label: 'Processing', color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
        failed: { icon: AlertCircle, label: 'Failed', color: 'text-red-500', bg: 'bg-red-500/10' },
    };

    const config = configs[status] || { icon: AlertCircle, label: 'Private', color: 'text-text-muted', bg: 'bg-white/5' };
    const Icon = config.icon;

    return (
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${config.color} ${config.bg} border border-current opacity-80 backdrop-blur-sm`}>
            <Icon size={12} strokeWidth={3} />
            {config.label}
        </div>
    );
}
