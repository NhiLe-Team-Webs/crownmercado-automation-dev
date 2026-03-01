'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface Props {
    title?: string;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
}

export default function TopNav({ searchQuery, setSearchQuery }: Props) {
    const pathname = usePathname();
    const isLibrary = pathname?.includes('/library');
    const [theme, setTheme] = useState<'light' | 'dark'>('light');

    useEffect(() => {
        const isDark = document.documentElement.classList.contains('dark') ||
            (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
        setTheme(isDark ? 'dark' : 'light');
        if (isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, []);

    const toggleTheme = () => {
        if (theme === 'light') {
            document.documentElement.classList.add('dark');
            setTheme('dark');
        } else {
            document.documentElement.classList.remove('dark');
            setTheme('light');
        }
    };

    return (
        <header className="h-16 bg-white dark:bg-[#0F0F0F] border-b border-gray-200 dark:border-white/10 flex items-center justify-between px-6 sticky top-0 z-50 transition-colors">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#FF0000] rounded-sm flex items-center justify-center text-white shadow-sm">
                    <span className="material-symbols-outlined text-[20px] fill-1">play_arrow</span>
                </div>
                <Link href="/" className="font-bold text-xl tracking-tighter text-gray-900 dark:text-white flex items-center">
                    Studio <span className="bg-blue-600 dark:bg-blue-500 text-[10px] text-white px-1 ml-1 rounded-sm uppercase tracking-tighter font-black">Beta</span>
                </Link>
            </div>

            {isLibrary ? (
                <>
                    {/* Search Bar in Storage */}
                    <div className="flex-1 max-w-2xl px-8 hidden md:block">
                        <div className="relative group">
                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 group-focus-within:text-[var(--color-action)]">
                                search
                            </span>
                            <input
                                type="text"
                                placeholder="Search your library..."
                                className="w-full bg-gray-50 dark:bg-white/5 border border-transparent focus:bg-white dark:focus:bg-[#1A1A1A] focus:border-[var(--color-action)] dark:focus:border-[var(--color-action)] focus:ring-1 focus:ring-[var(--color-action)] rounded-full py-2 pl-12 transition-all outline-none text-[#0F0F0F] dark:text-white dark:placeholder-gray-500"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button onClick={toggleTheme} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 transition-colors">
                            <span className="material-symbols-outlined text-[20px]">
                                {theme === 'light' ? 'dark_mode' : 'light_mode'}
                            </span>
                        </button>
                        <Link href="/upload" className="flex items-center gap-2 px-5 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-full text-sm font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-md">
                            <span className="material-symbols-outlined text-[18px]">add</span>
                            <span className="hidden sm:inline">New Project</span>
                            <span className="sm:hidden">Add</span>
                        </Link>
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 border border-gray-200 dark:border-white/10">
                        </div>
                    </div>
                </>
            ) : (
                <div className="flex items-center gap-3">
                    <button onClick={toggleTheme} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 transition-colors">
                        <span className="material-symbols-outlined text-[20px]">
                            {theme === 'light' ? 'dark_mode' : 'light_mode'}
                        </span>
                    </button>
                    <Link href="/library" className="flex items-center gap-2 px-5 py-2.5 text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 rounded-full text-sm font-bold transition-all">
                        <span className="material-symbols-outlined text-[22px]">video_library</span>
                        <span className="hidden sm:inline">Content Library</span>
                    </Link>
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 border border-gray-200 dark:border-white/10 shadow-sm">
                    </div>
                </div>
            )}
        </header>
    );
}
