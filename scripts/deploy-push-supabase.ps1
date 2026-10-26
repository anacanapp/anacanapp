# Deploy daily push migration + edge functions to Supabase (project: tntbjulojatnrqmylorp)
# Prerequisites: npx supabase login  (once per machine)

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

Write-Host "Checking Supabase CLI auth..." -ForegroundColor Cyan
$linkCheck = npx supabase projects list 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Supabase CLI is not logged in. Run first:" -ForegroundColor Yellow
    Write-Host "  npx supabase login" -ForegroundColor White
    Write-Host "  npx supabase link --project-ref tntbjulojatnrqmylorp" -ForegroundColor White
    exit 1
}

if (-not (Test-Path ".supabase\linked")) {
    Write-Host "Linking project tntbjulojatnrqmylorp..." -ForegroundColor Cyan
    npx supabase link --project-ref tntbjulojatnrqmylorp
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "Pushing database migrations..." -ForegroundColor Cyan
npx supabase db push
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Deploying send-daily-notifications..." -ForegroundColor Cyan
npx supabase functions deploy send-daily-notifications
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Deploying send-push-notification..." -ForegroundColor Cyan
npx supabase functions deploy send-push-notification
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Done. Verify FIREBASE_SERVICE_ACCOUNT_JSON is set in Dashboard -> Edge Functions -> Secrets." -ForegroundColor Green
