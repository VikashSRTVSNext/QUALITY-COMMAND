FROM nginx:1.27-alpine

# Fail the build if this Alpine branch cannot supply the patched package.
RUN apk add --no-cache --upgrade 'libxslt>=1.1.43-r4'

RUN mkdir -p /etc/nginx/certs

COPY conf.d/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80 443
