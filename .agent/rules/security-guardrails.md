---
description: "Security Guardrails"
activation: always_on
source: "Converted from CK hook: privacy-block.cjs"
---

# Security Guardrails

Never read sensitive files without explicit user permission:
- .env, .env.*, .env.local
- credentials.json, secrets.*, *-credentials.*
- Private keys (*.pem, *.key, id_rsa*)
- Config files with API keys or tokens

If you need to access a potentially sensitive file, ask the user first.
Do NOT commit sensitive files to git.
