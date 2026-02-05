'use client';

import React from 'react';
import { Bell, User } from 'lucide-react';

interface Props {
    title?: string;
}

export default function TopNav({ title = 'Studio' }: Props) {
    return (
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-surface/80 backdrop-blur-xl z-20 shrink-0 sticky top-0">
            <div className="flex items-center gap-6">
                <h1 className="text-sm font-black text-white uppercase tracking-[0.2em] italic flex items-center gap-2">
                    <span className="w-2 h-2 bg-primary animate-pulse shadow-[0_0_8px_rgba(200,16,46,1)]" />
                    {title}
                </h1>
            </div>

            <div className="flex items-center gap-6">
                <button className="p-2 text-text-secondary hover:text-white transition-colors relative">
                    <Bell className="w-4 h-4" />
                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-primary rounded-full border border-surface" />
                </button>

                <div className="h-4 w-[1px] bg-white/10" />

                <button className="flex items-center gap-3 group">
                    <div className="text-right">
                        <p className="text-[10px] font-black text-white uppercase tracking-widest leading-none group-hover:text-primary transition-colors">Admin</p>
                        <p className="text-[8px] font-bold text-text-secondary uppercase tracking-tighter mt-1">Enterprise Plan</p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-[10px] font-black shadow-lg shadow-primary/20">
                        V
                    </div>
                </button>
            </div>
        </header>
    );
}
