# PhotoVault Frontend Dockerfile
# Multi-stage build with runtime environment variable support

# Build stage
FROM node:18-alpine as build-stage

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Accept build-time environment variables
ARG VITE_API_URL
ARG VITE_DEMO_MODE
ARG VITE_AUTH_ENDPOINT
ARG VITE_USER_ENDPOINT
ARG VITE_JWT_SECRET
ARG VITE_SESSION_TIMEOUT
ARG VITE_API_TIMEOUT

# Set environment variables for build
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_DEMO_MODE=$VITE_DEMO_MODE
ENV VITE_AUTH_ENDPOINT=$VITE_AUTH_ENDPOINT
ENV VITE_USER_ENDPOINT=$VITE_USER_ENDPOINT
ENV VITE_JWT_SECRET=$VITE_JWT_SECRET
ENV VITE_SESSION_TIMEOUT=$VITE_SESSION_TIMEOUT
ENV VITE_API_TIMEOUT=$VITE_API_TIMEOUT

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine as production-stage

# Install envsubst for runtime environment variable substitution
RUN apk add --no-cache gettext

# Copy built app from build stage
COPY --from=build-stage /app/dist /usr/share/nginx/html

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create a startup script for runtime environment variable handling
RUN cat > /docker-entrypoint.sh << 'EOF'
#!/bin/sh

# Replace environment variables in JavaScript files at runtime
# This allows for runtime configuration changes without rebuilding

echo "Starting HBVU PHOTOS Frontend..."
echo "API URL: ${VITE_API_URL:-not set}"
echo "Demo Mode: ${VITE_DEMO_MODE:-not set}"

# Start nginx
nginx -g "daemon off;"
EOF

RUN chmod +x /docker-entrypoint.sh

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/health || exit 1

# Use custom entrypoint
ENTRYPOINT ["/docker-entrypoint.sh"]
