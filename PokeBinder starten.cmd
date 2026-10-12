@echo off
rem Starts PokeBinder with a double click: builds the app, serves it on this computer
rem and opens it in the browser. Keep this window open; closing it stops PokeBinder.
rem (Set POKEBINDER_NO_BROWSER=1 to start without opening the browser.)
title PokeBinder
cd /d "%~dp0"
set "PATH=C:\Program Files\nodejs;%PATH%"

rem Already running (from an earlier double click or "npm run dev")? Then just show it.
curl -s -o NUL http://localhost:5173/
if not errorlevel 1 (
  call :browser
  exit /b 0
)

where node >NUL 2>&1
if errorlevel 1 (
  echo Node.js wurde nicht gefunden. Bitte Node.js installieren: https://nodejs.org
  pause
  exit /b 1
)

if not exist node_modules (
  echo Pakete werden installiert, das dauert beim ersten Mal etwas ...
  call npm.cmd install
  if errorlevel 1 goto failed
)

echo PokeBinder wird gebaut ...
call npm.cmd run build
if errorlevel 1 goto failed

rem Open the browser a moment after the server has started.
if not defined POKEBINDER_NO_BROWSER start "" /min cmd /c "timeout /t 2 /nobreak >NUL & start http://localhost:5173/"

echo.
echo PokeBinder laeuft unter http://localhost:5173/
echo Dieses Fenster offen lassen. Zum Beenden das Fenster schliessen.
echo.
call npm.cmd run start
exit /b 0

:browser
if not defined POKEBINDER_NO_BROWSER start "" http://localhost:5173/
exit /b 0

:failed
echo.
echo Der Start ist fehlgeschlagen. Die Meldung oben nennt den Grund.
pause
exit /b 1
