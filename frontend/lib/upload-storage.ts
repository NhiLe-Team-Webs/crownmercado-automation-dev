import { openDB, IDBPDatabase } from 'idb';

export interface UploadPart {
    PartNumber: number;
    ETag: string;
}

export interface UploadState {
    fileId: string;
    fileName: string;
    fileSize: number;
    fileHash: string; // Used to identify the same file
    uploadId: string;
    video_id: string; // The UUID from backend
    key: string;      // The S3 key
    parts: UploadPart[]; // Store part numbers and their ETags
    totalChunks: number;
    lastUpdated: number;
}

const DB_NAME = 'one-click-video-uploads';
const STORE_NAME = 'pending-uploads';
const DB_VERSION = 2; // Incremented version to handle schema change

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
    if (!dbPromise) {
        dbPromise = openDB(DB_NAME, DB_VERSION, {
            upgrade(db, oldVersion) {
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'fileId' });
                } else if (oldVersion < 2) {
                    // Migration: In old version we didn't have parts array
                    // We can't really restore ETags from old version, so we just clear it
                    // or let it crash and restart. Clearing is safer.
                    db.deleteObjectStore(STORE_NAME);
                    db.createObjectStore(STORE_NAME, { keyPath: 'fileId' });
                }
            },
        });
    }
    return dbPromise;
}

export const uploadStorage = {
    async saveUpload(state: UploadState) {
        const db = await getDB();
        await db.put(STORE_NAME, {
            ...state,
            lastUpdated: Date.now(),
        });
    },

    async getUpload(fileId: string): Promise<UploadState | undefined> {
        const db = await getDB();
        return db.get(STORE_NAME, fileId);
    },

    async getAllUploads(): Promise<UploadState[]> {
        const db = await getDB();
        return db.getAll(STORE_NAME);
    },

    async removeUpload(fileId: string) {
        const db = await getDB();
        await db.delete(STORE_NAME, fileId);
    },

    async updatePart(fileId: string, part: UploadPart) {
        const upload = await this.getUpload(fileId);
        if (upload) {
            const existingIndex = upload.parts.findIndex(p => p.PartNumber === part.PartNumber);
            if (existingIndex > -1) {
                upload.parts[existingIndex] = part;
            } else {
                upload.parts.push(part);
            }
            await this.saveUpload(upload);
        }
    },

    async clearObsoleteUploads(maxAgeDays = 7) {
        const db = await getDB();
        const all = await this.getAllUploads();
        const now = Date.now();
        const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;

        for (const upload of all) {
            if (now - upload.lastUpdated > maxAge) {
                await this.removeUpload(upload.fileId);
            }
        }
    },
};
