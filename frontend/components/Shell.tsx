'use client';

import React, { createContext, useContext, useState } from 'react';
import Sidebar from './Sidebar';
import TopNav from './TopNav';
import VideoUploader from './VideoUploader';
import { X } from 'lucide-react';

interface ShellProps {
    children: React.ReactNode;
    title?: string;
}

interface SearchContextType {
    searchQuery: string;
    setSearchQuery: (q: string) => void;
}

interface UploadContextType {
    isUploadModalOpen: boolean;
    openUploadModal: () => void;
    closeUploadModal: () => void;
}

const SearchContext = createContext<SearchContextType>({
    searchQuery: '',
    setSearchQuery: () => { },
});

const UploadContext = createContext<UploadContextType>({
    isUploadModalOpen: false,
    openUploadModal: () => { },
    closeUploadModal: () => { },
});

export const useSearch = () => useContext(SearchContext);
export const useUpload = () => useContext(UploadContext);

export default function Shell({ children, title }: ShellProps) {
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

    const openUploadModal = () => setIsUploadModalOpen(true);
    const closeUploadModal = () => setIsUploadModalOpen(false);

    return (
        <SearchContext.Provider value={{ searchQuery, setSearchQuery }}>
            <UploadContext.Provider value={{ isUploadModalOpen, openUploadModal, closeUploadModal }}>
                <div className="flex h-screen bg-[#121212] font-sans text-white selection:bg-primary selection:text-white overflow-hidden">
                    <Sidebar isCollapsed={isSidebarCollapsed} setIsCollapsed={setIsSidebarCollapsed} />
                    <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                        <TopNav
                            title={title}
                            onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                            searchQuery={searchQuery}
                            setSearchQuery={setSearchQuery}
                        />
                        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                            {children}
                        </div>
                    </main>

                    {/* Global Upload Modal Overlay */}
                    {isUploadModalOpen && (
                        <div
                            className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-10 bg-black/80 backdrop-blur-md animate-in fade-in duration-300"
                            onClick={(e) => {
                                if (e.target === e.currentTarget) closeUploadModal();
                            }}
                        >
                            <div className="relative w-full max-w-4xl max-h-full overflow-hidden flex flex-col">
                                <VideoUploader
                                    onClose={closeUploadModal}
                                    onUploadComplete={() => {
                                        setTimeout(() => closeUploadModal(), 2000);
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </UploadContext.Provider>
        </SearchContext.Provider>
    );
}
