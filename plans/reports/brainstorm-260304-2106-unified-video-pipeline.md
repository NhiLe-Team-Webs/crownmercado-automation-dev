# Brainstorming Report: Unified Video Processing Pipeline

## Problem Statement and Requirements
Currently, the system has several standalone features that function independently:
1. Multiple file upoads (via multipart/S3)
2. Strimming (video trimming / silence removal)
3. B-Roll Insertion
4. Text Highlighting (via Remotion)

**The Goal**: Connect these isolated features into a single, cohesive automated pipeline:
`Upload pipeline` -> `Merge raw footages` -> `Strimming` -> `B-roll insertion` -> `Text highlight (Remotion)` -> `Render & Download` -> `Final Video`.

### Constraints & Considerations
- **State Management**: Handling the state of a long-running pipeline is complex. If step 3 fails, we shouldn't have to re-do steps 1 and 2.
- **Resource Intensive**: Video processing steps (merging, trimming, rendering) consume heavy CPU/Memory.
- **Data Handoff**: Each step produces an intermediate artifact that the next step consumes. We need a standardized structured metadata definition passing between steps.
- **Remotion Integration**: Remotion requires a React environment to render, which is fundamentally different from Python/FFmpeg-based processing.

---

## Evaluated Approaches

### Approach 1: Monolithic Synchronous Pipeline (The "Quick & Dirty")
- **Concept**: A single API endpoint triggers a massive background Celery/Redis task that runs every step sequentially in a single giant function.
- **Pros**:
  - Very simple to implement initially.
  - Less cognitive overhead (no complex state machines).
- **Cons**:
  - **Violates YAGNI & KISS long-term**: Hard to maintain.
  - If a step fails (e.g., Remotion render times out), the entire pipeline fails, wasting all previous processing time.
  - Extremely difficult to scale (one worker gets locked for minutes/hours).
  - Hard to give real-time granular feedback to the frontend (e.g., "Currently adding B-Roll: 45%").

### Approach 2: Event-Driven Micro-Pipelines (Pub/Sub)
- **Concept**: Each step is an independent worker. Step 1 publishes "Merge Completed", Step 2 listens and starts "Strimming", etc.
- **Pros**:
  - Highly decoupled.
  - Easy to scale individual workers (e.g., scale Remotion workers separately from FFmpeg workers).
- **Cons**:
  - Hard to trace a single project's progress without a centralized orchestrator.
  - "Choreography" over "Orchestration" leads to complex debugging when events get lost.

### Approach 3: Orchestrator Pattern with State Machine (Recommended)
- **Concept**: A centralized `ProjectPipeline` orchestrator (using Celery chaining/chords or a custom state tracker in PostgreSQL) that explicitly manages transitions. 
  - *State Machine*: `UPLOADED` -> `MERGING` -> `STRIMMING` -> `BROLL_INSERTION` -> `REMOTION_RENDERING` -> `COMPLETED`.
- **Pros**:
  - **Resiliency**: Easy to retry a specific step (e.g., if Remotion fails, just restart from `BROLL_INSERTION` output).
  - **Observability**: Frontend can accurately track exact step progress.
  - **Standardized Handoff**: The Orchestrator manages passing the S3 path from Step A to Step B.
- **Cons**:
  - Requires setting up a robust state tracking table in the database.

---

## Final Recommended Solution: The Orchestrator Pattern (Pipeline State Controller)

We will use **Approach 3**. 

### Rationale
Video processing is fundamentally a DAG (Directed Acyclic Graph) of tasks. Managing it through explicit state tracking inside PostgreSQL combined with Celery for background execution strikes the perfect balance between maintainability, resilience, and UX (providing real-time progress).

### Implementation Architecture
1. **Database Entity (`VideoProject / PipelineState`)**:
   - `id`: UUID
   - `files`: JSONB (List of uploaded raw file S3 keys)
   - `current_step`: ENUM (`merging`, `strimming`, `broll`, `remotion`, `rendering`)
   - `status`: ENUM (`processing`, `failed`, `completed`)
   - `metadata`: JSONB (To pass data between steps, e.g., transcription timestamps for text highlighting).
   - `output_s3_key`: Final video path.

2. **The Pipeline Flow**:
   - **Upload**: User uploads files -> API marks project as `READY_FOR_MERGE`.
   - **Merge**: Worker pulls files, merges using FFmpeg -> outputs `merged_temp.mp4` to S3 -> Updates status to `READY_FOR_STRIM`.
   - **Strimming**: Worker pulls `merged_temp.mp4`, cuts silence/dead air -> outputs `strimmed_temp.mp4` to S3 -> Updates status.
   - **B-Roll**: Worker analyzes audio/text (if needed), overlays B-Roll -> outputs `broll_temp.mp4` -> Updates status.
   - **Text & Remotion**: Remotion worker takes `broll_temp.mp4`, renders text overlays -> outputs `final_video.mp4` to S3.
   - **Download**: Frontend polls system -> sees `COMPLETED` -> provides signed download URL.

---

## Implementation Considerations and Risks
- **Storage Avalanche**: Saving intermediate files (`merged_temp`, `strimmed_temp`) will explode S3 usage. 
  - *Mitigation*: Implement an automated S3 Lifecycle rule or a daily cleanup cron job to delete `*_temp.mp4` files after 24 hours.
- **Remotion Integration**: Running Remotion inside a Docker container (especially Alpine) requires installing Chromium/Puppeteer dependencies. This is often a massive pain point.
  - *Mitigation*: Ensure the worker Dockerfile has all necessary Chromium dependencies if doing server-side Remotion rendering.
- **Audio Sync**: Cutting video (Strimming) and then passing it to Remotion can cause audio/video desync if frame rates aren't strictly standardized.
  - *Mitigation*: Force explicit framerate (e.g., `-r 30`) and audio sample rate (`-ar 48000`) during the Merge step.

---

## Success Metrics and Validation Criteria
- **End-to-End Success**: User can upload 3 short clips, wait, and download a single final video featuring cuts, b-rolls, and text highlights.
- **Resiliency**: If a pipeline fails at the Remotion stage, it can be re-triggered without needing to re-upload or re-merge the raw files.
- **Progress Tracking**: UI correctly displays which of the 5 phases the pipeline is currently executing.

---

## Next Steps and Dependencies
1. Review this brainstorm and confirm if the Orchestrator approach fits your vision.
2. If yes, we need to create a detailed **Implementation Plan** which will:
   - Define the database schema modifications (`Pipeline` table).
   - Define the explicit Celery task chain structure.
   - Standardize the JSON metadata payload passed to Remotion.
