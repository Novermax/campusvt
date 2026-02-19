@echo off
REM ============================================================================
REM CONVERSIONE A VERSIONE OFFLINE
REM ============================================================================
REM Scarica librerie JavaScript da CDN e le salva localmente
REM ============================================================================

color 0B
echo.
echo ========================================================================
echo   CONVERSIONE CAMPUS VIRTUAL TRAINING - VERSIONE OFFLINE
echo ========================================================================
echo.
echo Questo script scarichera le librerie necessarie da internet
echo e modifichera index.html per usare i file locali.
echo.
echo IMPORTANTE: Serve connessione internet ORA (solo questa volta).
echo            Dopo, l'app funzionera offline sul PC demo.
echo.
pause
echo.

REM Crea cartella libs se non esiste
if not exist "libs\" (
    echo [1/5] Creazione cartella libs...
    mkdir libs
    echo       [OK] Cartella creata
) else (
    echo [1/5] Cartella libs gia esistente
)
echo.

REM Scarica Three.js
echo [2/5] Download Three.js v0.155.0...
echo       (Questo puo richiedere qualche minuto...)
powershell -Command "& {Invoke-WebRequest -Uri 'https://unpkg.com/three@0.155.0/build/three.module.js' -OutFile 'libs\three.module.js'}"
if %ERRORLEVEL% EQU 0 (
    echo       [OK] Three.js scaricato
) else (
    color 0C
    echo       [ERRORE] Download fallito. Verifica connessione internet.
    pause
    exit /b 1
)
echo.

REM Scarica Tween.js
echo [3/5] Download Tween.js v18.6.4...
powershell -Command "& {Invoke-WebRequest -Uri 'https://cdnjs.cloudflare.com/ajax/libs/tween.js/18.6.4/tween.umd.js' -OutFile 'libs\tween.umd.js'}"
if %ERRORLEVEL% EQU 0 (
    echo       [OK] Tween.js scaricato
) else (
    color 0C
    echo       [ERRORE] Download fallito. Verifica connessione internet.
    pause
    exit /b 1
)
echo.

REM Backup index.html originale
echo [4/5] Backup index.html...
if not exist "index.html.backup" (
    copy index.html index.html.backup >nul
    echo       [OK] Backup creato: index.html.backup
) else (
    echo       [INFO] Backup gia esistente
)
echo.

REM Modifica index.html
echo [5/5] Modifica index.html per versione offline...
echo       Attendere...

REM Nota: La modifica dell'index.html verra fatta manualmente
REM       perche modificare HTML con batch e complesso
echo.
color 0E
echo ========================================================================
echo   ATTENZIONE: MODIFICA MANUALE RICHIESTA
echo ========================================================================
echo.
echo Le librerie sono state scaricate in: libs\
echo.
echo ORA devi modificare MANUALMENTE index.html:
echo.
echo 1. Apri index.html con un editor di testo
echo 2. Cerca la riga (~473):
echo    "three": "https://unpkg.com/three@0.155.0/build/three.module.js"
echo.
echo 3. Sostituisci con:
echo    "three": "./libs/three.module.js"
echo.
echo 4. Cerca la riga (~700):
echo    ^<script src="https://cdnjs.cloudflare.com/ajax/libs/tween.js/18.6.4/tween.umd.js"^>^</script^>
echo.
echo 5. Sostituisci con:
echo    ^<script src="./libs/tween.umd.js"^>^</script^>
echo.
echo 6. SALVA il file
echo.
echo 7. Rilancia build-electron.bat per creare nuovo .exe offline
echo.
echo ========================================================================
color 0A
echo.
echo   LIBRERIE SCARICATE CON SUCCESSO!
echo.
echo   File scaricati:
dir /B libs\
echo.
echo ========================================================================
echo.
pause
