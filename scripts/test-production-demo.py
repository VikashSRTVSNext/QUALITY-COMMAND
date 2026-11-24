"""Offline deployment contracts; requires Python and PyYAML, never calls a cluster."""
from pathlib import Path
import unittest

import yaml

ROOT = Path(__file__).resolve().parents[1]
BASE = "/factory-command-center/production-demo/"
NAME = "factory-production-demo"


class ProductionDemoTests(unittest.TestCase):
    def test_resource_isolation_and_routing(self):
        service, deployment, ingress = yaml.safe_load_all(
            (ROOT / "k8s/production-demo/deployment.yaml").read_text()
        )
        for resource in [service, deployment, ingress]:
            self.assertEqual(resource["metadata"]["name"], NAME)
            self.assertEqual(resource["metadata"]["namespace"], "nokia-factory-command-center")
        labels = {"app": NAME}
        self.assertEqual(service["spec"]["selector"], labels)
        self.assertEqual(deployment["spec"]["selector"]["matchLabels"], labels)
        self.assertEqual(deployment["spec"]["template"]["metadata"]["labels"], labels)
        container = deployment["spec"]["template"]["spec"]["containers"][0]
        self.assertEqual(container["image"], f"tvsnext.azurecr.io/{NAME}:latest")
        self.assertEqual(container["readinessProbe"]["httpGet"]["path"], "/health/ready")
        self.assertEqual(ingress["spec"]["ingressClassName"], "nginx")
        paths = ingress["spec"]["rules"][0]["http"]["paths"]
        self.assertEqual(paths, [{"path": BASE.rstrip("/"), "pathType": "Prefix",
                                 "backend": {"service": {"name": NAME, "port": {"number": 80}}}}])

    def test_docker_nginx_router_alignment(self):
        docker = (ROOT / "Dockerfile.production-demo").read_text()
        nginx = (ROOT / "nginx/production-demo.conf").read_text()
        self.assertIn(f"VITE_BASE_PATH={BASE}", docker)
        self.assertIn(f"/usr/share/nginx/html{BASE}", docker)
        self.assertIn("RUN nginx -t", docker)
        self.assertIn("USER 101:101", docker)
        self.assertIn("libxslt>=1.1.43-r4", docker)
        self.assertIn(f"try_files {BASE}index.html =503;", nginx)
        self.assertIn(f"return 308 {BASE};", nginx)
        self.assertIn(f"location ^~ {BASE}assets/", nginx)
        self.assertIn("try_files $uri =404;", nginx)
        self.assertIn(f"try_files $uri $uri/ {BASE}index.html;", nginx)
        self.assertIn("location / { return 404; }", nginx)
        self.assertIn("basename: import.meta.env.BASE_URL", (ROOT / "src/app/router.tsx").read_text(encoding="utf-8"))

    def test_deploy_script_guards_and_targets(self):
        script = (ROOT / "scripts/deploy-production-demo.ps1").read_text()
        self.assertLess(script.index("if (-not $Deploy)"), script.index("$Branch = & git"))
        self.assertIn("$Branch -cne 'demo/factory-production'", script)
        self.assertIn("if (-not $NetworkRestricted)", script)
        self.assertIn("@('--context', $Context", script)
        self.assertIn("k8s\\production-demo\\deployment.yaml", script)
        self.assertNotIn("deployment/factory-command-center", script)
        self.assertNotIn("nokia-pec-frontend", script)
        self.assertLess(script.index("'--dry-run=server'"), script.index("@('build'"))

    def test_build_context_excludes_local_environment(self):
        ignored = (ROOT / "Dockerfile.production-demo.dockerignore").read_text().splitlines()
        for entry in [".env", ".env.*", ".snowflake", ".git", "node_modules"]:
            self.assertIn(entry, ignored)


if __name__ == "__main__":
    unittest.main()