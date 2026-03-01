'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, Video } from '@/lib/api';
import VideoRow from '@/components/VideoRow';
import Shell, { useSearch } from '@/components/Shell';
import { FileVideo, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function LibraryPage() {
    return (
        <Shell title="Channel content">
            <LibraryContent />
        </Shell>
    );
}

function LibraryContent() {
    const { searchQuery } = useSearch();
    const { data: videos, isLoading } = useQuery({
        queryKey: ['videos'],
        queryFn: api.listVideos,
    });

    const filteredVideos = videos?.filter((v: Video) =>
        v.original_filename.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

    return (
        <div className="flex flex-col gap-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Channel Content</h2>
                    <p className="text-sm text-gray-500 font-medium">Manage and monitor your processed videos</p>
                </div>
                <div className="flex bg-gray-100 p-1 rounded-full shadow-inner">
                    <button className="px-6 py-1.5 rounded-full text-xs font-bold bg-white text-black shadow-sm">All</button>
                    <button className="px-6 py-1.5 rounded-full text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors">Completed</button>
                </div>
            </div>

            {isLoading ? (
                <div className="py-32 flex flex-col items-center justify-center gap-6">
                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                    <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Loading assets...</p>
                </div>
            ) : filteredVideos.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredVideos.map((video: Video) => (
                        <VideoRow key={video.id} video={video} />
                    ))}
                </div>
            ) : (
                <div className="py-32 flex flex-col items-center justify-center text-center bg-white rounded-3xl border border-gray-100 shadow-sm">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                        <FileVideo className="text-gray-300 w-10 h-10" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">No videos found</h3>
                    <p className="text-sm text-gray-500 mt-1 mb-6">Start your first project to see it here.</p>
                    <Link href="/upload" className="px-6 py-2 bg-primary hover:bg-primary-hover transition-colors text-white font-bold rounded-full shadow-lg shadow-red-500/20 active:scale-95">
                        Create Now
                    </Link>
                </div>
            )}
        </div>
    );
}
