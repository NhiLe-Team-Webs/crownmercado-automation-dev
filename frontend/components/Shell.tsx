'use client';

import React from 'react';
import Sidebar from './Sidebar';
import TopNav from './TopNav';

interface Props {
    children: React.ReactNode;
    title?: string;
}

export default function Shell({ children, title }: Props) {
    return (
        <div className="flex min-h-screen bg-background font-sans text-white selection:bg-primary selection:text-white">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                {/* Background Glow */}
                <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />

                <TopNav title={title} />
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {children}
                </div>
            </main>
        </div>
    );
}
