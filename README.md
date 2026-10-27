## Deploy the standalone demo on Netlify

Deploy branch `demo/nokia` with the repository root as the base directory.
`netlify.toml` configures `npm run build:demo`, publish directory `dist-demo`,
and `VITE_BASE_PATH=/`. Netlify serves the app at the site root; Docker continues
to use `/factory-command-center/`. Netlify does not use the Dockerfile.

After pushing these settings, trigger a new deploy. Do not publish `dist/` or
reuse a Docker-path build: its JavaScript and CSS URLs have the wrong prefix
for Netlify. For a manual upload, build with `VITE_BASE_PATH=/` and upload
`dist-demo/`; the repository-based deployment is recommended because it also
applies the redirects in `netlify.toml`.

App routes fall back to `index.html`; missing assets and demo fixtures return
404 instead of the app shell.

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