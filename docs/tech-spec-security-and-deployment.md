# Technical Spec: API Key Security & Automated Deployment

**Status:** Draft
**Created:** 2025-12-26
**Target Environment:** Google Cloud Run (us-west1)
**Live URL:** https://karaoke-syncer-362554121203.us-west1.run.app/

---

## Overview

This document outlines the work needed to:
1. Secure the exposed Gemini API key
2. Set up continuous deployment from GitHub to Cloud Run

These changes are interdependent—the security fix must be completed before enabling automated deployments.

---

## Part 1: API Key Security

### Current State

- The `GEMINI_API_KEY` is referenced in `vite.config.ts` via `process.env.GEMINI_API_KEY`
- The key may be committed to git history (requires verification)
- The deployed Cloud Run service has the key configured (method unknown—likely environment variable or hardcoded)

### Required Actions

#### 1.1 Rotate the API Key (Immediate)

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey) or Google Cloud Console
2. Create a new API key
3. Delete/revoke the old API key
4. Update the Cloud Run service with the new key (temporary manual step)

#### 1.2 Verify No Hardcoded Keys in Codebase

Search the codebase for any hardcoded API keys:
```bash
grep -r "AIza" .  # Google API keys start with AIza
grep -r "API_KEY.*=" --include="*.ts" --include="*.tsx" .
```

Files to check:
- `vite.config.ts` - currently references `process.env.GEMINI_API_KEY`
- `services/geminiService.ts` - uses the API key
- `index.html` - should not contain keys

#### 1.3 Scrub Git History (If Keys Found)

If keys are found in git history:

**Option A: BFG Repo-Cleaner (recommended)**
```bash
# Install BFG
brew install bfg

# Create a file with secrets to remove
echo "YOUR_OLD_API_KEY" > secrets.txt

# Run BFG
bfg --replace-text secrets.txt

# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push (destructive - coordinate with any collaborators)
git push --force
```

**Option B: Accept the risk**
- Since the key will be rotated, the old key in history is harmless
- Just ensure the new key is never committed

#### 1.4 Set Up Local Development Environment

Create `.env.local` (already in `.gitignore`):
```
GEMINI_API_KEY=your_new_api_key_here
```

Update `vite.config.ts` to load from `.env.local`:
```typescript
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    server: {
      port: 3000,
      host: '0.0.0.0'
    }
  }
})
```

#### 1.5 Document the Setup

Add to README.md:
```markdown
## Local Development

1. Copy `.env.example` to `.env.local`
2. Add your Gemini API key to `.env.local`
3. Run `npm run dev`
```

Create `.env.example`:
```
GEMINI_API_KEY=your_api_key_here
```

---

## Part 2: Automated Deployment Setup

### Architecture

```
GitHub (main branch)
    │
    ▼ (push triggers)
Cloud Build
    │
    ▼ (builds container)
Artifact Registry
    │
    ▼ (deploys)
Cloud Run Service
    │
    └── Environment: GEMINI_API_KEY (from Secret Manager)
```

### Prerequisites

- [ ] Google Cloud project with billing enabled
- [ ] Cloud Run API enabled
- [ ] Cloud Build API enabled
- [ ] Secret Manager API enabled
- [ ] GitHub repository access

### Implementation Steps

#### 2.1 Store API Key in Secret Manager

```bash
# Create the secret
echo -n "YOUR_API_KEY" | gcloud secrets create gemini-api-key \
    --replication-policy="automatic" \
    --data-file=-

# Grant Cloud Run access to the secret
gcloud secrets add-iam-policy-binding gemini-api-key \
    --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
```

#### 2.2 Prepare Project for Cloud Buildpacks

The project needs a production server to serve built static files.

**Add dependencies:**
```bash
npm install serve --save
```

**Update package.json:**
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "start": "serve dist -s -l 8080"
  }
}
```

**Add Procfile (optional but explicit):**
```
web: npm run start
```

#### 2.3 Configure Cloud Run Continuous Deployment

1. Navigate to [Cloud Run Console](https://console.cloud.google.com/run)
2. Select service: `karaoke-syncer`
3. Click **"Set up continuous deployment"**
4. Authenticate with GitHub
5. Select repository and branch (`main`)
6. Build configuration:
   - **Build type:** Google Cloud Buildpacks
   - **Build context:** `/` (repository root)
7. Save and deploy

#### 2.4 Configure Environment Variables

In Cloud Run service settings:

1. Go to **"Edit & Deploy New Revision"**
2. Under **"Container, Networking, Security"** → **"Variables & Secrets"**
3. Add secret reference:
   - **Name:** `GEMINI_API_KEY`
   - **Secret:** `gemini-api-key`
   - **Version:** `latest`

#### 2.5 Verify Deployment Pipeline

1. Make a test commit to `main`:
   ```bash
   git commit --allow-empty -m "test: trigger deployment pipeline"
   git push origin main
   ```
2. Monitor Cloud Build: https://console.cloud.google.com/cloud-build/builds
3. Verify new revision in Cloud Run
4. Test the live application

---

## Part 3: Implementation Checklist

### Phase 1: Security (Do First)
- [ ] Rotate Gemini API key in Google Cloud Console
- [ ] Update Cloud Run with new key (manual, temporary)
- [ ] Verify no hardcoded keys in current codebase
- [ ] Decide on git history scrubbing approach
- [ ] Create `.env.example` file
- [ ] Update `vite.config.ts` to use `loadEnv`
- [ ] Test local development with `.env.local`

### Phase 2: Deployment Automation
- [ ] Enable required Google Cloud APIs
- [ ] Create secret in Secret Manager
- [ ] Add `serve` dependency to package.json
- [ ] Add `start` script to package.json
- [ ] Connect GitHub repo to Cloud Run
- [ ] Configure build settings
- [ ] Add secret reference to Cloud Run environment
- [ ] Test end-to-end deployment
- [ ] Document deployment process in README

---

## Rollback Plan

If deployment automation causes issues:

1. Disable continuous deployment in Cloud Run console
2. Deploy manually:
   ```bash
   gcloud run deploy karaoke-syncer \
       --source . \
       --region us-west1 \
       --set-secrets GEMINI_API_KEY=gemini-api-key:latest
   ```

---

## Security Considerations

- API keys are never committed to the repository
- Secrets are managed via Google Secret Manager
- Cloud Build service account has minimal required permissions
- Branch protection on `main` recommended to prevent unauthorized deployments

---

## Future Improvements

- Add staging environment (deploy from `develop` branch)
- Add build status badge to README
- Configure Slack/email notifications for failed builds
- Add automated tests to run before deployment
