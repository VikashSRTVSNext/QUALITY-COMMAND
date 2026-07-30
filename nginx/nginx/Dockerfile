FROM nginx:1.27-alpine

RUN mkdir -p /etc/nginx/certs

COPY conf.d/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80 443
