---
description: "Code Quality Workflow"
activation: model_decision — Apply after multiple file edits in a session
source: "Converted from CK hook: post-edit-simplify-reminder.cjs"
---

# Code Quality Workflow

After making significant code changes (5+ file edits):
1. Review modified files for simplification opportunities
2. Check for DRY violations (duplicated code)
3. Ensure YAGNI compliance (no unnecessary abstractions)
4. Verify KISS (simplest solution that works)
5. Consider running code review before committing
