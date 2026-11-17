## Frontend NESC Deployment Steps

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