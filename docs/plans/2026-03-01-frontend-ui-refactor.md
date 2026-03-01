# Frontend UI Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the current Next.js frontend UI to match the clean, light-themed aesthetic of the `tkz-11/Video` repository while strictly preserving existing backend interactions and functions.

**Architecture:** We will update `globals.css` with the new style variables and animations. We will restructure the `Shell` layout to a header-only design (removing the Sidebar). We will rewrite `app/library/page.tsx` and `VideoRow.tsx` to mirror `storage.html`. We will create a new route `app/upload/page.tsx` and adapt the existing `VideoUploader.tsx` logic into it, mimicking the UI of `dashboard.html`.

**Tech Stack:** Next.js (App Router), React, Tailwind CSS, Lucide React (for icons), TanStack Query.

---

### Task 1: Update Global Styles and Layout

**Files:**
- Modify: `frontend/app/globals.css`
- Modify: `frontend/app/layout.tsx`

**Step 1: Write the failing test**
No tests for global CSS changes, visual verification will be used.

**Step 2: Run test to verify it fails**
N/A

**Step 3: Write minimal implementation**
1. Add CSS variables to `frontend/app/globals.css`:
```css
@theme {
  --color-primary: #CC0000;
  --color-action: #065FD4;
  --color-background: #F9F9F9;
  --color-surface: #FFFFFF;
  --color-border: #E5E5E5;
}

body {
  background-color: var(--color-background);
  color: #0F0F0F;
}

/* Add custom scrollbar and animations from template */
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #CCCCCC; border-radius: 10px; }

@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes slideIn { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@keyframes slideOut { from { transform: translateY(0); opacity: 1; } to { transform: translateY(-100%); opacity: 0; } }
```

2. Modify `frontend/app/layout.tsx` to remove the `dark` class from `html` and update the body class to `min-h-screen font-sans bg-[#F9F9F9]`.

**Step 4: Run test to verify it passes**
N/A

**Step 5: Commit**
```bash
git add frontend/app/globals.css frontend/app/layout.tsx
git commit -m "style: update global styles and layout to match target theme"
```

---

### Task 2: Refactor Shell and TopNav (Remove Sidebar)

**Files:**
- Modify: `frontend/components/Shell.tsx`
- Modify: `frontend/components/TopNav.tsx`
- Delete: `frontend/components/Sidebar.tsx`

**Step 1: Write the failing test**
Visual verification.

**Step 2: Run test to verify it fails**
N/A

**Step 3: Write minimal implementation**
1. In `frontend/components/TopNav.tsx`:
Implement the sticky header from `storage.html`.
```tsx
import Link from "next/link";
import { Search, Plus, Play } from "lucide-react";
// Implement exact structure with Red Play icon, "Studio Beta" logo, Search bar, and "New Project" button.
```

2. In `frontend/components/Shell.tsx`:
Remove the Sidebar entirely. The layout will just be the `TopNav` and the `main` content container `container mx-auto px-4 py-8 max-w-7xl`.
Remove the `UploadContext` and the Global Upload Modal Overlay, as we are moving upload to a dedicated route.

3. Delete `Sidebar.tsx`.

**Step 4: Run test to verify it passes**
N/A

**Step 5: Commit**
```bash
git rm frontend/components/Sidebar.tsx
git add frontend/components/Shell.tsx frontend/components/TopNav.tsx
git commit -m "refactor: simplify Shell layout and implement target TopNav"
```

---

### Task 3: Refactor Library Page & Video Row

**Files:**
- Modify: `frontend/app/library/page.tsx`
- Modify: `frontend/components/VideoRow.tsx`

**Step 1: Write the failing test**
Visual verification.

**Step 2: Run test to verify it fails**
N/A

**Step 3: Write minimal implementation**
1. In `frontend/app/library/page.tsx`:
Change the table layout to the grid layout `<div id="videoGrid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">` matching `storage.html`.
Implement the empty state exactly as in the template.

2. In `frontend/components/VideoRow.tsx`:
Instead of `<tr>`, render a card `<div className="group bg-white rounded-2xl border border-gray-100 shadow-sm...">`.
Keep the existing logic (`api.getVideoDownloadUrl`, `deleteMutation`, `handleDelete`).
Map the UI exactly to the card in `storage.html`. Replace Material Symbols with Lucide equivalents (e.g., `<Download>`, `<Trash>`).

**Step 4: Run test to verify it passes**
N/A

**Step 5: Commit**
```bash
git add frontend/app/library/page.tsx frontend/components/VideoRow.tsx
git commit -m "refactor: update library page and video row to grid layout"
```

---

### Task 4: Create Upload Page & Refactor VideoUploader

**Files:**
- Create: `frontend/app/upload/page.tsx`
- Modify: `frontend/components/VideoUploader.tsx` (or integrate fully into page)

**Step 1: Write the failing test**
Visual verification.

**Step 2: Run test to verify it fails**
N/A

**Step 3: Write minimal implementation**
1. Create `frontend/app/upload/page.tsx`:
```tsx
import Shell from "@/components/Shell";
import VideoUploader from "@/components/VideoUploader";

export default function UploadPage() {
    return (
        <Shell title="Upload Video">
            <VideoUploader />
        </Shell>
    );
}
```

2. Rewrite `frontend/components/VideoUploader.tsx`:
Keep ALL state logic (`file`, `uploading`, `progress`, `startUpload`, multipart chunk logic).
Replace the render output with the exact UI from `dashboard.html` (`#videoCard`, `#placeholderLayer`, `#progressOverlay`, `#errorOverlay`, `#processActionWrapper`).
Map state to UI:
- When `!file`: show `#placeholderLayer`
- When `file`: show `#previewVideo` and `#processActionWrapper`
- When `uploading`: show `#progressOverlay`
- Keep the SSE connection logic out, strictly use the existing multipart chunk functionality, but format the progress bar to match the template.

**Step 4: Run test to verify it passes**
Verify that `/upload` loads and file upload chunking still functions while displaying the new UI.

**Step 5: Commit**
```bash
git add frontend/app/upload/page.tsx frontend/components/VideoUploader.tsx
git commit -m "feat: implement /upload route with updated VideoUploader UI"
```
