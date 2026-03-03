---
description: "File Naming Conventions"
activation: model_decision — Apply when creating or renaming files
source: "Converted from CK hook: descriptive-name.cjs"
---

# File Naming Conventions

When creating files:
- Skip this guidance for markdown or plain text files
- Prefer kebab-case for JS/TS/Python/shell (.js, .ts, .py, .sh) with descriptive names
- Respect language conventions: C#/Java/Kotlin/Swift use PascalCase, Go/Rust use snake_case
- Other languages: follow their ecosystem's standard naming convention
- Goal: self-documenting names readable by LLM tools (Grep, Glob, Search)
