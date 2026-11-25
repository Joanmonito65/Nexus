@echo off
setlocal
cd /d "%~dp0"

where py >nul 2>nul
if errorlevel 1 goto find_python
py -3 -c "import http.server" >nul 2>nul
if not errorlevel 1 goto use_py

:find_python
set "PYTHON_EXE="
for /f "delims=" %%P in ('where python 2^>nul') do (
  echo %%P|findstr /i /c:"WindowsApps" >nul
  if errorlevel 1 set "PYTHON_EXE=%%P"
)
if defined PYTHON_EXE goto use_python

echo Python 3 was not found. Install Python 3, then run this file again.
pause
exit /b 1

:use_py
echo When the server is running, open http://127.0.0.1:4173 in your browser.
echo This server listens only on this computer. Press Ctrl+C to stop it.
py -3 -m http.server 4173 --bind 127.0.0.1
exit /b %errorlevel%

:use_python
echo When the server is running, open http://127.0.0.1:4173 in your browser.
echo This server listens only on this computer. Press Ctrl+C to stop it.
"%PYTHON_EXE%" -m http.server 4173 --bind 127.0.0.1
exit /b %errorlevel%
