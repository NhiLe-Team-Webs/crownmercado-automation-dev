'use client';

import React from 'react';
import VideoUploader from '@/components/VideoUploader';
import Shell from '@/components/Shell';
import { useRouter } from 'next/navigation';

export default function UploadPage() {
    const router = useRouter();

    const handleUploadComplete = (videoId: string) => {
        // Option: delay redirect to let them see the success state
        setTimeout(() => {
            router.push('/library');
        }, 1500);
    };

    return (
        <Shell title="Pro Pipeline">
            <div className="min-h-[calc(100vh-64px)] py-16 px-8 flex flex-col items-center">
                <div className="max-w-4xl w-full">
                    <div className="mb-16 text-center animate-in fade-in slide-in-from-top-4 duration-1000">
                        <h1 className="text-primary text-5xl font-black uppercase tracking-tighter italic mb-4">
                            PRO <span className="text-white">ASSET</span> PIPELINE
                        </h1>
                        <p className="text-text-secondary text-sm font-bold uppercase tracking-[0.2em] max-w-2xl mx-auto leading-relaxed">
                            Deploy your content into the automated processing core. <br />
                            Sequential multi-stage rendering and AI transcription enabled.
                        </p>
                    </div>

                    <VideoUploader onUploadComplete={handleUploadComplete} />

                    <div className="mt-20 border-t border-white/5 pt-12 animate-in fade-in duration-1000 delay-500">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                            <div className="text-center group">
                                <span className="text-[9px] font-black text-primary tracking-widest uppercase block mb-2 group-hover:scale-110 transition-transform">Stage 01</span>
                                <p className="text-[10px] font-bold text-white uppercase tracking-widest opacity-60">Silence Removal</p>
                            </div>
                            <div className="text-center group">
                                <span className="text-[9px] font-black text-primary tracking-widest uppercase block mb-2 group-hover:scale-110 transition-transform">Stage 02</span>
                                <p className="text-[10px] font-bold text-white uppercase tracking-widest opacity-60">AI Transcription</p>
                            </div>
                            <div className="text-center group">
                                <span className="text-[9px] font-black text-primary tracking-widest uppercase block mb-2 group-hover:scale-110 transition-transform">Stage 03</span>
                                <p className="text-[10px] font-bold text-white uppercase tracking-widest opacity-60">Media Segmentation</p>
                            </div>
                            <div className="text-center group">
                                <span className="text-[9px] font-black text-primary tracking-widest uppercase block mb-2 group-hover:scale-110 transition-transform">Stage 04</span>
                                <p className="text-[10px] font-bold text-white uppercase tracking-widest opacity-60">Master Rendering</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Shell>
    );
}
