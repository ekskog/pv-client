#!/bin/bash

# PhotoVault Frontend Deployment Script
# Enhanced with Kubernetes Secrets support

set -e

# Configuration
NAMESPACE="webapps"
APP_NAME="photovault-vue"
IMAGE_TAG=${1:-latest}
ENVIRONMENT=${2:-production}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}  HBVU PHOTOS - Deployment${NC}"
    echo -e "${BLUE}================================${NC}"
    echo
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_header

print_info "Environment: $ENVIRONMENT"
print_info "Image Tag: $IMAGE_TAG"
print_info "Namespace: $NAMESPACE"
echo

# Check if secrets exist
print_info "Checking Kubernetes secrets..."
if ! kubectl get secret photovault-frontend-secrets -n $NAMESPACE >/dev/null 2>&1; then
    print_warning "Production secrets not found!"
    echo "Please create secrets first:"
    echo "  ./k8s/manage-secrets.sh create-prod"
    echo "  or"
    echo "  kubectl apply -f k8s/secrets.yaml"
    exit 1
fi
print_success "Secrets found"

# Build Docker image
echo
print_info "Building PhotoVault Frontend Docker Image..."
docker build -t ekskog/photovault-frontend:$IMAGE_TAG \
    --build-arg VITE_API_URL="placeholder" \
    --build-arg VITE_DEMO_MODE="placeholder" .
print_success "Docker image built"

# Push to registry (if needed)
if [ "$PUSH_TO_REGISTRY" = "true" ]; then
    print_info "Pushing image to registry..."
    docker push ekskog/photovault-frontend:$IMAGE_TAG
    print_success "Image pushed to registry"
fi

# Deploy to Kubernetes
echo
print_info "Deploying to Kubernetes..."

# Apply ConfigMap first
kubectl apply -f k8s/configmap.yaml
print_success "ConfigMap applied"

# Apply secrets (if updated)
kubectl apply -f k8s/secrets.yaml
print_success "Secrets applied"

# Update deployment image tag if specified
if [ "$IMAGE_TAG" != "latest" ]; then
    kubectl set image deployment/$APP_NAME \
        $APP_NAME=ekskog/photovault-frontend:$IMAGE_TAG \
        -n $NAMESPACE
fi

# Apply deployment
kubectl apply -f k8s/deployment.yaml
print_success "Deployment applied"

# Apply service
kubectl apply -f k8s/service.yaml
print_success "Service applied"

# Wait for deployment
echo
print_info "Waiting for deployment to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/$APP_NAME -n $NAMESPACE
print_success "Deployment is ready!"

# Show status
echo
print_info "Deployment Status:"
kubectl get pods -n $NAMESPACE -l app=$APP_NAME
echo

print_info "Service Information:"
kubectl get svc -n $NAMESPACE -l app=$APP_NAME
kubectl get service photovault-frontend-service -n webapps

echo "✅ PhotoVault Frontend deployed successfully!"
echo "🌐 You can access the frontend using the EXTERNAL-IP shown above"
