# Kubernetes Deployment with Secrets - HBVU PHOTOS

This guide explains how to deploy HBVU PHOTOS frontend using Kubernetes Secrets for secure credential management.

## 🔐 Security Overview

### Why Kubernetes Secrets?
- **Separation of Concerns**: Keep sensitive data separate from application code
- **Encryption at Rest**: Secrets are encrypted in etcd
- **Access Control**: RBAC controls who can access secrets
- **Runtime Injection**: Environment variables loaded at container startup
- **Rotation**: Easy credential rotation without rebuilding images

### What's Secured?
- API endpoints and URLs
- Authentication credentials
- JWT secrets
- Session configuration
- Any sensitive configuration

## 📁 File Structure

```
k8s/
├── configmap.yaml      # Non-sensitive configuration
├── secrets.yaml        # Sensitive credentials (template)
├── deployment.yaml     # Updated with secret references
├── service.yaml        # Unchanged
└── manage-secrets.sh   # Secret management script
```

## 🚀 Quick Deployment

### 1. Create Secrets
```bash
# Interactive production setup
./k8s/manage-secrets.sh create-prod

# Or apply from template (update secrets.yaml first)
kubectl apply -f k8s/secrets.yaml
```

### 2. Deploy Application
```bash
# Deploy all configurations
./k8s/manage-secrets.sh deploy

# Or manually
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
```

## 🔧 Secret Management

### Creating Production Secrets
```bash
# Interactive creation with prompts
./k8s/manage-secrets.sh create-prod
```

### Creating Development Secrets
```bash
# Pre-configured development secrets
./k8s/manage-secrets.sh create-dev
```

### Viewing Secrets (Decoded)
```bash
# View current secrets safely
./k8s/manage-secrets.sh view
```

### Updating Secrets
```bash
# Update existing secrets
kubectl patch secret photovault-frontend-secrets \
  --namespace=webapps \
  --patch='{"data":{"VITE_API_URL":"'$(echo -n "https://new-api.hbvu.su" | base64)'"}}'
```

### Rotating Secrets
```bash
# Delete and recreate
./k8s/manage-secrets.sh delete
./k8s/manage-secrets.sh create-prod
```

## 🏗️ Deployment Configuration

### Production Environment
```yaml
# In secrets.yaml
VITE_DEMO_MODE: ZmFsc2U=  # false (base64)
VITE_API_URL: <your-production-api>
VITE_AUTH_ENDPOINT: <your-auth-endpoint>
```

### Development/Staging Environment
```yaml
# In secrets.yaml  
VITE_DEMO_MODE: dHJ1ZQ==  # true (base64)
VITE_DEMO_ADMIN_USERNAME: YWRtaW4=  # admin
VITE_DEMO_ADMIN_PASSWORD: YWRtaW4xMjM=  # admin123
```

## 🔒 Security Best Practices

### 1. Secret Access Control
```bash
# Limit secret access with RBAC
kubectl create rolebinding secret-reader \
  --clusterrole=view \
  --user=developer \
  --namespace=webapps
```

### 2. Encryption at Rest
Ensure your cluster has encryption at rest enabled:
```yaml
# In kube-apiserver
--encryption-provider-config=/path/to/encryption-config.yaml
```

### 3. Secret Rotation
```bash
# Automated secret rotation (example)
kubectl create cronjob secret-rotator \
  --image=secret-rotator:latest \
  --schedule="0 2 * * 0" \
  --namespace=webapps
```

### 4. Audit Logging
Enable audit logs to track secret access:
```yaml
# In audit policy
- level: Metadata
  resources:
  - group: ""
    resources: ["secrets"]
```

## 🔍 Troubleshooting

### Check Secret Existence
```bash
kubectl get secrets -n webapps | grep photovault
```

### Verify Secret Content
```bash
kubectl describe secret photovault-frontend-secrets -n webapps
```

### Debug Pod Environment
```bash
kubectl exec -it <pod-name> -n webapps -- env | grep VITE_
```

### Check Deployment Events
```bash
kubectl describe deployment photovault-vue -n webapps
```

## 🚦 Environment-Specific Deployment

### Production
```bash
# Use production secrets
kubectl apply -f k8s/secrets.yaml
kubectl set env deployment/photovault-vue \
  --from=secret/photovault-frontend-secrets \
  --namespace=webapps
```

### Staging
```bash
# Use development secrets
kubectl set env deployment/photovault-vue \
  --from=secret/photovault-frontend-dev-secrets \
  --namespace=webapps
```

## 📊 Monitoring

### Secret Usage Monitoring
```bash
# Monitor secret access
kubectl logs -f deployment/photovault-vue -n webapps | grep -i auth
```

### Health Checks
```bash
# Check application health
kubectl get pods -n webapps -l app=photovault-vue
kubectl logs -f deployment/photovault-vue -n webapps
```

## 🔄 CI/CD Integration

### GitHub Actions Example
```yaml
- name: Deploy to Kubernetes
  run: |
    # Update secrets in CI/CD
    kubectl create secret generic photovault-frontend-secrets \
      --from-literal=VITE_API_URL="${{ secrets.API_URL }}" \
      --from-literal=VITE_DEMO_MODE="false" \
      --dry-run=client -o yaml | kubectl apply -f -
    
    # Deploy application
    kubectl apply -f k8s/
```

## ⚠️ Important Notes

1. **Never commit actual secrets** to git - only templates
2. **Use different secrets** for different environments
3. **Rotate secrets regularly** for security
4. **Monitor secret access** through audit logs
5. **Backup secret values** securely before rotation
6. **Test deployments** in staging before production

## 📞 Support

For issues with Kubernetes secrets deployment:
1. Check the troubleshooting section above
2. Verify RBAC permissions
3. Check cluster audit logs
4. Contact your cluster administrator
