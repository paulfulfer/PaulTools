# Deploy web build to GitHub Pages (gh-pages branch)
# Usage: npm run deploy:web  OR  powershell -ExecutionPolicy Bypass -File deploy.ps1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Die($msg)  { Write-Host "`nERROR: $msg" -ForegroundColor Red; exit 1 }

# ── 1. Delete dist/ ──────────────────────────────────────────────────────────
Step "Removing dist/"
if (Test-Path 'dist') { Remove-Item 'dist' -Recurse -Force }

# ── 2. Export for web ────────────────────────────────────────────────────────
Step "Building web export"
npx expo export --platform web
if ($LASTEXITCODE -ne 0) { Die "expo export failed" }

# ── 3. Patch JS bundle — fix asset paths ─────────────────────────────────────
Step "Patching asset paths in JS bundle"
$jsFiles = @(Get-ChildItem 'dist/_expo/static/js/web/*.js')
if ($jsFiles.Count -ne 1) { Die "Expected 1 JS file in dist/_expo/static/js/web/, found $($jsFiles.Count)" }
$jsPath = $jsFiles[0].FullName
(Get-Content $jsPath -Raw).Replace('"/assets/', '"/PaulTools/assets/') |
    Set-Content $jsPath -Encoding utf8 -NoNewline

# ── 4. Patch index.html — fix _expo src path ─────────────────────────────────
Step "Patching index.html"
$htmlPath = 'dist/index.html'
if (-not (Test-Path $htmlPath)) { Die "dist/index.html not found" }
(Get-Content $htmlPath -Raw).Replace('src="/_expo', 'src="/PaulTools/_expo') |
    Set-Content $htmlPath -Encoding utf8 -NoNewline

# ── 5. Create .nojekyll ───────────────────────────────────────────────────────
Step "Creating .nojekyll"
New-Item -ItemType File -Path 'dist/.nojekyll' -Force | Out-Null

# ── 6. Stage dist/ ───────────────────────────────────────────────────────────
Step "Staging dist/"
git add dist/ -f
if ($LASTEXITCODE -ne 0) { Die "git add failed" }

# ── 7. Commit ────────────────────────────────────────────────────────────────
Step "Committing"
git commit -m "deploy web build"
if ($LASTEXITCODE -ne 0) { Die "git commit failed" }

# ── 8. Create dist-deploy branch via subtree split ───────────────────────────
Step "Creating dist-deploy branch"
git subtree split --prefix dist master -b dist-deploy
if ($LASTEXITCODE -ne 0) { Die "git subtree split failed" }

# ── 9. Force-push to gh-pages ────────────────────────────────────────────────
Step "Pushing to gh-pages"
git push origin dist-deploy:gh-pages --force
if ($LASTEXITCODE -ne 0) { Die "git push failed" }

# ── 10. Delete temp branch ────────────────────────────────────────────────────
Step "Cleaning up dist-deploy branch"
git branch -D dist-deploy
if ($LASTEXITCODE -ne 0) { Die "git branch -D dist-deploy failed" }

Write-Host "`nDeployed successfully to gh-pages." -ForegroundColor Green
