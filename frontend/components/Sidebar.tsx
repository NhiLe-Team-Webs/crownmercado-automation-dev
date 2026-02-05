'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Upload, Library as LibraryIcon, LogOut, Settings, HelpCircle } from 'lucide-react';

export default function Sidebar() {
    const pathname = usePathname();

    const menuItems = [
        { label: 'Upload', icon: Upload, href: '/upload' },
        { label: 'Library', icon: LibraryIcon, href: '/library' },
    ];

    return (
        <aside className="w-64 border-r border-white/5 bg-surface flex flex-col pt-6 shrink-0 z-30">
            {/* Logo Section */}
            <div className="px-6 mb-10">
                <Link href="/" className="flex items-center gap-3 group">
                    <div className="w-10 h-10 rounded-sm bg-primary flex items-center justify-center transform rotate-3 group-hover:rotate-12 transition-all duration-300 shadow-lg shadow-primary/20 relative overflow-hidden">
                        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <span className="text-white font-black text-xl italic uppercase -skew-x-12 relative z-10">C</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-black text-white uppercase tracking-widest leading-none">Crown</span>
                        <span className="text-[10px] font-bold text-primary uppercase tracking-tighter">Mercado Studio</span>
                    </div>
                </Link>
            </div>

            {/* Main Menu */}
            <div className="flex-1 px-3 space-y-1">
                <div className="px-4 mb-2">
                    <span className="text-[10px] font-black text-text-secondary uppercase tracking-[0.2em]">Studio Menu</span>
                </div>
                {menuItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.label}
                            href={item.href}
                            className={`flex items-center gap-3 px-4 py-3 rounded-sm transition-all group relative ${isActive
                                    ? 'bg-primary/10 text-white font-black border-l-2 border-primary shadow-[inset_4px_0_10px_rgba(200,16,46,0.05)]'
                                    : 'text-text-secondary hover:bg-white/5 hover:text-white'
                                }`}
                        >
                            <item.icon className={`w-5 h-5 shrink-0 transition-colors ${isActive ? 'text-primary' : 'group-hover:text-primary'}`} />
                            <span className="font-headline tracking-wide uppercase text-[11px] italic">{item.label}</span>
                            {isActive && (
                                <div className="absolute right-2 w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(200,16,46,1)] animate-pulse" />
                            )}
                        </Link>
                    );
                })}
            </div>

            {/* Bottom Section */}
            <div className="px-3 py-6 space-y-1 bg-black/10 border-t border-white/5">
                <Link
                    href="#"
                    className="flex items-center gap-3 px-4 py-2.5 rounded-sm text-text-secondary hover:bg-white/5 hover:text-white transition-all group"
                >
                    <Settings className="w-4 h-4 shrink-0 group-hover:text-primary transition-colors" />
                    <span className="font-headline tracking-wide uppercase text-[10px] italic">Settings</span>
                </Link>
                <div className="mt-4 pt-4 border-t border-white/5">
                    <button className="flex items-center gap-3 px-4 py-3 w-full rounded-sm text-text-secondary hover:bg-primary/5 hover:text-primary transition-all group">
                        <LogOut className="w-5 h-5 shrink-0 group-hover:translate-x-1 transition-transform" />
                        <span className="font-headline tracking-wide uppercase text-[11px] font-black italic">Sign out</span>
                    </button>
                </div>
            </div>
        </aside>
    );
}
