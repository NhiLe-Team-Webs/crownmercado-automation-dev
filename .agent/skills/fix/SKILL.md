---
name: fix
description: ALWAYS activate this skill before fixing ANY bug, error, test failure, CI/CD issue, type error, lint, log error, UI issue, code problem.
version: 1.1.1
---

# Fixing

Unified skill for fixing issues of any complexity with intelligent routing.

## Arguments

- `--auto` - Activate autonomous mode (**default**)
- `--review` - Activate human-in-the-loop review mode
- `--quick` - Activate quick mode
- `--parallel` - Activate parallel mode: route to parallel `.agent/agents/agent-fullstack-developer/agent-fullstack-developer.md` agents per issue

## Workflow

### Step 1: Mode Selection

**First action:** If there is no "auto" keyword in the request, use `AskUserQuestion` to determine workflow mode:

| Option | Recommend When | Behavior |
|--------|----------------|----------|
| **Autonomous** (default) | Simple/moderate issues | Auto-approve if score >= 9.5 & 0 critical |
| **Human-in-the-loop Review** | Critical/production code | Pause for approval at each step |
| **Quick** | Type errors, lint, trivial bugs | Fast debug → fix → review cycle |

See `resources/mode-selection.md` for AskUserQuestion format.

### Step 2: Debug

- Activate `debug` skill.
- Guess all possible root causes.
- Spawn multiple `Explore` subagents in parallel to verify each hypothesis.
- Create report with all findings for the next step.

### Step 3: Complexity Assessment & Fix Implementation

Classify before routing. See `resources/complexity-assessment.md`.

| Level | Indicators | Workflow |
|-------|------------|----------|
| **Simple** | Single file, clear error, type/lint | `resources/workflow-quick.md` |
| **Moderate** | Multi-file, root cause unclear | `resources/workflow-standard.md` |
| **Complex** | System-wide, architecture impact | `resources/workflow-deep.md` |
| **Parallel** | 2+ independent issues OR `--parallel` flag | Parallel `.agent/agents/agent-fullstack-developer/agent-fullstack-developer.md` agents |

### Step 4: Fix Verification & Prevent Future Issues

- Read and analyze all the implemented changes.
- Spawn multiple `Explore` subagents to find possible related code for verification.
- Make sure these fixes don't break other parts of the codebase.
- Prevent future issues by adding comprehensive validation.

### Step 5: Finalize (MANDATORY - never skip)

1. Report summary: confidence score, changes, files
2. `.agent/agents/agent-docs-manager/agent-docs-manager.md` instructions → update `./docs` if changes warrant (NON-OPTIONAL)
3. `TaskUpdate` → mark all Claude Tasks complete
4. Ask user if they want to commit via `.agent/agents/agent-git-manager/agent-git-manager.md` instructions

---

## IMPORTANT: Skill/Subagent Activation Matrix

See `resources/activation-matrix.md` for complete matrix.

**Always activate:** `debug` (all workflows)
**Conditional:** `problem-solving`, `sequential-thinking`, `brainstorm`, `context-engineering`
**Subagents:** `.agent/agents/agent-debugger/agent-debugger.md`, `.agent/agents/agent-researcher/agent-researcher.md`, `.agent/agents/agent-planner/agent-planner.md`, `.agent/agents/agent-code-reviewer/agent-code-reviewer.md`, `.agent/agents/agent-tester/agent-tester.md`, `Bash`
**Parallel:** Multiple `Explore` agents for scouting, `Bash` agents for verification

## Output Format

Unified step markers:
```
✓ Step 0: [Mode] selected - [Complexity] detected
✓ Step 1: Root cause identified - [summary]
✓ Step 2: Fix implemented - [N] files changed
✓ Step 3: Tests [X/X passed]
✓ Step 4: Review [score]/10 - [status]
✓ Step 5: Complete - [action taken]
```

## References

Load as needed:
- `resources/mode-selection.md` - AskUserQuestion format for mode
- `resources/complexity-assessment.md` - Classification criteria
- `resources/workflow-quick.md` - Quick: debug → fix → review
- `resources/workflow-standard.md` - Standard: full pipeline
- `resources/workflow-deep.md` - Deep: research + brainstorm + plan
- `resources/review-cycle.md` - Review logic (autonomous vs HITL)
- `resources/activation-matrix.md` - When to activate each skill
- `resources/parallel-exploration.md` - Parallel Explore/Bash subagents patterns

**Specialized Workflows:**
- `resources/workflow-ci.md` - GitHub Actions/CI failures
- `resources/workflow-logs.md` - Application log analysis
- `resources/workflow-test.md` - Test suite failures
- `resources/workflow-types.md` - TypeScript type errors
- `resources/workflow-ui.md` - Visual/UI issues (requires design skills)
