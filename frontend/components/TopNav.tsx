'use client';

import React from 'react';
import Link from 'next/link';
import { Search, Plus, Play } from 'lucide-react';

interface Props {
    title?: string;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
}

export default function TopNav({ searchQuery, setSearchQuery }: Props) {
    return (
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-50">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#FF0000] rounded-sm flex items-center justify-center text-white shadow-sm">
                    <Play size={20} className="fill-current" />
                </div>
                <Link href="/" className="font-bold text-xl tracking-tighter text-gray-900 flex items-center">
                    Studio <span className="bg-blue-600 text-[10px] text-white px-1 ml-1 rounded-sm uppercase tracking-tighter font-black">Beta</span>
                </Link>
            </div>

            <div className="flex-1 max-w-2xl px-8 hidden md:block">
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600" size={20} />
                    <input
                        type="text"
                        placeholder="Search your library..."
                        className="w-full bg-gray-50 border border-transparent focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600 rounded-full py-2 pl-12 transition-all outline-none text-gray-900"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex items-center gap-4">
                <Link href="/upload" className="flex items-center gap-2 px-5 py-2.5 bg-black text-white rounded-full text-sm font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-md">
                    <Plus size={18} />
                    <span className="hidden sm:inline">New Project</span>
                    <span className="sm:hidden">Add</span>
                </Link>
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 border border-gray-200">
                </div>
            </div>
        </header>
    );
}
