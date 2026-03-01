'use client';

import React, { createContext, useContext, useState } from 'react';
import TopNav from './TopNav';
import { usePathname } from 'next/navigation';

interface ShellProps {
    children: React.ReactNode;
    title?: string;
}

interface SearchContextType {
    searchQuery: string;
    setSearchQuery: (q: string) => void;
}

const SearchContext = createContext<SearchContextType>({
    searchQuery: '',
    setSearchQuery: () => { },
});

export const useSearch = () => useContext(SearchContext);

export default function Shell({ children, title }: ShellProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const pathname = usePathname();
    const isLibrary = pathname?.includes('/library');

    return (
        <SearchContext.Provider value={{ searchQuery, setSearchQuery }}>
            <div className="min-h-screen flex flex-col font-sans text-gray-900 dark:text-white transition-colors">
                <TopNav
                    title={title}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                />
                <main className={isLibrary ? "flex-1 max-w-[1400px] w-full mx-auto p-8 flex flex-col gap-8" : "flex-1 flex items-center justify-center p-8"}>
                    {children}
                </main>
            </div>
        </SearchContext.Provider>
    );
}
