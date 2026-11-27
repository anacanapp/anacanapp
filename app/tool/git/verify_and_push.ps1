# Pushes the current branch only when HEAD, checked out alone in a clean worktree, passes `flutter analyze lib`.
# Catches commits that import files still untracked in the working copy (several agents work in one checkout).
#   powershell -File app/tool/git/verify_and_push.ps1
$ErrorActionPreference = 'Stop'
$repo = (git rev-parse --show-toplevel).Trim()
$wt = Join-Path $env:TEMP 'anacan-headcheck'
if (Test-Path $wt) { git -C $repo worktree remove --force $wt 2>$null | Out-Null }
git -C $repo worktree add -q --detach $wt HEAD
if (-not ($env:Path -like '*C:\flutter\bin*')) { $env:Path += ';C:\flutter\bin' }
Push-Location (Join-Path $wt 'app')
try {
  flutter pub get *> $null
  $out = flutter analyze lib 2>&1 | Out-String
  if ($out -notmatch 'No issues found') {
    Write-Host $out
    Write-Host 'HEAD does not analyze cleanly on its own; not pushing.'
    exit 1
  }
} finally {
  Pop-Location
  git -C $repo worktree remove --force $wt 2>$null | Out-Null
}
$branch = (git -C $repo rev-parse --abbrev-ref HEAD).Trim()
git -C $repo push -q origin $branch
Write-Host "pushed $branch at $((git -C $repo rev-parse --short HEAD).Trim())"
