'use client';

import React from 'react';
import VideoUploader from '@/components/VideoUploader';
import { LayoutDashboard, Library, Settings, LogOut } from 'lucide-react';
import Link from 'next/link';

export default function UploadPage() {
    return (
        <div className="flex min-h-screen bg-background font-sans">
            {/* Sidebar - YouTube Studio Style */}
            <aside className="w-64 border-r border-white/5 bg-surface flex flex-col">
                <div className="p-6">
                    <Link href="/" className="flex items-center gap-2 group">
                        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                            <div className="w-4 h-4 bg-white rounded-sm" />
                        </div>
                        <span className="text-lg font-bold text-white tracking-tight">Studio</span>
                    </Link>
                </div>

                <nav className="flex-1 px-4 space-y-1">
                    <Link href="/upload" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-primary/10 text-primary font-medium transition-colors">
                        <LayoutDashboard className="w-5 h-5" />
                        Dashboard
                    </Link>
                    <Link href="/library" className="flex items-center gap-3 px-3 py-2 rounded-lg text-text-secondary hover:bg-white/5 hover:text-white transition-colors">
                        <Library className="w-5 h-5" />
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
                <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-background/50 backdrop-blur-md">
                    <div className="flex items-center gap-4">
                        <h1 className="text-lg font-semibold text-white">Channel dashboard</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <button className="px-4 py-2 bg-primary text-white text-sm font-medium rounded hover:bg-primary-hover transition-colors">
                            CREATE
                        </button>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-accent-blue" />
                    </div>
                </header>

                {/* Scrollable Area */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8">
                    <div className="max-w-4xl mx-auto">
                        <div className="mb-8">
                            <h2 className="text-2xl font-bold text-white mb-2">Upload videos</h2>
                            <p className="text-text-secondary text-sm">Upload your video files to start processing them.</p>
                        </div>

                        <VideoUploader
                            onUploadComplete={(id) => console.log('Upload finished:', id)}
                        />

                        {/* Quick Tips Box */}
                        <div className="mt-12 p-6 rounded-xl bg-surface-hover border border-white/5">
                            <h3 className="text-sm font-semibold text-white mb-3">Upload tips</h3>
                            <ul className="space-y-3 text-xs text-text-secondary">
                                <li className="flex gap-2">
                                    <div className="w-1 h-1 rounded-full bg-primary mt-1.5 shrink-0" />
                                    <span>Your video will be secure and private until you choose to publish it.</span>
                                </li>
                                <li className="flex gap-2">
                                    <div className="w-1 h-1 rounded-full bg-primary mt-1.5 shrink-0" />
                                    <span>Use chunked uploads for large files (automatically handled).</span>
                                </li>
                                <li className="flex gap-2">
                                    <div className="w-1 h-1 rounded-full bg-primary mt-1.5 shrink-0" />
                                    <span>If your connection drops, refresh the page to resume from where you left off.</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
