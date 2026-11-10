@echo off
setlocal
cd /d "%~dp0"
set "DASHBOARD_NODE="
for %%N in (node.exe) do if not "%%~$PATH:N"=="" set "DASHBOARD_NODE=%%~$PATH:N"
if not defined DASHBOARD_NODE if exist "%ProgramFiles%\nodejs\node.exe" set "DASHBOARD_NODE=%ProgramFiles%\nodejs\node.exe"
if not defined DASHBOARD_NODE (
  for /d %%D in ("%TEMP%\wydot-dashboard-runtime\node-v22.*-win-x64") do (
    if exist "%%~fD\node.exe" set "DASHBOARD_NODE=%%~fD\node.exe"
  )
)
if not defined DASHBOARD_NODE (
  echo Node.js 22.12 or newer is required. Install Node.js and reopen this launcher.
  if /i not "%~1"=="--no-open" pause
  exit /b 1
)
if not exist "node_modules\vite\bin\vite.js" (
  echo Dependencies are missing. Run npm ci from this folder first.
  if /i not "%~1"=="--no-open" pause
  exit /b 1
)
for %%N in ("%DASHBOARD_NODE%") do set "PATH=%%~dpN;%PATH%"
echo Cheyenne School Zone Safety - local research preview
echo Keep this window open. Press Ctrl+C to stop.
"%DASHBOARD_NODE%" "%~dp0scripts\start-local.mjs" %*
set "DASHBOARD_EXIT=%errorlevel%"
if not "%DASHBOARD_EXIT%"=="0" if /i not "%~1"=="--no-open" pause
exit /b %DASHBOARD_EXIT%
