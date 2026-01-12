@echo off
REM ============================================================================
REM Script Pulizia File Obsoleti - Campus Virtual Training
REM Data: 17 Gennaio 2026
REM Elimina 38 file obsoleti (debug, test, documentazione vecchia)
REM ============================================================================

echo.
echo ========================================
echo PULIZIA FILE OBSOLETI
echo ========================================
echo.
echo Questo script eliminera' 38 file obsoleti:
echo - 18 file debug/temporanei
echo - 4 file posizioni modelli vecchie
echo - 9 file HTML di test
echo - 7 file markdown obsoleti
echo.
echo ATTENZIONE: L'operazione e' IRREVERSIBILE!
echo.
pause

cd /d "C:\Users\mloffredo\claude"

echo.
echo [1/4] Eliminazione file debug/temporanei (18 file)...
if exist "console.txt" del /q "console.txt" && echo   ✓ Eliminato console.txt
if exist "console1.txt" del /q "console1.txt" && echo   ✓ Eliminato console1.txt
if exist "problema.txt" del /q "problema.txt" && echo   ✓ Eliminato problema.txt
if exist "bachi.txt" del /q "bachi.txt" && echo   ✓ Eliminato bachi.txt
if exist "dafare.txt" del /q "dafare.txt" && echo   ✓ Eliminato dafare.txt
if exist "test_mesh.txt" del /q "test_mesh.txt" && echo   ✓ Eliminato test_mesh.txt
if exist "step.txt" del /q "step.txt" && echo   ✓ Eliminato step.txt
if exist "remote.txt" del /q "remote.txt" && echo   ✓ Eliminato remote.txt
if exist "risultati.txt" del /q "risultati.txt" && echo   ✓ Eliminato risultati.txt
if exist "nuovarichiesta.txt" del /q "nuovarichiesta.txt" && echo   ✓ Eliminato nuovarichiesta.txt
if exist "nuovatelecamera.txt" del /q "nuovatelecamera.txt" && echo   ✓ Eliminato nuovatelecamera.txt
if exist "nuovefunzioni.txt" del /q "nuovefunzioni.txt" && echo   ✓ Eliminato nuovefunzioni.txt
if exist "oggettinascosti.txt" del /q "oggettinascosti.txt" && echo   ✓ Eliminato oggettinascosti.txt
if exist "interazione_pulsante_remote.txt" del /q "interazione_pulsante_remote.txt" && echo   ✓ Eliminato interazione_pulsante_remote.txt
if exist "logicaschermi.txt" del /q "logicaschermi.txt" && echo   ✓ Eliminato logicaschermi.txt
if exist "scarico_utensile.txt" del /q "scarico_utensile.txt" && echo   ✓ Eliminato scarico_utensile.txt
if exist "requisiti_funzionali.txt" del /q "requisiti_funzionali.txt" && echo   ✓ Eliminato requisiti_funzionali.txt

echo.
echo [2/4] Eliminazione file posizioni modelli obsoleti (4 file)...
if exist "model_positions unito_20251201_145625.txt" del /q "model_positions unito_20251201_145625.txt" && echo   ✓ Eliminato model_positions unito_20251201_145625.txt
if exist "model_positions_20251201_074134.txt" del /q "model_positions_20251201_074134.txt" && echo   ✓ Eliminato model_positions_20251201_074134.txt
if exist "model_positions_aperto_20251201_145715.txt" del /q "model_positions_aperto_20251201_145715.txt" && echo   ✓ Eliminato model_positions_aperto_20251201_145715.txt
if exist "model_positions_iniziale20251205_075210.txt" del /q "model_positions_iniziale20251205_075210.txt" && echo   ✓ Eliminato model_positions_iniziale20251205_075210.txt

echo.
echo [3/4] Eliminazione file HTML di test (9 file)...
if exist "debug_original_positions.html" del /q "debug_original_positions.html" && echo   ✓ Eliminato debug_original_positions.html
if exist "sync_test.html" del /q "sync_test.html" && echo   ✓ Eliminato sync_test.html
if exist "test_debug_fix.html" del /q "test_debug_fix.html" && echo   ✓ Eliminato test_debug_fix.html
if exist "test_drag_enable.html" del /q "test_drag_enable.html" && echo   ✓ Eliminato test_drag_enable.html
if exist "test_interchangeable_snap.html" del /q "test_interchangeable_snap.html" && echo   ✓ Eliminato test_interchangeable_snap.html
if exist "test_refactoring.html" del /q "test_refactoring.html" && echo   ✓ Eliminato test_refactoring.html
if exist "test_riassemblaggio_fix.html" del /q "test_riassemblaggio_fix.html" && echo   ✓ Eliminato test_riassemblaggio_fix.html
if exist "test_simplified_assembly.html" del /q "test_simplified_assembly.html" && echo   ✓ Eliminato test_simplified_assembly.html

echo.
echo [4/4] Eliminazione documentazione markdown obsoleta (7 file)...
if exist "ANALISI_TUTORIAL.md" del /q "ANALISI_TUTORIAL.md" && echo   ✓ Eliminato ANALISI_TUTORIAL.md
if exist "CRITICITA_VITI.md" del /q "CRITICITA_VITI.md" && echo   ✓ Eliminato CRITICITA_VITI.md
if exist "FIX_AVVITAMENTO_VITI.md" del /q "FIX_AVVITAMENTO_VITI.md" && echo   ✓ Eliminato FIX_AVVITAMENTO_VITI.md
if exist "NUOVE_FUNZIONALITA_SNAPPOINTPIVOT.md" del /q "NUOVE_FUNZIONALITA_SNAPPOINTPIVOT.md" && echo   ✓ Eliminato NUOVE_FUNZIONALITA_SNAPPOINTPIVOT.md
if exist "TASK_FIX_SNAPPOINTPIVOT_MULTITARGET.md" del /q "TASK_FIX_SNAPPOINTPIVOT_MULTITARGET.md" && echo   ✓ Eliminato TASK_FIX_SNAPPOINTPIVOT_MULTITARGET.md
if exist "TASK_IMPLEMENTA_SNAPPOINTPIVOT.md" del /q "TASK_IMPLEMENTA_SNAPPOINTPIVOT.md" && echo   ✓ Eliminato TASK_IMPLEMENTA_SNAPPOINTPIVOT.md
if exist "TUTORIAL_REVERSE_COMPLETATO.md" del /q "TUTORIAL_REVERSE_COMPLETATO.md" && echo   ✓ Eliminato TUTORIAL_REVERSE_COMPLETATO.md
if exist "TUTORIAL_REVERSE_V2_MODIFICHE.md" del /q "TUTORIAL_REVERSE_V2_MODIFICHE.md" && echo   ✓ Eliminato TUTORIAL_REVERSE_V2_MODIFICHE.md

echo.
echo ========================================
echo PULIZIA COMPLETATA!
echo ========================================
echo.
echo Eliminati fino a 38 file obsoleti.
echo Spazio liberato: ~500KB
echo.
echo File essenziali MANTENUTI:
echo   ✓ index.html
echo   ✓ home_config.txt
echo   ✓ Users.txt
echo   ✓ CLAUDE.md
echo   ✓ GUIDA_COMANDI_TUTORIAL.md
echo   ✓ CHEAT_SHEET.html
echo   ✓ MANUALE_*.html
echo.
pause
