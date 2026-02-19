# ============================================================================
# CONVERSIONE CAMPUS VIRTUAL TRAINING - VERSIONE OFFLINE
# ============================================================================
# Scarica librerie JavaScript e modifica index.html automaticamente
# ============================================================================

Write-Host ""
Write-Host "========================================================================"  -ForegroundColor Cyan
Write-Host "  CONVERSIONE A VERSIONE OFFLINE - CAMPUS VIRTUAL TRAINING" -ForegroundColor Cyan
Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Questo script:" -ForegroundColor Yellow
Write-Host "  1. Scarichera Three.js e Tween.js da internet (solo questa volta)" -ForegroundColor Yellow
Write-Host "  2. Salvera i file nella cartella libs\" -ForegroundColor Yellow
Write-Host "  3. Modifichera index.html per usare librerie locali" -ForegroundColor Yellow
Write-Host "  4. Creera backup dell'index.html originale" -ForegroundColor Yellow
Write-Host ""
Write-Host "IMPORTANTE: Serve connessione internet ORA." -ForegroundColor Red
Write-Host "            Dopo, l'app funzionera offline!" -ForegroundColor Green
Write-Host ""
Read-Host "Premi INVIO per continuare"
Write-Host ""

# Crea cartella libs
Write-Host "[1/5] Creazione cartella libs..." -ForegroundColor Cyan
if (-not (Test-Path "libs")) {
    New-Item -ItemType Directory -Path "libs" | Out-Null
    Write-Host "      [OK] Cartella creata" -ForegroundColor Green
} else {
    Write-Host "      [INFO] Cartella gia esistente" -ForegroundColor Yellow
}
Write-Host ""

# Scarica Three.js
Write-Host "[2/5] Download Three.js v0.155.0..." -ForegroundColor Cyan
Write-Host "      (Attendere... ~2MB)" -ForegroundColor Gray
try {
    Invoke-WebRequest -Uri "https://unpkg.com/three@0.155.0/build/three.module.js" -OutFile "libs\three.module.js" -UseBasicParsing
    Write-Host "      [OK] Three.js scaricato ($([math]::Round((Get-Item 'libs\three.module.js').Length / 1MB, 2)) MB)" -ForegroundColor Green
} catch {
    Write-Host "      [ERRORE] Download fallito: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Verifica connessione internet e riprova." -ForegroundColor Red
    Read-Host "Premi INVIO per uscire"
    exit 1
}
Write-Host ""

# Scarica Tween.js
Write-Host "[3/7] Download Tween.js v18.6.4..." -ForegroundColor Cyan
try {
    Invoke-WebRequest -Uri "https://cdnjs.cloudflare.com/ajax/libs/tween.js/18.6.4/tween.umd.js" -OutFile "libs\tween.umd.js" -UseBasicParsing
    Write-Host "      [OK] Tween.js scaricato ($([math]::Round((Get-Item 'libs\tween.umd.js').Length / 1KB, 2)) KB)" -ForegroundColor Green
} catch {
    Write-Host "      [ERRORE] Download fallito: $_" -ForegroundColor Red
    Read-Host "Premi INVIO per uscire"
    exit 1
}
Write-Host ""

# Crea cartella three-addons/loaders
Write-Host "[4/7] Creazione cartella three-addons\loaders..." -ForegroundColor Cyan
if (-not (Test-Path "libs\three-addons\loaders")) {
    New-Item -ItemType Directory -Path "libs\three-addons\loaders" -Force | Out-Null
    Write-Host "      [OK] Cartella creata" -ForegroundColor Green
} else {
    Write-Host "      [INFO] Cartella gia esistente" -ForegroundColor Yellow
}
Write-Host ""

# Scarica Three.js Loaders
Write-Host "[5/7] Download Three.js Loaders..." -ForegroundColor Cyan

