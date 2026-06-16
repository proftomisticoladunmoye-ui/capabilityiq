# Contributing & repository workflow

## Local development
```bash
npm install
npm test          # run the suite (data layer, auth/RBAC, HCI, analytics)
npm start         # http://localhost:3000 (JSON store, no DB needed)
```
CI runs `npm ci && npm test` on Node 20 and 22 for every push and pull request to
`main` (see [.github/workflows/ci.yml](.github/workflows/ci.yml)).

---

## Protecting the `main` branch

Branch protection makes `main` un-mergeable until CI is green. It is enabled in the
**GitHub web UI** (or API) — it can't live in the repo itself.

### Important first step
Status checks only appear in the settings **after the workflow has run at least once**.
Push once (already done) so the checks `test (Node 20.x)` and `test (Node 22.x)` are
known to GitHub, then configure protection.

### Enable it (web UI)
1. Repo → **Settings → Branches → Add branch ruleset** (or *Add classic branch
   protection rule*).
2. Branch name pattern: `main`.
3. Enable **Require status checks to pass before merging**, then search and add:
   - `test (Node 20.x)`
   - `test (Node 22.x)`
4. Enable **Require branches to be up to date before merging** (re-runs CI on the
   latest `main` before a merge is allowed).
5. Recommended extras:
   - **Require a pull request before merging** (blocks direct pushes to `main`).
   - **Do not allow bypassing the above settings** / *Include administrators* (so the
     rules apply to everyone, including you).
6. Save.

### Enable it via the GitHub CLI (optional)
With `gh` installed and authenticated, save this as `protection.json`:
```json
{
  "required_status_checks": {
    "strict": true,
    "checks": [
      { "context": "test (Node 20.x)" },
      { "context": "test (Node 22.x)" }
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": { "required_approving_review_count": 0 },
  "restrictions": null
}
```
then:
```bash
gh api -X PUT \
  repos/proftomisticoladunmoye-ui/capabilityiq/branches/main/protection \
  --input protection.json
```

---

## Solo-developer note — choose your workflow

Requiring a pull request **stops you pushing straight to `main`**. Pick the model that
fits how you work:

- **Lightweight (current):** keep pushing to `main`. CI still runs on every push and the
  README badge shows red if something breaks. Simplest for one person. *Either skip branch
  protection, or enable only "require status checks" without "require a pull request".*
- **Protected (team-ready):** require PRs + status checks. Day-to-day becomes:
  ```bash
  git checkout -b feature/my-change
  # ...commit...
  git push -u origin feature/my-change
  gh pr create --fill          # or open the PR in the browser
  # merge once CI is green
  ```

If you're working alone, the lightweight model is usually enough; turn on full protection
when other contributors join.
