'use client';

import Shell from "@/components/Shell";
import VideoUploader from "@/components/VideoUploader";

export default function UploadPage() {
    return (
        <Shell title="Upload Video">
            <VideoUploader onUploadComplete={(id) => { console.log("Upload completed", id); }} />
        </Shell>
    );
}
