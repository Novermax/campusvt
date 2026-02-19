@echo off
REM ============================================================================
REM CAMPUS VIRTUAL TRAINING - AVVIO ELECTRON SVILUPPO
REM ============================================================================
REM
REM Avvia l'applicazione in modalità sviluppo per testare prima del build.
REM Utile per verificare che tutto funzioni correttamente.
REM
REM ============================================================================

color 0B
echo.
echo ========================================================================
echo   CAMPUS VIRTUAL TRAINING - MODALITA SVILUPPO
echo ========================================================================
echo.

REM Verifica Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo [ERRORE] Node.js non trovato!
    echo Installa Node.js da: https://nodejs.org/
    pause
    exit /b 1
)

REM Installa dipendenze se necessario
if not exist "node_modules\" (
    echo Installazione dipendenze (prima volta)...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        color 0C
        echo [ERRORE] Installazione fallita!
        pause
        exit /b 1
    )
    echo.
)

REM Avvia Electron
echo Avvio applicazione...
echo.
echo Premi Ctrl+C in questo terminale per fermare l'app.
echo.
call npm start
