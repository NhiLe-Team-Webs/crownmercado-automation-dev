'use client';

import React from 'react';
import { Play, Download, Trash2, MoreVertical, FileVideo } from 'lucide-react';
import { Video } from '@/lib/api';

interface Props {
    video: Video;
}

export default function VideoCard({ video }: Props) {
    return (
        <div className="group bg-surface hover:bg-surface-hover border border-white/5 rounded-xl overflow-hidden transition-all duration-300">
            {/* Thumbnail Placeholder */}
            <div className="aspect-video bg-white/5 relative flex items-center justify-center overflow-hidden">
                <FileVideo className="w-12 h-12 text-white/10 group-hover:scale-110 transition-transform duration-500" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                    <button className="p-3 rounded-full bg-primary text-white scale-90 group-hover:scale-100 transition-transform shadow-xl">
                        <Play className="w-5 h-5 fill-current" />
                    </button>
                </div>
                <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-medium text-white">
                    {video.status}
                </div>
            </div>

            {/* Details */}
            <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-medium text-white truncate leading-tight mb-1" title={video.original_filename}>
                        {video.original_filename}
                    </h3>
                    <button className="p-1 hover:bg-white/10 rounded-full transition-colors shrink-0">
                        <MoreVertical className="w-4 h-4 text-text-secondary" />
                    </button>
                </div>
                <p className="text-[11px] text-text-secondary mb-3">
                    Uploaded {new Date(video.created_at).toLocaleDateString()}
                </p>

                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                    <span className="text-[10px] font-mono text-text-secondary">
                        {(video.file_size_bytes ? video.file_size_bytes / (1024 * 1024) : 0).toFixed(1)} MB
                    </span>
                    <div className="flex gap-1">
                        <button className="p-1.5 hover:bg-white/10 rounded-lg text-text-secondary hover:text-white transition-colors">
                            <Download className="w-3.5 h-3.5" />
                        </button>
                        <button className="p-1.5 hover:bg-white/10 rounded-lg text-text-secondary hover:text-error transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
