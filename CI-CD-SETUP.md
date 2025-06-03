# PhotoVault Frontend - CI/CD Setup

## GitHub Actions Workflow

The repository includes an automated CI/CD pipeline that:
- ✅ Builds Docker image on every commit
- ✅ Pushes to Docker Hub registry
- ✅ Deploys to Kubernetes cluster via MetalLB
- ✅ Provides deployment status and service information

## Required GitHub Repository Secrets

To enable the CI/CD pipeline, add these secrets in your GitHub repository:

### Go to: `Settings` → `Secrets and variables` → `Actions` → `New repository secret`

1. **DOCKER_USERNAME**
   - Your Docker Hub username (e.g., `ekskog`)

2. **DOCKER_PASSWORD** 
   - Your Docker Hub password or access token
   - ⚠️ Recommended: Use a Personal Access Token instead of password

3. **KUBECONFIG**
   - Base64 encoded content of your kubeconfig file
   - Run this command to get the value:
   ```bash
   cat ~/.kube/k3s.yaml | base64 | tr -d '\n'
   ```

## Setup Commands

### 1. Get your kubeconfig in base64 format:
```bash
cat ~/.kube/k3s.yaml | base64 | tr -d '\n'
```
Copy the output and add it as the `KUBECONFIG` secret.

### 2. Create Docker Hub access token (recommended):
1. Go to [Docker Hub](https://hub.docker.com)
2. Click your username → Account Settings → Security → New Access Token
3. Create token with "Read, Write, Delete" permissions
4. Use this token as `DOCKER_PASSWORD` secret

## Workflow Triggers

The workflow runs on:
- ✅ Push to `main` or `master` branch
- ✅ Pull requests to `main` or `master` branch

## Image Tagging Strategy

The workflow creates multiple tags:
- `latest` (for main/master branch)
- `main-<sha>` (commit-specific)
- `pr-<number>` (for pull requests)

## Deployment Process

1. **Build**: Vue.js app built with Vite
2. **Containerize**: Multi-stage Docker build with nginx
3. **Push**: Image pushed to `ekskog/photovault-frontend`
4. **Deploy**: Kubernetes deployment updated with new image
5. **Verify**: Rollout status and service information displayed

## Manual Deployment

You can still deploy manually using:
```bash
./deploy.sh
```

## Monitoring

After each deployment, the workflow shows:
- Deployment status
- Pod status
- Service details
- External IP (MetalLB LoadBalancer)
