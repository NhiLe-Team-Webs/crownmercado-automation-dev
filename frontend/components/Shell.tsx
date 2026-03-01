'use client';

import React, { createContext, useContext, useState } from 'react';
import TopNav from './TopNav';

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

    return (
        <SearchContext.Provider value={{ searchQuery, setSearchQuery }}>
            <div className="min-h-screen flex flex-col font-sans bg-[#F9F9F9]">
                <TopNav
                    title={title}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                />
                <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
                    {children}
                </main>
            </div>
        </SearchContext.Provider>
    );
}
