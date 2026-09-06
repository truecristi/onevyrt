# Deploy ONEVYRT to production from your Windows PC.
# Runs the server's atomic deploy (migrate -> build -> swap -> health-check ->
# auto-rollback) over SSH. See docs/ONEVYRT_BLUEHOST_DEPLOYMENT.md.
#
# Usage:
#   .\deploy-from-pc.ps1              # deploy origin/master (normal)
#   .\deploy-from-pc.ps1 -Ref origin/claude/works-f7cor7   # deploy a branch (preview)
param(
  [string]$Ref = "origin/master",
  [string]$KeyPath = "$env:USERPROFILE\.ssh\id_ed25519_bluehost",
  [string]$Target = "root@100.98.30.40"
)

Write-Host "==> Deploying $Ref to $Target" -ForegroundColor Green
ssh -i "$KeyPath" $Target "cd /opt/onevyrt-src && REF=$Ref bash deploy/deploy.sh"
if ($LASTEXITCODE -ne 0) {
  Write-Host "Deploy failed (exit $LASTEXITCODE). Check server logs: docker logs --tail 80 onevyrt-app" -ForegroundColor Red
  exit $LASTEXITCODE
}
Write-Host "==> Done. Smoke-test https://onevyrt.masteryresearch.com" -ForegroundColor Green
