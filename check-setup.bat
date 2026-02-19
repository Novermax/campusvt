@echo off
REM ============================================================================
REM VERIFICA SETUP ELECTRON
REM ============================================================================
REM Controlla che tutto sia pronto per il build
REM ============================================================================

color 0B
echo.
echo ========================================================================
echo   VERIFICA SETUP ELECTRON
echo ========================================================================
echo.

set ERRORS=0

REM Check 1: Node.js
echo [1/5] Verifica Node.js...
where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo    ^[OK^] Node.js trovato
    node --version
) else (
    echo    ^[ERRORE^] Node.js NON trovato
    echo    Installa da: https://nodejs.org/
    set ERRORS=1
)
echo.

REM Check 2: npm
echo [2/5] Verifica npm...
where npm >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo    ^[OK^] npm trovato
    npm --version
) else (
    echo    ^[ERRORE^] npm NON trovato
    set ERRORS=1
)
echo.

REM Check 3: File necessari
echo [3/5] Verifica file necessari...
set FILES_OK=1
if not exist "package.json" (
    echo    ^[ERRORE^] package.json mancante
    set FILES_OK=0
    set ERRORS=1
)
if not exist "electron-main.js" (
    echo    ^[ERRORE^] electron-main.js mancante
    set FILES_OK=0
    set ERRORS=1
)
if not exist "index.html" (
    echo    ^[ERRORE^] index.html mancante
    set FILES_OK=0
    set ERRORS=1
)
if %FILES_OK% EQU 1 (
    echo    ^[OK^] Tutti i file richiesti presenti
)
echo.

REM Check 4: Dipendenze
echo [4/5] Verifica dipendenze...
if exist "node_modules\" (
    echo    ^[OK^] node_modules presente
    if exist "node_modules\electron\" (
        echo    ^[OK^] Electron installato
    ) else (
        echo    ^[AVVISO^] Electron non installato
        echo    Lancia: npm install
    )
) else (
    echo    ^[AVVISO^] node_modules mancante
    echo    Lancia: npm install (prima volta)
)
echo.

REM Check 5: Icona (opzionale)
echo [5/5] Verifica icona (opzionale)...
if exist "build\icon.ico" (
    echo    ^[OK^] icon.ico trovata
) else (
    color 0E
    echo    ^[INFO^] icon.ico non trovata
    echo    Sara usata icona default Electron
    echo    Per personalizzare: crea build\icon.ico
)
echo.

REM Riepilogo
echo ========================================================================
if %ERRORS% EQU 0 (
    color 0A
    echo   TUTTO OK! Sei pronto per il build.
    echo.
    echo   Prossimi passi:
    echo   1. Doppio click su: build-electron.bat
    echo   2. Attendi completamento
    echo   3. Trova .exe in: dist\
) else (
    color 0C
    echo   CI SONO ERRORI! Risolvi i problemi sopra.
)
echo ========================================================================
echo.
pause