$loaders = @(
    @{Name="OBJLoader.js"; Url="https://unpkg.com/three@0.155.0/examples/jsm/loaders/OBJLoader.js"},
    @{Name="MTLLoader.js"; Url="https://unpkg.com/three@0.155.0/examples/jsm/loaders/MTLLoader.js"},
    @{Name="STLLoader.js"; Url="https://unpkg.com/three@0.155.0/examples/jsm/loaders/STLLoader.js"},
    @{Name="GLTFLoader.js"; Url="https://unpkg.com/three@0.155.0/examples/jsm/loaders/GLTFLoader.js"}
)

foreach ($loader in $loaders) {
    Write-Host "      Scarico $($loader.Name)..." -ForegroundColor Gray
    try {
        Invoke-WebRequest -Uri $loader.Url -OutFile "libs\three-addons\loaders\$($loader.Name)" -UseBasicParsing
        Write-Host "      [OK] $($loader.Name) scaricato" -ForegroundColor Green
    } catch {
        Write-Host "      [ERRORE] Download $($loader.Name) fallito: $_" -ForegroundColor Red
        Read-Host "Premi INVIO per uscire"
        exit 1
    }
}
Write-Host ""

# Backup index.html
Write-Host "[6/7] Backup index.html..." -ForegroundColor Cyan
if (-not (Test-Path "index.html.backup")) {
    Copy-Item "index.html" "index.html.backup"
    Write-Host "      [OK] Backup creato: index.html.backup" -ForegroundColor Green
} else {
    Write-Host "      [INFO] Backup gia esistente (non sovrascritto)" -ForegroundColor Yellow
}
Write-Host ""

# Modifica index.html
Write-Host "[7/7] Modifica index.html per versione offline..." -ForegroundColor Cyan

$content = Get-Content "index.html" -Raw

# Sostituisci Three.js CDN con locale
$content = $content -replace 'https://unpkg\.com/three@0\.155\.0/build/three\.module\.js', './libs/three.module.js'
$content = $content -replace 'https://unpkg\.com/three@0\.155\.0/examples/jsm/', './libs/three-addons/'

# Sostituisci Tween.js CDN con locale
$content = $content -replace 'https://cdnjs\.cloudflare\.com/ajax/libs/tween\.js/18\.6\.4/tween\.umd\.js', './libs/tween.umd.js'

# Rimuovi preconnect ai CDN (non servono piu)
$content = $content -replace '<link rel="preconnect" href="https://unpkg\.com"[^>]*>', '<!-- Preconnect rimosso - versione offline -->'
$content = $content -replace '<link rel="preconnect" href="https://cdn\.jsdelivr\.net"[^>]*>', '<!-- Preconnect rimosso - versione offline -->'

# Salva
Set-Content "index.html" -Value $content -Encoding UTF8

Write-Host "      [OK] index.html modificato" -ForegroundColor Green
Write-Host ""

# Verifica
Write-Host "========================================================================"  -ForegroundColor Cyan
Write-Host "  CONVERSIONE COMPLETATA CON SUCCESSO!" -ForegroundColor Green
Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "File scaricati nella cartella libs\:" -ForegroundColor Yellow
Get-ChildItem "libs\" | ForEach-Object {
    Write-Host "  - $($_.Name) ($([math]::Round($_.Length / 1KB, 2)) KB)" -ForegroundColor Gray
}
Write-Host ""
Write-Host "PROSSIMI PASSI:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  1. Apri una NUOVA finestra PowerShell/CMD" -ForegroundColor White
Write-Host "  2. Lancia: build-electron.bat" -ForegroundColor White
Write-Host "  3. Attendi completamento build (~3-5 min)" -ForegroundColor White
Write-Host "  4. Copia il nuovo .exe + cartella libs\ su chiavetta" -ForegroundColor White
Write-Host "  5. L'app ora funzionera OFFLINE sul PC demo!" -ForegroundColor Green
Write-Host ""
Write-Host "NOTA: La cartella libs\ DEVE essere copiata insieme all'exe!" -ForegroundColor Red
Write-Host ""
Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host ""
Read-Host "Premi INVIO per chiudere"
