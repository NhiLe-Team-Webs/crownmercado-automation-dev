'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import VideoRow from '@/components/VideoRow';
import Shell, { useSearch } from '@/components/Shell';
import { FileVideo, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
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

    const filteredVideos = videos?.filter((v: any) =>
        v.original_filename.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

    return (
        <div className="p-8 max-w-[1600px] mx-auto min-h-[calc(100vh-64px)]">
            {isLoading ? (
                <div className="h-[60vh] flex flex-col items-center justify-center gap-6">
                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                    <p className="text-sm font-bold text-text-secondary uppercase tracking-widest">Loading assets...</p>
                </div>
            ) : (
                <div className="animate-in fade-in duration-500">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-white">Channel content</h2>
                    </div>

                    <div className="bg-[#1C1C1C] rounded-xl border border-[#333333] overflow-hidden shadow-2xl">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-[#333333] text-[11px] font-bold text-text-secondary uppercase tracking-wider bg-black/10">
                                    <th className="p-4">Video</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4 text-center">Date</th>
                                    <th className="p-4 text-right pr-8">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#333333]">
                                {filteredVideos.length > 0 ? (
                                    filteredVideos.map((video: any) => (
                                        <VideoRow key={video.id} video={video} />
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="p-32 text-center">
                                            <div className="flex flex-col items-center gap-4 opacity-40">
                                                <FileVideo size={48} className="text-text-secondary" />
                                                <p className="text-sm font-bold uppercase tracking-widest text-text-secondary">No assets found matching your deployment search</p>
                                                <Link href="/upload" className="text-primary hover:underline text-xs font-black uppercase tracking-widest">Initialize New Deployment</Link>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Mock */}
                    <div className="flex items-center justify-between mt-6 px-2">
                        <div className="text-xs text-text-secondary font-medium">
                            Showing {filteredVideos.length} of {videos?.length || 0} entries
                        </div>
                        <div className="flex gap-1">
                            <button className="p-2 border border-[#333333] rounded-lg text-text-secondary opacity-30 cursor-not-allowed">
                                <ChevronLeft size={16} />
                            </button>
                            <button className="px-3.5 py-1.5 border border-primary/20 bg-primary/10 rounded-lg text-primary text-xs font-bold">1</button>
                            <button className="p-2 border border-[#333333] rounded-lg text-text-secondary hover:bg-white/5 transition-colors">
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

