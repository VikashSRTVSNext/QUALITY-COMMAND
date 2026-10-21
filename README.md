## Run the standalone demo with Docker and Nginx

```bash
docker compose up --build -d
```

Open http://localhost:8082. Nginx redirects to
http://localhost:8082/factory-command-center/ and supports refreshing app routes.
The container listens on port 8080; Compose publishes it on host port 8082.
Local serving uses HTTP and does not require TLS certificates.

To stop the app:

```bash
docker compose down
```

Or build and run without Compose:

```bash
docker build -t nokia-quality-command-center .
docker run --rm -p 8082:8080 nokia-quality-command-center
```

The image runs `npm run build:demo` and serves `dist-demo/`, including the bundled
fixtures, through Nginx. No backend API, database, Snowflake connection, or other
service is required at runtime. The build still downloads the base images and
npm packages. Only `.env.demo` is included from the environment files, so local
API settings cannot override the demo configuration.

Missing fixture and asset URLs return 404; app routes fall back to the demo shell.
See [the demo documentation](src/demo/README.md) for fixture details and limitations.