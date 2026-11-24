## Deploy branch demo/factory-production

Local source: `D:\Projects\nokia-factory-frontend`, branch `demo/factory-production`.
Do not use the sibling Production Experience Centre repository's deployment script.
Target URL: `https://digitwin.dyn.nesc.nokia.net/factory-command-center/production-demo/`.

The dedicated image and Service/Deployment/Ingress are named
`factory-production-demo`, in existing namespace `nokia-factory-command-center`.
Existing Factory and PEC resources are not modified. This is a separate frontend
deployment, not an offline-data mode: the existing Factory API and stream URLs
remain configured, with `VITE_USE_MOCKS=false` as in the original Docker build.

PowerShell preview (safe; builds the local working tree only when `-Deploy` is passed):

```powershell
& "D:\Projects\nokia-factory-frontend\scripts\deploy-production-demo.ps1"
```

After Docker/ACR access, the intended cluster context, existing `acr-auth` and
`frontend-nokia-tls` secrets, Nginx ingress and NESC-only access are confirmed:

```powershell
& "D:\Projects\nokia-factory-frontend\scripts\deploy-production-demo.ps1" -Context YOUR_CONFIRMED_CONTEXT -NetworkRestricted -Deploy
```

For MobaXterm/Bash, first copy this branch **including these deployment files**
to the server. Run from that checkout, with an explicitly confirmed context:

```bash
CONTEXT=YOUR_CONFIRMED_CONTEXT
test "$(git branch --show-current)" = "demo/factory-production" &&
kubectl --context "$CONTEXT" apply --dry-run=server -f k8s/production-demo/deployment.yaml &&
docker build --pull --no-cache -f Dockerfile.production-demo -t tvsnext.azurecr.io/factory-production-demo:latest . &&
docker push tvsnext.azurecr.io/factory-production-demo:latest &&
kubectl --context "$CONTEXT" apply -f k8s/production-demo/deployment.yaml &&
kubectl --context "$CONTEXT" -n nokia-factory-command-center rollout restart deployment/factory-production-demo &&
kubectl --context "$CONTEXT" -n nokia-factory-command-center rollout status deployment/factory-production-demo --timeout=180s
```

Use only the demo manifest, not `kubectl apply -f k8s/` or recursive apply.
These commands build, push and deploy; the PowerShell preview does not.
The `latest` tag is mutable; retain the previous image digest for recovery.
Verify `/production-demo/` assets and deep links, the unchanged Factory URL,
TLS and API access after rollout. Local preparation does not prove live routing.

## Original Factory deployment (not the demo branch workflow)

#### Build Image

```bash
docker build --pull --no-cache -t tvsnext.azurecr.io/factory-command-center:latest .
```

#### Push to ACR

```
docker push tvsnext.azurecr.io/factory-command-center:latest
```

#### Apply K8s config
```
kubectl apply -f k8s/
```

#### Restart Pod
```
kubectl rollout restart deployment/factory-command-center
```

---

### Oneshot

```bash
docker build --pull --no-cache -t tvsnext.azurecr.io/factory-command-center:latest .

docker push tvsnext.azurecr.io/factory-command-center:latest

kubectl apply -f k8s/

kubectl rollout restart deployment/factory-command-center -n nokia-factory-command-center
```

### libxslt security rebuild

Both Nginx Dockerfiles require `libxslt>=1.1.43-r4`. The package is installed
in the runtime stage; updating only the Node build stage would not patch the
deployed Nginx image. If the configured Alpine repositories cannot satisfy the
minimum version, the build fails. In that case, update the Nginx base to a
supported release with a compatible patched package rather than mixing Alpine
repositories.

After rebuilding, check the runtime package before pushing:

```bash
docker run --rm --entrypoint sh tvsnext.azurecr.io/factory-command-center:latest -c 'apk info -v libxslt'
```

Confirm `1.1.43-r4` or newer, then rescan the new image and verify that the
deployment uses its new digest. The reported image digests are not modified by
a rebuild, and rebuilding alone does not update deployed containers. Apply the
same runtime-stage fix, rebuild, and scan separately for the other affected
repositories. This repository does not verify or remediate those images.