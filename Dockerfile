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
#  - move the pid file to /tmp, writable by nginx, regardless of the image default
#  - remove the user directive because Docker already selects the runtime user
#  - fix ownership of directories Nginx writes to
RUN sed -i \
      -e 's|^[[:space:]]*pid[[:space:]][^;]*;|pid /tmp/nginx.pid;|' \
      -e '/^[[:space:]]*user[[:space:]]/d' \
      /etc/nginx/nginx.conf && \
    chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /var/log/nginx /etc/nginx/conf.d

# Copy build output with final ownership set
COPY --from=build --chown=nginx:nginx /app/dist-demo /usr/share/nginx/html/factory-command-center

# Drop privileges to nginx user (UID 101, matching runAsUser: 101 in deployment.yaml)
USER nginx

# Fail the image build if the runtime user cannot use the Nginx configuration.
RUN nginx -t

# Keep the Kubernetes container port; Docker Compose publishes it on localhost:8082.
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
