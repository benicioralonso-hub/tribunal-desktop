@echo off
REM Setup Electron en Windows (CMD). Doble clic o: scripts\setup-windows.cmd
setlocal
cd /d "%~dp0\.."

echo [setup-windows] npm install...
call npm.cmd install
if errorlevel 1 exit /b 1

echo [setup-windows] ensure-electron...
call npm.cmd run electron:install
if errorlevel 1 (
  echo.
  echo Descarga automatica fallo. Si ya bajaste el ZIP:
  echo   npm.cmd run electron:unpack-zip -- %%USERPROFILE%%\Downloads\electron-v37.10.3-win32-x64.zip
  echo.
  echo Link:
  echo   https://github.com/electron/electron/releases/download/v37.10.3/electron-v37.10.3-win32-x64.zip
  exit /b 1
)

echo [setup-windows] npm run dev...
call npm.cmd run dev
