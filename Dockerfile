# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app

# Copy manifest + lockfile first so this layer caches across code changes
COPY package*.json ./

# Reproducible install from lockfile
RUN npm ci --legacy-peer-deps

COPY . .

# .env.demo enables the fixture-backed transport; no backend is required.
RUN npm run build:demo

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
COPY --from=build --chown=nginx:nginx /app/dist-demo /usr/share/nginx/html/factory-command-center

# Drop privileges to nginx user (UID 101, matching runAsUser: 101 in deployment.yaml)
USER nginx

# Keep the Kubernetes container port; Docker Compose publishes it on localhost:8082.
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
