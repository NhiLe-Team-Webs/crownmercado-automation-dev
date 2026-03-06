'use client';

import React, { useState } from 'react';
import Shell from "@/components/Shell";
import VideoUploader from "@/components/VideoUploader";
import PipelineTracker from "@/components/PipelineTracker";
import { api } from '@/lib/api';

type PageState = 'upload' | 'processing' | 'completed' | 'error';

export default function UploadPage() {
    const [pageState, setPageState] = useState<PageState>('upload');
    const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
    const [pipelineError, setPipelineError] = useState<string | null>(null);

    const handleBatchComplete = async (videoIds: string[]) => {
        if (videoIds.length === 0) return;

        try {
            // Send ALL video IDs to the backend — it merges them into one pipeline
            const result = await api.startPipeline(videoIds);
            setActiveVideoId(result.video_id);
            setPageState('processing');
        } catch (err) {
            setPipelineError(err instanceof Error ? err.message : 'Failed to start pipeline');
            setPageState('error');
        }
    };

    const handlePipelineComplete = () => {
        setPageState('completed');
    };

    const handlePipelineError = (error: string) => {
        setPipelineError(error);
    };

    const resetToUpload = () => {
        setPageState('upload');
        setActiveVideoId(null);
        setPipelineError(null);
    };

    return (
        <Shell title="Upload Video">
            {pageState === 'upload' && (
                <VideoUploader
                    onUploadComplete={(id: string) => console.log("File completed", id)}
                    onBatchComplete={handleBatchComplete}
                />
            )}

            {(pageState === 'processing' || pageState === 'completed') && activeVideoId && (
                <div className="w-full max-w-[800px] flex flex-col items-center gap-8">
                    {/* Video preview area */}
                    <div
                        className="w-full rounded-2xl overflow-hidden bg-black border border-gray-200 dark:border-white/10"
                        style={{ aspectRatio: '16/9' }}
                    >
                        <div className="w-full h-full flex flex-col items-center justify-center text-center">
                            <span className={`material-symbols-outlined text-[48px] mb-2 ${pageState === 'completed'
                                ? 'text-green-500'
                                : 'text-blue-500 animate-pulse'
                                }`}>
                                {pageState === 'completed' ? 'task_alt' : 'auto_fix_high'}
                            </span>
                            <p className="text-sm text-gray-400 font-medium">
                                {pageState === 'completed'
                                    ? 'Your video is ready!'
                                    : 'AI is processing your video...'}
                            </p>
                        </div>
                    </div>

                    {/* Pipeline Tracker */}
                    <PipelineTracker
                        videoId={activeVideoId}
                        onComplete={handlePipelineComplete}
                        onError={handlePipelineError}
                    />

                    {/* Back to upload */}
                    {pageState === 'completed' && (
                        <button
                            onClick={resetToUpload}
                            className="text-sm text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 underline transition-colors"
                        >
                            Upload another video
                        </button>
                    )}
                </div>
            )}

            {pageState === 'error' && (
                <div className="w-full max-w-[800px] flex flex-col items-center gap-6 py-16">
                    <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-4xl text-red-600 dark:text-red-400">error</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Pipeline Failed</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-md">{pipelineError}</p>
                    <div className="flex gap-3">
                        <button
                            onClick={resetToUpload}
                            className="px-6 h-11 border border-gray-300 dark:border-white/20 text-gray-700 dark:text-gray-300 font-bold rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-all"
                        >
                            Start Over
                        </button>
                        {activeVideoId && (
                            <button
                                onClick={async () => {
                                    try {
                                        await api.startPipeline([activeVideoId]);
                                        setPageState('processing');
                                        setPipelineError(null);
                                    } catch (err) {
                                        setPipelineError(err instanceof Error ? err.message : 'Retry failed');
                                    }
                                }}
                                className="px-6 h-11 bg-red-600 text-white font-bold rounded-full hover:bg-red-700 active:scale-95 transition-all flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined text-[18px]">refresh</span>
                                Retry
                            </button>
                        )}
                    </div>
                </div>
            )}
        </Shell>
    );
}
