'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Agentation } from 'agentation';

export default function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 60 * 1000,
                    },
                },
            })
    );

    return (
        <QueryClientProvider client={queryClient}>
            {children}
            {process.env.NODE_ENV === 'development' && (
                <Agentation
                    endpoint="http://localhost:4747"
                    onError={(error) => {
                        // Silently handle connection errors to avoid console spam
                        // React DevTools server may not be running
                        if (process.env.NODE_ENV === 'development') {
                            // Optionally log once to console that devtools aren't connected
                            if (!window.__AGENTATION_ERROR_LOGGED__) {
                                console.info('Agentation: React DevTools server not detected on port 4747. To enable React DevTools, run: npx react-devtools');
                                window.__AGENTATION_ERROR_LOGGED__ = true;
                            }
                        }
                    }}
                />
            )}
        </QueryClientProvider>
    );
}
