'use client';

import Shell from "@/components/Shell";
import VideoUploader from "@/components/VideoUploader";

export default function UploadPage() {
    return (
        <Shell title="Upload Video">
            <VideoUploader
                onUploadComplete={(id: string) => console.log("File completed", id)}
                onBatchComplete={(ids: string[]) => console.log("Batch completed", ids)}
            />
        </Shell>
    );
}
