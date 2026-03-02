
## Conversion Notes

Converted from Claude Code via cc2ag. Some features are not available in Antigravity:
- Dynamic context injection (session env vars) — use static rules instead
- Subagent tool restrictions — AG doesn't restrict tools per agent
- Token/context tracking — no equivalent in AG
- Team coordination — AG Agent Manager is session overview only

## Hook-Based Rules

The following rules were converted from Claude Code hooks and need manual activation:

| Rule File | Recommended Mode | Purpose |
|-----------|-----------------|---------|
| `security-guardrails.md` | Always On | Block sensitive file access |
| `naming-conventions.md` | Model Decision | Enforce file naming standards |
| `code-quality-workflow.md` | Model Decision | Post-edit simplification reminders |

Set activation modes via: Customizations panel → Rules → Edit each rule.
