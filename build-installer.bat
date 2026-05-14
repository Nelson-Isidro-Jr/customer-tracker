@echo off
setlocal enabledelayedexpansion
title Customer Tracker - Build Installer
color 0A

echo.
echo  =========================================
echo   Customer Tracker  -  Build Installer
echo   by Nelson Isidro
echo  =========================================
echo.

:: Check Node.js
echo [1/4] Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Node.js is NOT installed.
    echo.
    echo  Please download and install Node.js LTS from:
    echo  https://nodejs.org
    echo.
    echo  After installing, restart this script.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do echo  [OK] Node.js %%v found

:: Read version from package.json (single source of truth)
for /f "tokens=*" %%v in ('node -p "require('./package.json').version"') do set APP_VERSION=%%v
echo  [OK] Building version %APP_VERSION%

echo.
echo [2/4] Installing dependencies...
echo  (First run may take 2-5 minutes)
echo.
npm install
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Dependency install failed.
    echo.
    echo  Possible fixes:
    echo    - Check your internet connection
    echo    - Run this script as Administrator
    echo    - Run: npm cache clean --force  then try again
    echo.
    pause
    exit /b 1
)
echo.
echo  [OK] Dependencies installed

echo.
echo [3/4] Building application...
npm run build
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Build failed. Check errors above.
    echo.
    pause
    exit /b 1
)
echo  [OK] Application built

echo.
echo [4/4] Creating Windows installer...
npx electron-builder --win --x64
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Installer creation failed.
    echo.
    pause
    exit /b 1
)

echo.
echo  =========================================
echo   SUCCESS!
echo.
echo   Your installer is ready in:
echo   dist-installer\
echo.
echo   File:  Customer Tracker Setup %APP_VERSION%.exe
echo.
echo   Double-click it to install the app.
echo  =========================================
echo.
pause
