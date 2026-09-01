# Domain docs

Engineering skills use this repo’s domain documentation when exploring the codebase.

## Before exploring

Read the domain documents relevant to the work:

- `CONTEXT.md` at the repo root.
- ADRs under `docs/adr/` that affect the area being changed.

Proceed silently when these files do not exist. The domain-modeling skill creates them when the project resolves terms or architectural decisions.

## File structure

This repo uses a single-context layout:

```text
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-example-decision.md
│   └── 0002-another-decision.md
└── src/
```

## Use the glossary’s vocabulary

Use terms defined in `CONTEXT.md` when naming domain concepts in issues, proposals, hypotheses, and tests.

If a needed concept is missing, first check whether the project already uses another term. Record genuine vocabulary gaps for the domain-modeling skill.

## Flag ADR conflicts

Call out any proposal that conflicts with an existing ADR:

> _Contradicts ADR-0007 (event-sourced orders), but may justify reopening the decision because…_
