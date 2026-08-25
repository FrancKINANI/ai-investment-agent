# CI/CD Pipeline Guide

This guide covers the GitHub Actions CI/CD pipeline for Ledgerline.

## Overview

The pipeline automates testing, building, security scanning, and deployment:

```
Push to main/PR → Quality Gate → Security Scan → Docker Build → Deploy
```

## Pipeline stages

### 1. Quality Gate

Runs on every push and PR:

```yaml
- Type check (tsc --noEmit)
- Unit tests (vitest run)
- Production build (vite build + esbuild)
```

All three must pass before proceeding.

### 2. Security Scan

Runs Trivy vulnerability scanner:

- Scans filesystem for known vulnerabilities
- Fails on CRITICAL or HIGH severity
- Ignores unfixed vulnerabilities

### 3. Docker Build

Only runs on push to main:

- Builds multi-stage Docker image
- Pushes to GitHub Container Registry (ghcr.io)
- Tags: git SHA, branch name, semantic version
- Uses GitHub Actions cache for faster builds

### 4. Deploy to Staging

Only runs on push to main after Docker build:

- SSHs to staging server
- Pulls latest Docker image
- Runs database migrations
- Restarts services
- Verifies health check

### 5. Deploy to Production

Only runs on push to main after staging deployment:

- Requires manual approval (GitHub environment protection)
- SSHs to production server
- Pulls latest Docker image
- Runs database migrations
- Restarts services with rolling update
- Verifies health check

## Workflow files

### `.github/workflows/verify.yml`

Basic verification for all PRs:

```yaml
name: Verify
on: [pull_request, push]
jobs:
  quality:
    steps:
      - Checkout
      - Setup pnpm (from packageManager field)
      - Setup Node 22
      - Install dependencies
      - Type check
      - Run tests
      - Build
```

### `.github/workflows/ci.yml`

Full CI/CD pipeline:

```yaml
name: CI/CD Pipeline
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
jobs:
  quality:    # Type check + tests + build
  security:   # Trivy vulnerability scan
  docker:     # Build and push Docker image
  deploy-staging:   # Deploy to staging server
  deploy-production: # Deploy to production server
```

## Required secrets

Configure these in GitHub repository settings:

| Secret | Description |
|--------|-------------|
| `STAGING_HOST` | Staging server hostname/IP |
| `STAGING_USER` | SSH username for staging |
| `STAGING_SSH_KEY` | SSH private key for staging |
| `PRODUCTION_HOST` | Production server hostname/IP |
| `PRODUCTION_USER` | SSH username for production |
| `PRODUCTION_SSH_KEY` | SSH private key for production |

## Environments

### Staging

- Automatic deployment on push to main
- No approval required
- Used for testing before production

### Production

- Requires manual approval
- configured in GitHub Settings → Environments → production
- Protection rules: Required reviewers, wait timer

## Local development

### Running tests

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test server/securityRouter.test.ts

# Run tests in watch mode
pnpm test --watch
```

### Type checking

```bash
pnpm check
```

### Building

```bash
pnpm build
```

## Adding new checks

To add a new check to the pipeline:

1. Edit `.github/workflows/verify.yml` or `.github/workflows/ci.yml`
2. Add a new step in the appropriate job
3. Push to a PR branch
4. Verify the check runs in the PR

Example:

```yaml
- name: Lint
  run: pnpm lint

- name: Check bundle size
  run: pnpm build && du -sh dist/
```

## Troubleshooting

### Pipeline fails on pnpm install

Ensure `pnpm/action-setup@v4` runs before `actions/setup-node@v4`. The pnpm version is read from `package.json` `packageManager` field.

### Docker build fails

Check that:
- `Dockerfile` exists at repository root
- `.dockerignore` excludes unnecessary files
- Build context doesn't include sensitive files

### Deployment fails

- Check SSH key is correctly configured
- Verify server is accessible
- Check Docker is running on target server
- Verify environment variables are set

### Tests fail in CI but pass locally

- Check for environment-specific behavior
- Verify test isolation (no shared state)
- Check for missing mocks
- Look for jsdom/localStorage issues (known pre-existing)

## Best practices

1. **Keep pipeline fast:** Parallelize independent jobs
2. **Fail fast:** Run cheapest checks first (type check before build)
3. **Cache dependencies:** Use pnpm cache in GitHub Actions
4. **Scan for vulnerabilities:** Run Trivy on every PR
5. **Use environments:** Protect production with required reviewers
6. **Rollback strategy:** Keep previous Docker images tagged
7. **Monitor deployments:** Check health endpoints after deploy
