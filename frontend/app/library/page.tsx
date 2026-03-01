'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, Video } from '@/lib/api';
import VideoRow from '@/components/VideoRow';
import Shell, { useSearch } from '@/components/Shell';
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
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Channel Content</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Manage and monitor your processed videos</p>
                </div>
                <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-full shadow-inner">
                    <button className="px-6 py-1.5 rounded-full text-xs font-bold bg-white dark:bg-white/10 text-black dark:text-white shadow-sm">All</button>
                    <button className="px-6 py-1.5 rounded-full text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">Completed</button>
                </div>
            </div>

            {isLoading ? (
                <div className="py-32 flex flex-col items-center justify-center gap-6">
                    <span className="material-symbols-outlined text-[48px] text-[var(--color-primary)] animate-spin">sync</span>
                    <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Loading assets...</p>
                </div>
            ) : filteredVideos.length > 0 ? (
                <div id="videoGrid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredVideos.map((video: Video) => (
                        <VideoRow key={video.id} video={video} />
                    ))}
                </div>
            ) : (
                <div id="emptyState" className="py-32 flex flex-col items-center justify-center text-center bg-white dark:bg-[#111] rounded-3xl border border-gray-100 dark:border-white/10 shadow-sm">
                    <div className="w-20 h-20 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
                        <span className="material-symbols-outlined text-4xl text-gray-300 dark:text-gray-600">video_library</span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">No videos found</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-6">Start your first project to see it here.</p>
                    <Link href="/" className="px-6 py-2 bg-[var(--color-primary)] text-white font-bold rounded-full shadow-lg shadow-red-500/20 hover:scale-[1.02] active:scale-95 transition-all">
                        Create Now
                    </Link>
                </div>
            )}
        </div>
    );
}

