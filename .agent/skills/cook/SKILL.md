---
name: cook
description: ALWAYS activate this skill before implementing EVERY feature, plan, or fix.
version: 2.1.1
---

# Cook - Smart Feature Implementation

End-to-end implementation with automatic workflow detection.

**Principles:** YAGNI, KISS, DRY | Token efficiency | Concise reports

## Usage

```
/cook <natural language task OR plan path>
```

**IMPORTANT:** If no flag is provided, the skill will use the `interactive` mode by default for the workflow.

**Optional flags to select the workflow mode:** 
- `--interactive`: Full workflow with user input (**default**)
- `--fast`: Skip research, scout→plan→code
- `--parallel`: Multi-agent execution
- `--no-test`: Skip testing step
- `--auto`: Auto-approve all steps

**Example:**
```
/cook "Add user authentication to the app" --fast
/cook path/to/plan.md --auto
```

## Smart Intent Detection

| Input Pattern | Detected Mode | Behavior |
|---------------|---------------|----------|
| Path to `plan.md` or `phase-*.md` | code | Execute existing plan |
| Contains "fast", "quick" | fast | Skip research, scout→plan→code |
| Contains "trust me", "auto" | auto | Auto-approve all steps |
| Lists 3+ features OR "parallel" | parallel | Multi-agent execution |
| Contains "no test", "skip test" | no-test | Skip testing step |
| Default | interactive | Full workflow with user input |

See `resources/intent-detection.md` for detection logic.

## Workflow Overview

```
[Intent Detection] → [Research?] → [Review] → [Plan] → [Review] → [Implement] → [Review] → [Test?] → [Review] → [Finalize]
```

**Default (non-auto):** Stops at `[Review]` gates for human approval before each major step.
**Auto mode (`--auto`):** Skips human review gates, implements all phases continuously.
**Claude Tasks:** Utilize all these tools `TaskCreate`, `TaskUpdate`, `TaskGet` and `TaskList` during implementation step.

| Mode | Research | Testing | Review Gates | Phase Progression |
|------|----------|---------|--------------|-------------------|
| interactive | ✓ | ✓ | **User approval at each step** | One at a time |
| auto | ✓ | ✓ | Auto if score≥9.5 | All at once (no stops) |
| fast | ✗ | ✓ | **User approval at each step** | One at a time |
| parallel | Optional | ✓ | **User approval at each step** | Parallel groups |
| no-test | ✓ | ✗ | **User approval at each step** | One at a time |
| code | ✗ | ✓ | **User approval at each step** | Per plan |

## Step Output Format

```
✓ Step [N]: [Brief status] - [Key metrics]
```

## Blocking Gates (Non-Auto Mode)

Human review required at these checkpoints (skipped with `--auto`):
- **Post-Research:** Review findings before planning
- **Post-Plan:** Approve plan before implementation
- **Post-Implementation:** Approve code before testing
- **Post-Testing:** 100% pass + approve before finalize

**Always enforced (all modes):**
- **Testing:** 100% pass required (unless no-test mode)
- **Code Review:** User approval OR auto-approve (score≥9.5, 0 critical)
- **Finalize (MANDATORY - never skip):**
  1. `.agent/agents/agent-project-manager/agent-project-manager.md` instructions → update plan/phase status to complete
  2. `.agent/agents/agent-docs-manager/agent-docs-manager.md` instructions → update `./docs` if changes warrant
  3. `TaskUpdate` → mark all Claude Tasks complete
  4. Ask user if they want to commit via `.agent/agents/agent-git-manager/agent-git-manager.md` instructions

## Required Subagents (MANDATORY)

| Phase | Subagent | Requirement |
|-------|----------|-------------|
| Research | `.agent/agents/agent-researcher/agent-researcher.md` | Optional in fast/code |
| Scout | `scout` | Optional in code |
| Plan | `.agent/agents/agent-planner/agent-planner.md` | Optional in code |
| UI Work | `.agent/agents/agent-ui-ux-designer/agent-ui-ux-designer.md` | If frontend work |
| Testing | `.agent/agents/agent-tester/agent-tester.md`, `.agent/agents/agent-debugger/agent-debugger.md` | **MUST** spawn |
| Review | `.agent/agents/agent-code-reviewer/agent-code-reviewer.md` | **MUST** spawn |
| Finalize | `.agent/agents/agent-project-manager/agent-project-manager.md`, `.agent/agents/agent-docs-manager/agent-docs-manager.md`, `.agent/agents/agent-git-manager/agent-git-manager.md` | **MUST** spawn all 3 |

**CRITICAL ENFORCEMENT:**
- Steps 4, 5, 6 **MUST** use Task tool to spawn subagents
- DO NOT implement testing, review, or finalization yourself - DELEGATE
- If workflow ends with 0 Task tool calls, it is INCOMPLETE
- Pattern: `Task(subagent_type="[type]", prompt="[task]", description="[brief]")`

## References

- `resources/intent-detection.md` - Detection rules and routing logic
- `resources/workflow-steps.md` - Detailed step definitions for all modes
- `resources/review-cycle.md` - Interactive and auto review processes
- `resources/subagent-patterns.md` - Subagent invocation patterns
