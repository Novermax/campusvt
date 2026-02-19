@echo off
REM ============================================================================
REM VERIFICA FILE NECESSARI SU CHIAVETTA USB
REM ============================================================================
REM Controlla che tutti i file richiesti siano presenti
REM ============================================================================

color 0B
echo.
echo ========================================================================
echo   VERIFICA FILE PER DISTRIBUZIONE PORTABLE
echo ========================================================================
echo.
echo Verifica in corso nella directory: %CD%
echo.

set ERRORS=0
set WARNINGS=0

REM Check file critici root
echo [1/4] File critici nella root...
if exist "home_config.txt" (
    echo    [OK] home_config.txt presente
) else (
    color 0C
    echo    [ERRORE] home_config.txt MANCANTE
    set ERRORS=1
)

if exist "index.html" (
    echo    [OK] index.html presente
) else (
    color 0C
    echo    [ERRORE] index.html MANCANTE
    set ERRORS=1
)
echo.

REM Check cartelle necessarie
echo [2/4] Cartelle necessarie...
if exist "scenes\" (
    echo    [OK] scenes\ presente
) else (
    color 0C
    echo    [ERRORE] scenes\ MANCANTE
    set ERRORS=1
)

if exist "models\" (
    echo    [OK] models\ presente
) else (
    color 0C
    echo    [ERRORE] models\ MANCANTE
    set ERRORS=1
)

if exist "menuimages\" (
    echo    [OK] menuimages\ presente
) else (
    color 0E
    echo    [AVVISO] menuimages\ MANCANTE
    set WARNINGS=1
)

if exist "js\" (
    echo    [OK] js\ presente
) else (
    color 0C
    echo    [ERRORE] js\ MANCANTE
    set ERRORS=1
)

if exist "css\" (
    echo    [OK] css\ presente
) else (
    color 0C
    echo    [ERRORE] css\ MANCANTE
    set ERRORS=1
)
echo.

REM Check scenari
echo [3/4] Scenari configurati...
if exist "scenes\Manutenzione_Elettromandrino\" (
    echo    [OK] Manutenzione_Elettromandrino presente
    if exist "scenes\Manutenzione_Elettromandrino\tutorial.txt" (
        echo       [OK] tutorial.txt presente
    ) else (
        color 0E
        echo       [AVVISO] tutorial.txt MANCANTE
        set WARNINGS=1
    )
) else (
    color 0E
    echo    [AVVISO] Manutenzione_Elettromandrino MANCANTE
    set WARNINGS=1
)

if exist "scenes\Pompa_Becker\" (
    echo    [OK] Pompa_Becker presente
    if exist "scenes\Pompa_Becker\tutorial.txt" (
        echo       [OK] tutorial.txt presente
    ) else (
        color 0E
        echo       [AVVISO] tutorial.txt MANCANTE
        set WARNINGS=1
    )
) else (
    color 0E
    echo    [AVVISO] Pompa_Becker MANCANTE
    set WARNINGS=1
)
echo.

REM Check modelli critici
echo [4/4] Modelli 3D critici...
set MODELS_OK=1
for %%M in (pulpito.glb a500.glb remote.glb pavimento.glb culatta.glb corpo.glb coperchio.glb filtro.glb) do (
    if exist "models\%%M" (
        echo    [OK] %%M
    ) else (
        color 0E
        echo    [AVVISO] %%M MANCANTE
        set MODELS_OK=0
        set WARNINGS=1
    )
)
echo.

REM Riepilogo
echo ========================================================================
if %ERRORS% EQU 0 (
    if %WARNINGS% EQU 0 (
        color 0A
        echo   PERFETTO! Tutti i file necessari sono presenti.
        echo.
        echo   Puoi copiare questa cartella su chiavetta USB.
        echo   L'app Electron Portable funzionera correttamente.
    ) else (
        color 0E
        echo   OK! File critici presenti, ma ci sono alcuni AVVISI.
        echo   L'app dovrebbe funzionare, ma alcuni scenari/modelli potrebbero mancare.
    )
) else (
    color 0C
    echo   ERRORI CRITICI! Alcuni file essenziali mancano.
    echo   Risolvi gli errori prima di copiare su chiavetta.
)
echo ========================================================================
echo.

REM Suggerimenti
if %ERRORS% GTR 0 (
    echo SUGGERIMENTI:
    echo - Copia TUTTI i file dalla directory di sviluppo
    echo - NON copiare solo il .exe, serve TUTTA la cartella
    echo - Verifica che home_config.txt sia nella root
    echo.
)

pause
