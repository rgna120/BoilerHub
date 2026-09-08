# BoilerHub

Unified dashboard for Purdue students consolidating Brightspace, Gradescope, and Purdue Dining.

## Setup Instructions

1. Run `npm install`
2. Initialize database: `npx prisma db push` (Requires a postgres connection string in `.env`)
3. Run dev server: `npm run dev`

## GitHub Initialization

Run these commands in the terminal of the unzipped folder:

```bash
git init
git add .
git commit -m "Initial BoilerHub commit"
git branch -M main
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin main
```
