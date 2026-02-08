'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Upload, Library as LibraryIcon, Menu } from 'lucide-react';
import { useUpload } from './Shell';

interface SidebarProps {
    isCollapsed: boolean;
    setIsCollapsed: (collapsed: boolean) => void;
}

export default function Sidebar({ isCollapsed, setIsCollapsed }: SidebarProps) {
    const pathname = usePathname();
    const { openUploadModal } = useUpload();

    const menuItems = [
        { label: 'Library', icon: LibraryIcon, href: '/library', type: 'link' },
    ];

    return (
        <aside
            className={`flex flex-col border-r border-[#333333] transition-all duration-300 bg-[#1C1C1C] ${isCollapsed ? 'w-20' : 'w-64'}`}
        >
            <div className="p-4 flex items-center justify-between h-16 shrink-0">
                {!isCollapsed && (
                    <Link href="/" className="flex items-center gap-3 px-2 group">
                        <div className="w-8 h-8 rounded bg-[#C8102E] flex items-center justify-center font-bold shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform">
                            <span className="text-white italic font-black text-xs">CM</span>
                        </div>
                        <span className="font-bold text-sm tracking-tight uppercase text-white truncate">Crown Mercado</span>
                    </Link>
                )}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className={`p-2 hover:bg-white/10 rounded-full transition-colors ${isCollapsed ? 'mx-auto' : ''}`}
                >
                    <Menu size={20} className="text-text-secondary" />
                </button>
            </div>

            <nav className="mt-4 flex-1 px-3 space-y-1">
                {menuItems.map((item) => {
                    const isActive = item.type === 'link' && pathname === item.href;

                    if (item.type === 'button') {
                        return (
                            <button
                                key={item.label}
                                onClick={item.onClick}
                                className={`w-full flex items-center gap-4 py-3 px-3 transition-all rounded-lg relative text-text-secondary hover:text-white hover:bg-white/5`}
                            >
                                <item.icon size={20} />
                                {!isCollapsed && (
                                    <span className="text-sm font-medium">{item.label}</span>
                                )}
                            </button>
                        );
                    }

                    return (
                        <Link
                            key={item.label}
                            href={item.href || '#'}
                            className={`flex items-center gap-4 py-3 px-3 transition-all rounded-lg relative ${isActive ? 'text-white' : 'text-text-secondary hover:text-white hover:bg-white/5'}`}
                        >
                            {isActive && (
                                <div className="absolute left-0 w-1 h-8 rounded-r-full bg-[#C8102E] shadow-[0_0_10px_#C8102E]" />
                            )}
                            <div className={isActive ? 'text-[#C8102E]' : ''}>
                                <item.icon size={20} />
                            </div>
                            {!isCollapsed && (
                                <span className={`text-sm font-medium ${isActive ? 'font-bold' : ''}`}>{item.label}</span>
                            )}
                        </Link>
                    );
                })}
            </nav>

            <div className="mb-4 pt-4 border-t border-[#333333] px-3 space-y-1">
                <div className={`flex items-center gap-4 py-3 px-3 rounded-lg text-text-secondary ${isCollapsed ? 'justify-center' : ''}`}>
                    <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-red-600 to-black border border-white/20 shrink-0"></div>
                    {!isCollapsed && <span className="text-sm font-medium truncate">Văn Đức Tân</span>}
                </div>
            </div>
        </aside>
    );
}
