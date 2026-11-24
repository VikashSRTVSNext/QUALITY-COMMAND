#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$Context,
    [switch]$Deploy,
    [switch]$NetworkRestricted
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$Repository = Split-Path -Parent $PSScriptRoot
$Namespace = 'nokia-factory-command-center'
$Image = 'tvsnext.azurecr.io/factory-production-demo:latest'
$Manifest = Join-Path $Repository 'k8s\production-demo\deployment.yaml'
$Dockerfile = Join-Path $Repository 'Dockerfile.production-demo'

Write-Output "Source: $Repository (required branch: demo/factory-production)"
Write-Output 'URL: https://digitwin.dyn.nesc.nokia.net/factory-command-center/production-demo/'
Write-Output "Image: $Image; namespace: $Namespace; resources: factory-production-demo"
Write-Output 'Existing Factory and PEC resources are not deployment targets. Existing Factory API settings remain unchanged.'
if (-not $Deploy) {
    Write-Output 'PREVIEW ONLY: no build, push or cluster operations. Use -Context NAME -NetworkRestricted -Deploy after checking prerequisites.'
    return
}
if ([string]::IsNullOrWhiteSpace($Context) -or $Context -cnotmatch '\A[A-Za-z0-9][A-Za-z0-9._:/@-]*\z') {
    throw 'Supply an explicit valid -Context.'
}
if (-not $NetworkRestricted) {
    throw 'Confirm NESC-only access before passing -NetworkRestricted.'
}
function Invoke-Checked {
    param([string]$Executable, [string[]]$Arguments)
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Executable failed; deployment stopped." }
}
$Branch = & git -C $Repository branch --show-current
if ($LASTEXITCODE -ne 0 -or $Branch -cne 'demo/factory-production') {
    throw 'Deploy only from demo/factory-production; no branch is switched automatically.'
}
$ClusterArguments = @('--context', $Context, '--request-timeout=30s')
Invoke-Checked kubectl ($ClusterArguments + @('get', 'namespace', $Namespace, '-o', 'name'))
Invoke-Checked kubectl ($ClusterArguments + @('get', 'ingressclass', 'nginx', '-o', 'name'))
foreach ($SecretName in @('acr-auth', 'frontend-nokia-tls')) {
    Invoke-Checked kubectl ($ClusterArguments + @('-n', $Namespace, 'get', 'secret', $SecretName, '-o', 'name'))
}
Invoke-Checked kubectl ($ClusterArguments + @('-n', $Namespace, 'apply', '--dry-run=server', '-f', $Manifest))
Invoke-Checked docker @('build', '--pull', '--no-cache', '-f', $Dockerfile, '-t', $Image, $Repository)
Invoke-Checked docker @('push', $Image)
Invoke-Checked kubectl ($ClusterArguments + @('-n', $Namespace, 'apply', '-f', $Manifest))
Invoke-Checked kubectl ($ClusterArguments + @('-n', $Namespace, 'rollout', 'restart', 'deployment/factory-production-demo'))
Invoke-Checked kubectl ($ClusterArguments + @('-n', $Namespace, 'rollout', 'status', 'deployment/factory-production-demo', '--timeout=180s'))
Write-Output 'Demo rollout completed. Verify URL, assets, deep links and API access before acceptance.'