#!/bin/bash

# HBVU PHOTOS - Kubernetes Secret Management Script
# This script helps you securely manage Kubernetes secrets for the frontend application

set -e

NAMESPACE="webapps"
SECRET_NAME="photovault-frontend-secrets"
DEV_SECRET_NAME="photovault-frontend-dev-secrets"
CONFIGMAP_NAME="photovault-frontend-config"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}  HBVU PHOTOS - Secret Manager${NC}"
    echo -e "${BLUE}================================${NC}"
    echo
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to base64 encode a string
base64_encode() {
    echo -n "$1" | base64
}

# Function to create production secrets
create_production_secrets() {
    print_header
    echo "Creating production secrets for HBVU PHOTOS..."
    echo
    
    # Prompt for values
    read -p "Enter API URL (default: https://vault-api.hbvu.su): " api_url
    api_url=${api_url:-"https://vault-api.hbvu.su"}
    
    read -p "Enter Auth Endpoint (default: /api/auth/login): " auth_endpoint
    auth_endpoint=${auth_endpoint:-"/api/auth/login"}
    
    read -p "Enter User Endpoint (default: /api/users): " user_endpoint
    user_endpoint=${user_endpoint:-"/api/users"}
    
    read -s -p "Enter JWT Secret (leave empty to skip): " jwt_secret
    echo
    
    read -p "Enter Session Timeout in seconds (default: 86400): " session_timeout
    session_timeout=${session_timeout:-"86400"}
    
    # Create the secret
    kubectl create secret generic $SECRET_NAME \
        --namespace=$NAMESPACE \
        --from-literal=VITE_API_URL="$api_url" \
        --from-literal=VITE_DEMO_MODE="false" \
        --from-literal=VITE_AUTH_ENDPOINT="$auth_endpoint" \
        --from-literal=VITE_USER_ENDPOINT="$user_endpoint" \
        --from-literal=VITE_SESSION_TIMEOUT="$session_timeout" \
        --from-literal=VITE_API_TIMEOUT="30000" \
        --dry-run=client -o yaml > /tmp/production-secret.yaml
    
    if [ ! -z "$jwt_secret" ]; then
        kubectl patch secret $SECRET_NAME \
            --namespace=$NAMESPACE \
            --patch='{"data":{"VITE_JWT_SECRET":"'$(base64_encode "$jwt_secret")'"}}'
    fi
    
    kubectl apply -f /tmp/production-secret.yaml
    rm /tmp/production-secret.yaml
    
    print_success "Production secrets created successfully!"
}

# Function to create development secrets
create_development_secrets() {
    echo "Creating development secrets..."
    
    kubectl create secret generic $DEV_SECRET_NAME \
        --namespace=$NAMESPACE \
        --from-literal=VITE_API_URL="https://vault-api.hbvu.su" \
        --from-literal=VITE_DEMO_MODE="true" \
        --from-literal=VITE_DEMO_ADMIN_USERNAME="admin" \
        --from-literal=VITE_DEMO_ADMIN_PASSWORD="admin123" \
        --from-literal=VITE_DEMO_USER_USERNAME="user" \
        --from-literal=VITE_DEMO_USER_PASSWORD="user123" \
        --dry-run=client -o yaml | kubectl apply -f -
    
    print_success "Development secrets created successfully!"
}

# Function to update secrets
update_secrets() {
    echo "Updating existing secrets..."
    
    if kubectl get secret $SECRET_NAME --namespace=$NAMESPACE >/dev/null 2>&1; then
        print_warning "Production secret exists. Use 'delete' command first if you want to recreate it."
    else
        create_production_secrets
    fi
}

# Function to delete secrets
delete_secrets() {
    echo "Deleting secrets..."
    
    kubectl delete secret $SECRET_NAME --namespace=$NAMESPACE --ignore-not-found=true
    kubectl delete secret $DEV_SECRET_NAME --namespace=$NAMESPACE --ignore-not-found=true
    
    print_success "Secrets deleted successfully!"
}

# Function to view secrets (base64 decoded)
view_secrets() {
    echo "Current secrets:"
    echo
    
    if kubectl get secret $SECRET_NAME --namespace=$NAMESPACE >/dev/null 2>&1; then
        echo -e "${GREEN}Production Secrets:${NC}"
        kubectl get secret $SECRET_NAME --namespace=$NAMESPACE -o jsonpath='{.data}' | \
            jq -r 'to_entries[] | "\(.key): \(.value | @base64d)"'
        echo
    fi
    
    if kubectl get secret $DEV_SECRET_NAME --namespace=$NAMESPACE >/dev/null 2>&1; then
        echo -e "${YELLOW}Development Secrets:${NC}"
        kubectl get secret $DEV_SECRET_NAME --namespace=$NAMESPACE -o jsonpath='{.data}' | \
            jq -r 'to_entries[] | "\(.key): \(.value | @base64d)"'
    fi
}

# Function to apply all configurations
deploy_all() {
    echo "Deploying all Kubernetes configurations..."
    
    # Apply ConfigMap
    kubectl apply -f k8s/configmap.yaml
    print_success "ConfigMap applied"
    
    # Apply Secrets
    kubectl apply -f k8s/secrets.yaml
    print_success "Secrets applied"
    
    # Apply Deployment
    kubectl apply -f k8s/deployment.yaml
    print_success "Deployment applied"
    
    # Apply Service
    kubectl apply -f k8s/service.yaml
    print_success "Service applied"
    
    echo
    print_success "All configurations deployed successfully!"
}

# Function to show help
show_help() {
    echo "Usage: $0 [COMMAND]"
    echo
    echo "Commands:"
    echo "  create-prod     Create production secrets interactively"
    echo "  create-dev      Create development secrets"
    echo "  update          Update existing secrets"
    echo "  delete          Delete all secrets"
    echo "  view            View current secrets (decoded)"
    echo "  deploy          Deploy all Kubernetes configurations"
    echo "  help            Show this help message"
    echo
    echo "Examples:"
    echo "  $0 create-prod    # Create production secrets"
    echo "  $0 view           # View current secrets"
    echo "  $0 deploy         # Deploy all configurations"
}

# Main script logic
case "${1:-help}" in
    "create-prod")
        create_production_secrets
        ;;
    "create-dev")
        create_development_secrets
        ;;
    "update")
        update_secrets
        ;;
    "delete")
        delete_secrets
        ;;
    "view")
        view_secrets
        ;;
    "deploy")
        deploy_all
        ;;
    "help"|*)
        show_help
        ;;
esac
