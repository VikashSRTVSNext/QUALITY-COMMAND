# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app

# Copy manifest + lockfile first so this layer caches across code changes
COPY package*.json ./

# Reproducible install from lockfile
RUN npm ci --legacy-peer-deps

COPY . .

# Build arguments for Vite environment variables
ARG VITE_DASHBOARD_SSE_URL
ARG VITE_API_BASE_URL
ARG VITE_USE_MOCKS

ENV VITE_DASHBOARD_SSE_URL=$VITE_DASHBOARD_SSE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_USE_MOCKS=$VITE_USE_MOCKS

RUN npm run build

# ---- Production stage ----
FROM nginx:alpine

# Copy custom Nginx configuration listening on port 8080
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# Privileged setup while still root:
#  - move pid file to /tmp so it works under readOnlyRootFilesystem
#  - fix ownership of directories Nginx writes to
RUN sed -i 's|/var/run/nginx.pid|/tmp/nginx.pid|' /etc/nginx/nginx.conf && \
    chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /var/log/nginx /etc/nginx/conf.d

# Copy build output with final ownership set
COPY --from=build --chown=nginx:nginx /app/dist /usr/share/nginx/html

# Drop privileges to nginx user (UID 101, matching runAsUser: 101 in deployment.yaml)
USER nginx

# Unprivileged port (matches containerPort: 8080 and targetPort: 8080 in deployment.yaml)
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
