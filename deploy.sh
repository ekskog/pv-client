#!/bin/bash

# PhotoVault Frontend Deployment Script
# This script builds and deploys the frontend to Kubernetes

set -e

echo "🏗️  Building PhotoVault Frontend Docker Image..."

# Build the Docker image
docker build -t ekskog/photovault-frontend:latest .

echo "📦 Pushing image to registry..."

# Push to registry (uncomment if using a registry)
# docker push ekskog/photovault-frontend:latest

echo "🚀 Deploying to Kubernetes..."

# Apply Kubernetes manifests
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml

echo "⏳ Waiting for deployment to be ready..."

# Wait for deployment to be ready
kubectl wait --for=condition=available --timeout=300s deployment/photovault-frontend

echo "📋 Getting service information..."

# Show service details
kubectl get service photovault-frontend-service

echo "✅ PhotoVault Frontend deployed successfully!"
echo "🌐 You can access the frontend using the EXTERNAL-IP shown above"
