'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import VideoRow from '@/components/VideoRow';
import Shell from '@/components/Shell';
import { FileVideo, Loader2, Info } from 'lucide-react';
import Link from 'next/link';

export default function LibraryPage() {
    const { data: videos, isLoading } = useQuery({
        queryKey: ['videos'],
        queryFn: api.listVideos,
    });

    return (
        <Shell title="Video Archives">
            <div className="p-8 max-w-7xl mx-auto">
                {isLoading ? (
                    <div className="h-[60vh] flex flex-col items-center justify-center gap-6">
                        <div className="relative">
                            <Loader2 className="w-16 h-16 text-primary animate-spin" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
                            </div>
                        </div>
                        <p className="text-[10px] font-black text-text-secondary tracking-[0.3em] uppercase animate-pulse">Scanning Vault...</p>
                    </div>
                ) : !videos || videos.length === 0 ? (
                    <div className="h-[70vh] flex flex-col items-center justify-center text-center space-y-10 group">
                        <div className="relative">
                            <div className="w-32 h-32 rounded-sm bg-surface rotate-3 group-hover:rotate-6 transition-transform relative z-10 border border-white/5 flex items-center justify-center shadow-2xl">
                                <FileVideo className="w-12 h-12 text-white/5 group-hover:text-primary/20 transition-colors" />
                            </div>
                            <div className="absolute -inset-4 bg-primary/10 blur-3xl rounded-full opacity-50 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="max-w-md space-y-4">
                            <h3 className="text-3xl font-black text-white uppercase tracking-tighter italic">Vault is <span className="text-primary">Empty</span></h3>
                            <p className="text-text-secondary text-sm font-medium leading-relaxed uppercase tracking-widest text-[10px]">
                                No assets found. Initialize your first deployment to view results.
                            </p>
                        </div>
                        <Link href="/upload" className="px-12 py-5 bg-primary text-white text-[11px] font-black tracking-[0.3em] rounded-sm hover:bg-primary-hover transition-all shadow-[0_20px_40px_rgba(200,16,46,0.3)] hover:translate-y-[-4px] uppercase italic">
                            Initialize Upload
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-6 animate-in fade-in duration-700">
                        {/* Summary Header */}
                        <div className="flex items-center justify-between px-2">
                            <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-widest text-text-secondary">
                                <div className="flex items-center gap-2">
                                    <span className="text-primary">TOTAL ASSETS:</span>
                                    <span className="text-white">{videos.length}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-surface/30 rounded-sm border border-white/5 overflow-hidden backdrop-blur-sm">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-white/10 bg-black/40">
                                        <th className="py-4 pl-6 pr-4 text-[10px] font-black uppercase tracking-widest text-text-secondary">Asset</th>
                                        <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-text-secondary">Status</th>
                                        <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-text-secondary">Date</th>
                                        <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-text-secondary">Size</th>
                                        <th className="py-4 pr-6 pl-4 text-right text-[10px] font-black uppercase tracking-widest text-text-secondary">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.02]">
                                    {videos.map((video) => (
                                        <VideoRow key={video.id} video={video} />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            <div className="fixed bottom-8 left-72 right-8 flex justify-end pointer-events-none">
                <div className="bg-black/80 backdrop-blur-xl border border-white/10 px-6 py-3 rounded-sm flex items-center gap-4 text-[9px] font-black uppercase tracking-widest text-text-secondary shadow-2xl pointer-events-auto">
                    <Info className="w-3 h-3 text-primary" />
                    <span>System Status: Operational</span>
                </div>
            </div>
        </Shell>
    );
}
