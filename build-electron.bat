@echo off
REM ============================================================================
REM CAMPUS VIRTUAL TRAINING - SCRIPT DI BUILD ELECTRON
REM ============================================================================
REM
REM Questo script automatizza il processo di build dell'applicazione Electron.
REM
REM Prerequisiti (SOLO SU QUESTO PC, non sul PC target):
REM - Node.js installato (https://nodejs.org/)
REM
REM Uso:
REM   1. Doppio click su questo file
REM   2. Attendi completamento build
REM   3. Trova il pacchetto in dist\
REM
REM ============================================================================

color 0A
echo.
echo ========================================================================
echo   CAMPUS VIRTUAL TRAINING - BUILD ELECTRON
echo ========================================================================
echo.

REM Verifica che Node.js sia installato
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo [ERRORE] Node.js non trovato!
    echo.
    echo Installa Node.js da: https://nodejs.org/
    echo Poi rilancia questo script.
    echo.
    pause
    exit /b 1
)

echo [1/4] Verifica Node.js...
node --version
call npm --version
echo.

REM Installa dipendenze se non gia presenti
if not exist "node_modules" (
    echo [2/4] Installazione dipendenze - prima volta, richiede qualche minuto...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        color 0C
        echo.
        echo [ERRORE] Installazione dipendenze fallita!
        echo.
        pause
        exit /b 1
    )
) else (
    echo [2/4] Dipendenze gia installate - skip
)
echo.

REM Verifica presenza icona
if not exist "build\icon.ico" (
    color 0E
    echo [AVVISO] Icona icon.ico non trovata in build\
    echo          Verra usata l'icona di default di Electron.
    echo          Per personalizzare, crea build\icon.ico
    echo.
)

REM Build
echo [3/4] Build applicazione Electron (richiede qualche minuto)...
echo.
set CSC_IDENTITY_AUTO_DISCOVERY=false
call npm run build
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo.
    echo [ERRORE] Build fallita!
    echo.
    pause
    exit /b 1
)
echo.

REM Successo
color 0A
echo ========================================================================
echo   BUILD COMPLETATA CON SUCCESSO!
echo ========================================================================
echo.
echo Pacchetto creato in: dist\
echo.
echo File generati:
dir /B dist\*.exe 2>nul
echo.
echo -----------------------------------------------------------------------
echo   DISTRIBUISCI IL FILE PORTABLE:
echo   dist\Campus Virtual Training-*-Portable.exe
echo.
echo   Questo file e' autocontenuto e funziona senza installazione.
echo   Basta copiarlo sul PC target e fare doppio click!
echo -----------------------------------------------------------------------
echo.

REM Apri cartella dist
echo Apertura cartella dist...
start explorer "dist"

echo.
pause
