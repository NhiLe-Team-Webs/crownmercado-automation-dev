'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api, PipelineStatus } from '@/lib/api';

interface PipelineTrackerProps {
    videoId: string;
    onComplete?: () => void;
    onError?: (error: string) => void;
}

const PIPELINE_STEPS = [
    { key: 'merging', label: 'Merging', icon: 'merge_type', desc: 'Combining raw footage' },
    { key: 'strimming', label: 'Strimming', icon: 'content_cut', desc: 'Removing silence' },
    { key: 'inserting_broll', label: 'B-Roll', icon: 'movie_filter', desc: 'Inserting B-Roll clips' },
    { key: 'rendering_remotion', label: 'Rendering', icon: 'auto_awesome', desc: 'Adding text overlays' },
    { key: 'completed', label: 'Done', icon: 'check_circle', desc: 'Ready to download' },
];

const POLL_INTERVAL = 3000; // 3 seconds

export default function PipelineTracker({ videoId, onComplete, onError }: PipelineTrackerProps) {
    const [status, setStatus] = useState<PipelineStatus | null>(null);
    const [polling, setPolling] = useState(true);

    const fetchStatus = useCallback(async () => {
        try {
            const data = await api.getPipelineStatus(videoId);
            setStatus(data);

            if (data.pipeline_status === 'completed') {
                setPolling(false);
                onComplete?.();
            } else if (data.pipeline_status === 'failed') {
                setPolling(false);
                onError?.(data.pipeline_error || 'Pipeline failed');
            }
        } catch {
            // Retry silently on network errors
        }
    }, [videoId, onComplete, onError]);

    useEffect(() => {
        fetchStatus(); // Initial fetch
        if (!polling) return;

        const interval = setInterval(fetchStatus, POLL_INTERVAL);
        return () => clearInterval(interval);
    }, [fetchStatus, polling]);

    const currentStepIndex = status
        ? PIPELINE_STEPS.findIndex(s => s.key === status.pipeline_status)
        : 0;

    const isFailed = status?.pipeline_status === 'failed';
    const isCompleted = status?.pipeline_status === 'completed';

    return (
        <div className="w-full max-w-[640px] mx-auto">
            {/* Header */}
            <div className="text-center mb-8">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                    {isFailed ? 'Processing Failed' : isCompleted ? 'Processing Complete!' : 'Processing Your Video'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {status?.original_filename ?? 'Loading...'}
                </p>
            </div>

            {/* Stepper */}
            <div className="flex flex-col gap-0">
                {PIPELINE_STEPS.map((step, idx) => {
                    const isActive = idx === currentStepIndex && !isFailed && !isCompleted;
                    const isDone = idx < currentStepIndex || isCompleted;
                    const isCurrent = idx === currentStepIndex;
                    const isPending = idx > currentStepIndex && !isCompleted;
                    const isFailedStep = isFailed && isCurrent;

                    return (
                        <div key={step.key} className="flex items-stretch gap-4">
                            {/* Vertical line + circle */}
                            <div className="flex flex-col items-center w-10 shrink-0">
                                <div
                                    className={`
                                        w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all duration-500
                                        ${isDone
                                            ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                                            : isFailedStep
                                                ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                                                : isActive
                                                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30 animate-pulse'
                                                    : 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gray-600'
                                        }
                                    `}
                                >
                                    <span className="material-symbols-outlined text-[20px]">
                                        {isDone ? 'check' : isFailedStep ? 'close' : step.icon}
                                    </span>
                                </div>
                                {/* Connector line */}
                                {idx < PIPELINE_STEPS.length - 1 && (
                                    <div className={`w-0.5 flex-1 min-h-[32px] transition-colors duration-500 ${isDone ? 'bg-green-500' : 'bg-gray-200 dark:bg-white/10'}`} />
                                )}
                            </div>

                            {/* Step content */}
                            <div className={`pb-6 pt-2 transition-opacity duration-300 ${isPending ? 'opacity-40' : 'opacity-100'}`}>
                                <p className={`text-sm font-bold tracking-tight ${isDone
                                        ? 'text-green-600 dark:text-green-400'
                                        : isFailedStep
                                            ? 'text-red-600 dark:text-red-400'
                                            : isActive
                                                ? 'text-blue-600 dark:text-blue-400'
                                                : 'text-gray-500 dark:text-gray-500'
                                    }`}>
                                    {step.label}
                                    {isActive && (
                                        <span className="inline-flex ml-2">
                                            <span className="w-1 h-1 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <span className="w-1 h-1 rounded-full bg-blue-500 animate-bounce ml-0.5" style={{ animationDelay: '150ms' }} />
                                            <span className="w-1 h-1 rounded-full bg-blue-500 animate-bounce ml-0.5" style={{ animationDelay: '300ms' }} />
                                        </span>
                                    )}
                                </p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                    {isFailedStep ? status?.pipeline_error : step.desc}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Failed state: Retry button */}
            {isFailed && (
                <div className="mt-4 flex flex-col items-center gap-3 animate-in fade-in duration-300">
                    <button
                        onClick={async () => {
                            try {
                                await api.startPipeline(videoId);
                                setPolling(true);
                            } catch (err) {
                                onError?.(err instanceof Error ? err.message : 'Retry failed');
                            }
                        }}
                        className="px-8 h-12 bg-red-600 hover:bg-red-700 text-white font-bold rounded-full shadow-lg shadow-red-500/20 active:scale-95 transition-all flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-[20px]">refresh</span>
                        Retry Pipeline
                    </button>
                    <p className="text-xs text-gray-400">Pipeline will resume from last successful step</p>
                </div>
            )}

            {/* Completed state: Download button */}
            {isCompleted && (
                <div className="mt-4 flex flex-col items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <button
                        onClick={async () => {
                            try {
                                const { url } = await api.getVideoDownloadUrl(videoId, 'attachment');
                                window.location.assign(url);
                            } catch {
                                // Silently fail
                            }
                        }}
                        className="px-10 h-14 bg-green-600 hover:bg-green-700 text-white font-bold rounded-full shadow-2xl shadow-green-500/30 active:scale-[0.98] transition-all flex items-center gap-3 tracking-wider"
                    >
                        <span className="material-symbols-outlined text-2xl">download</span>
                        Download Final Video
                    </button>
                </div>
            )}
        </div>
    );
}
