## Frontend NESC Deployment Steps

#### Build Image

```bash
docker build -t tvsnext.azurecr.io/factory-command-center:latest .
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
docker build -t tvsnext.azurecr.io/factory-command-center:latest .

docker push tvsnext.azurecr.io/factory-command-center:latest

kubectl apply -f k8s/

kubectl rollout restart deployment/factory-command-center -n nokia-factory-command-center
```