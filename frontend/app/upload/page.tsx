'use client';

import Shell from "@/components/Shell";
import VideoUploader from "@/components/VideoUploader";

export default function UploadPage() {
    return (
        <Shell title="Upload Video">
            <div className="flex-1 flex items-center justify-center p-8">
                <VideoUploader onUploadComplete={(id) => { console.log("Upload completed", id); }} />
            </div>
        </Shell>
    );
}
