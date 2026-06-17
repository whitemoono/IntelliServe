# =============================================================================
# IntelliServe IT Suite - Frontend Dockerfile
# Build context: project root (.)
# Landing pages (static) + System dashboard (React SPA)
# =============================================================================

# Stage 1: Build React app
FROM node:22-alpine AS builder
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --legacy-peer-deps
COPY frontend/ .
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:1.27-alpine
RUN rm /etc/nginx/conf.d/default.conf

# Copy React build to /system/ subdirectory
COPY --from=builder /app/dist /usr/share/nginx/html/system

# Copy landing page files (website/) to root
COPY website/ /usr/share/nginx/html/landing/

# Copy Nginx config
COPY frontend/nginx.conf /etc/nginx/conf.d/frontend.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
