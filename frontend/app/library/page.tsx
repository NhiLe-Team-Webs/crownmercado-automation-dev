'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import VideoCard from '@/components/VideoCard';
import { LayoutDashboard, Library as LibraryIcon, Settings, LogOut, Search, Filter, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function LibraryPage() {
    const { data: videos, isLoading } = useQuery({
        queryKey: ['videos'],
        queryFn: api.listVideos,
    });

    return (
        <div className="flex min-h-screen bg-background font-sans">
            {/* Sidebar */}
            <aside className="w-64 border-r border-white/5 bg-surface flex flex-col shrink-0">
                <div className="p-6">
                    <Link href="/" className="flex items-center gap-2 group">
                        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                            <div className="w-4 h-4 bg-white rounded-sm" />
                        </div>
                        <span className="text-lg font-bold text-white tracking-tight">Studio</span>
                    </Link>
                </div>

                <nav className="flex-1 px-4 space-y-1">
                    <Link href="/upload" className="flex items-center gap-3 px-3 py-2 rounded-lg text-text-secondary hover:bg-white/5 hover:text-white transition-colors">
                        <LayoutDashboard className="w-5 h-5" />
                        Dashboard
                    </Link>
                    <Link href="/library" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-primary/10 text-primary font-medium transition-colors">
                        <LibraryIcon className="w-5 h-5" />
                        Content
                    </Link>
                    <Link href="/settings" className="flex items-center gap-3 px-3 py-2 rounded-lg text-text-secondary hover:bg-white/5 hover:text-white transition-colors">
                        <Settings className="w-5 h-5" />
                        Settings
                    </Link>
                </nav>

                <div className="p-4 border-t border-white/5">
                    <button className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-error hover:bg-error/10 transition-colors">
                        <LogOut className="w-5 h-5" />
                        Sign out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-background/50 backdrop-blur-md shrink-0">
                    <div className="flex items-center gap-6">
                        <h1 className="text-lg font-semibold text-white">Channel content</h1>
                        {/* Tabs Style */}
                        <div className="flex items-center gap-4 h-16 border-b-2 border-primary -mb-[1px]">
                            <span className="text-sm font-medium text-primary">Videos</span>
                        </div>
                        <div className="flex items-center gap-4 h-16 border-b-2 border-transparent -mb-[1px]">
                            <span className="text-sm font-medium text-text-secondary hover:text-white cursor-pointer transition-colors">Playlists</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                            <input
                                type="text"
                                placeholder="Search videos..."
                                className="bg-white/5 border border-white/10 rounded-full py-1.5 pl-9 pr-4 text-xs text-white focus:outline-none focus:border-primary/50 w-64 transition-all"
                            />
                        </div>
                        <button className="p-2 hover:bg-white/5 rounded-full text-text-secondary transition-colors">
                            <Filter className="w-4 h-4" />
                        </button>
                    </div>
                </header>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-8">
                    {isLoading ? (
                        <div className="h-full flex flex-col items-center justify-center gap-4">
                            <Loader2 className="w-12 h-12 text-primary animate-spin" />
                            <p className="text-text-secondary text-sm">Loading your library...</p>
                        </div>
                    ) : !videos || videos.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                            <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center">
                                <FileVideo className="w-10 h-10 text-white/20" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white mb-2">No videos yet</h3>
                                <p className="text-text-secondary text-sm max-w-sm">
                                    Upload your first video to start processing and managing your content.
                                </p>
                            </div>
                            <Link href="/upload" className="px-6 py-2.5 bg-primary text-white font-semibold rounded hover:bg-primary-hover transition-colors">
                                UPLOAD VIDEOS
                            </Link>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {videos.map((video) => (
                                <VideoCard key={video.id} video={video} />
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

function FileVideo(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
            <path d="M14 2v4a2 2 0 0 0 2 2h4" />
            <rect width="8" height="6" x="8" y="12" rx="1" />
        </svg>
    );
}
