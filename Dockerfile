# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app

# Copy manifest + lockfile first so this layer caches across code changes
COPY package*.json ./

# Reproducible install from lockfile (keep --legacy-peer-deps)
RUN npm ci --legacy-peer-deps

COPY . .

ARG VITE_API_URL
ARG VITE_CONSOLE_APP_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_CONSOLE_APP_URL=$VITE_CONSOLE_APP_URL

RUN npm run build

# ---- Production stage ----
FROM nginx:alpine

COPY nginx/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf

# Privileged setup while still root:
#  - move pid file to /tmp so it works under readOnlyRootFilesystem
#  - fix ownership of everything nginx writes to
RUN sed -i 's|/var/run/nginx.pid|/tmp/nginx.pid|' /etc/nginx/nginx.conf && \
    chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /var/log/nginx /etc/nginx/conf.d

# Copy build output with final ownership set
COPY --from=build --chown=nginx:nginx /app/dist /usr/share/nginx/html

# Drop privileges last
USER nginx

# Unprivileged port - no NET_BIND_SERVICE needed
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
