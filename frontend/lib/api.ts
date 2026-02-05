const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export interface Video {
    id: string;
    original_filename: string;
    status: 'uploading' | 'completed' | 'failed' | 'processing';
    file_size_bytes?: number;
    created_at: string;
}

export const api = {
    async initiateUpload(filename: string, contentType: string) {
        const res = await fetch(`${API_URL}/uploads/initiate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename, content_type: contentType }),
        });
        if (!res.ok) throw new Error('Failed to initiate upload');
        return res.json() as Promise<{ upload_id: string; video_id: string; key: string }>;
    },

    async getPresignedUrl(videoId: string, uploadId: string, partNumber: number) {
        const res = await fetch(`${API_URL}/uploads/presigned-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ video_id: videoId, upload_id: uploadId, part_number: partNumber }),
        });
        if (!res.ok) throw new Error('Failed to get presigned URL');
        return res.json() as Promise<{ url: string }>;
    },

    async uploadChunk(url: string, chunk: Blob) {
        const res = await fetch(url, {
            method: 'PUT',
            body: chunk,
        });
        if (!res.ok) throw new Error('Chunk upload failed');
        return res.headers.get('ETag');
    },

    async completeUpload(videoId: string, uploadId: string, parts: { PartNumber: number; ETag: string }[]) {
        const res = await fetch(`${API_URL}/uploads/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ video_id: videoId, upload_id: uploadId, parts }),
        });
        if (!res.ok) throw new Error('Failed to complete upload');
        return res.json();
    },

    async listVideos() {
        const res = await fetch(`${API_URL}/uploads/my-videos`);
        if (!res.ok) throw new Error('Failed to fetch videos');
        return res.json() as Promise<Video[]>;
    },

    async getVideoDownloadUrl(videoId: string, disposition: 'inline' | 'attachment' = 'inline') {
        const res = await fetch(`${API_URL}/uploads/${videoId}/download?disposition=${disposition}`);
        if (!res.ok) throw new Error('Failed to fetch download URL');
        return res.json() as Promise<{ url: string }>;
    },

    async deleteVideo(videoId: string) {
        const res = await fetch(`${API_URL}/uploads/${videoId}`, {
            method: 'DELETE',
        });
        if (!res.ok) throw new Error('Failed to delete video');
        return res.json();
    },
};
