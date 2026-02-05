'use client';

import React, { useState } from 'react';
import { Play, Download, Trash2, MoreVertical, FileVideo, Loader2, Link as LinkIcon, ShieldCheck, Clock } from 'lucide-react';
import { Video, api } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import VideoPlayerModal from './VideoPlayerModal';

interface Props {
    video: Video;
}

export default function VideoRow({ video }: Props) {
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

    const formattedSize = video.file_size_bytes
        ? (video.file_size_bytes / (1024 * 1024)).toFixed(1) + ' MB'
        : '--';

    const statusColors = {
        completed: 'text-green-500 bg-green-500/10 border-green-500/20',
        uploading: 'text-primary bg-primary/10 border-primary/20',
        processing: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
        failed: 'text-error bg-error/10 border-error/20',
    };

    return (
        <>
            <tr
                className={`group border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors cursor-pointer ${isDeleting ? 'opacity-30 pointer-events-none' : ''}`}
                onClick={() => {
                    if (video.status === 'completed') {
                        setShowPlayer(true);
                    }
                }}
            >
                <td className="py-4 pl-6 pr-4">
                    <div className="flex items-center gap-4">
                        <div className="w-24 aspect-video bg-black/40 rounded-sm flex items-center justify-center relative overflow-hidden flex-shrink-0 border border-white/5">
                            <FileVideo className="w-5 h-5 text-white/5 group-hover:text-primary/20 transition-colors" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Play className="w-5 h-5 text-white fill-current" />
                            </div>
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-xs font-black text-white uppercase italic tracking-tight truncate group-hover:text-primary transition-colors">
                                {video.original_filename}
                            </span>
                            <span className="text-[9px] font-bold text-text-secondary uppercase tracking-widest mt-1">
                                ID: {video.id.substring(0, 8)}...
                            </span>
                        </div>
                    </div>
                </td>
                <td className="py-4 px-4">
                    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm border text-[9px] font-black uppercase tracking-widest ${statusColors[video.status] || statusColors.failed}`}>
                        {video.status === 'completed' && <ShieldCheck className="w-3 h-3" />}
                        {video.status === 'uploading' && <Loader2 className="w-3 h-3 animate-spin" />}
                        {video.status === 'processing' && <Clock className="w-3 h-3 animate-pulse" />}
                        {video.status}
                    </div>
                </td>
                <td className="py-4 px-4">
                    <span className="text-[10px] font-bold text-text-secondary">
                        {new Date(video.created_at).toLocaleDateString()}
                    </span>
                </td>
                <td className="py-4 px-4">
                    <span className="text-[10px] font-bold text-text-secondary">
                        {formattedSize}
                    </span>
                </td>
                <td className="py-4 px-4">
                    <div className="flex items-center gap-6 text-text-secondary group-hover:text-white transition-colors">
                        <span className="text-[10px] font-bold">--</span>
                    </div>
                </td>
                <td className="py-4 pr-6 pl-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={(e) => { e.stopPropagation(); handleDownload(); }}
                            title="Download Source"
                            className="p-1.5 hover:bg-white/10 rounded-sm text-text-secondary hover:text-white transition-all"
                        >
                            <Download className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleDelete}
                            title="Purge Asset"
                            className="p-1.5 hover:bg-primary/10 rounded-sm text-text-secondary hover:text-primary transition-all"
                        >
                            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                        <button
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 hover:bg-white/10 rounded-sm text-text-secondary hover:text-white transition-all"
                        >
                            <MoreVertical className="w-4 h-4" />
                        </button>
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
