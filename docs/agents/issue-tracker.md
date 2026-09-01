# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multiline bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments with `jq` and fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with suitable `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply or remove labels**: `gh issue edit <number> --add-label "..."` or `--remove-label "..."`
- **Close an issue**: `gh issue close <number> --comment "..."`

Infer the repository from `git remote -v`. The `gh` CLI does this automatically inside the clone.

## Pull requests as a triage surface

**PRs as a request surface: no.**

When set to `yes`, PRs use the same labels and states as issues:

- **Read a PR**: `gh pr view <number> --comments` and `gh pr diff <number>`.
- **List external PRs for triage**: `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments`, keeping only `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR`, and `NONE` author associations.
- **Comment, label, or close**: use `gh pr comment`, `gh pr edit`, or `gh pr close`.

GitHub shares one number space across issues and PRs. Resolve a bare `#42` with `gh pr view 42`, then fall back to `gh issue view 42`.

## When a skill says “publish to the issue tracker”

Create a GitHub issue.

## When a skill says “fetch the relevant ticket”

Run `gh issue view <number> --comments`.

## Wayfinding operations

The `/wayfinder` skill uses one map issue with child issues as tickets.

- **Map**: create one issue labeled `wayfinder:map`. Its body holds Notes, Decisions so far, and Fog.
- **Child ticket**: link an issue to the map as a GitHub sub-issue. If sub-issues are unavailable, add the child to a task list in the map and put `Part of #<map>` at the top of the child body. Apply a `wayfinder:<type>` label: `research`, `prototype`, `grilling`, or `task`.
- **Blocking**: use GitHub’s native issue dependencies. Add an edge with `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`. Fetch the numeric database ID with `gh api repos/<owner>/<repo>/issues/<n> --jq .id`. If dependencies are unavailable, put `Blocked by: #<n>, #<n>` at the top of the child body.
- **Frontier query**: list the map’s open children, excluding assigned issues and issues with open blockers. The first issue in map order wins.
- **Claim**: run `gh issue edit <n> --add-assignee @me` as the session’s first write.
- **Resolve**: comment with the answer, close the issue, and append a context pointer to the map’s Decisions so far.
