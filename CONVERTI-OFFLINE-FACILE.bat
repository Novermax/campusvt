@echo off
REM ============================================================================
REM LAUNCHER PER CONVERSIONE OFFLINE
REM ============================================================================
REM Esegue lo script PowerShell bypassando execution policy
REM ============================================================================

color 0B
powershell -ExecutionPolicy Bypass -File "Converti-Offline.ps1"
pause
