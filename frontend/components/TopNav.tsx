'use client';

import React from 'react';
import { Search, Plus } from 'lucide-react';
import { useUpload } from './Shell';

interface Props {
    title?: string;
    onToggleSidebar?: () => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
}

export default function TopNav({ searchQuery, setSearchQuery }: Props) {
    const { openUploadModal } = useUpload();

    return (
        <header className="h-16 border-b border-[#333333] flex items-center justify-between px-6 bg-[#1C1C1C] shrink-0 sticky top-0 z-40">
            <div className="relative w-96 flex items-center">
                <Search className="absolute left-3 text-text-secondary" size={18} />
                <input
                    type="text"
                    placeholder="Search in library..."
                    className="w-full bg-black/30 border border-[#444444] rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-[#C8102E] transition-colors text-white placeholder:text-text-muted"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            <div className="flex items-center gap-4">
                <button
                    onClick={openUploadModal}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm bg-primary hover:bg-primary-hover transition-all hover:scale-105 active:scale-95 text-white shadow-lg shadow-primary/20"
                >
                    <Plus size={18} /> CREATE
                </button>

                <div className="flex items-center gap-4 ml-2">

                </div>
            </div>
        </header>
    );
}
