@echo off
setlocal
cd /d "%~dp0"

where py >nul 2>nul
if not errorlevel 1 (
  py -3 -c "import socket, http.server" >nul 2>nul
  if not errorlevel 1 goto use_py
)

:find_python
set "PYTHON_EXE="
for /f "delims=" %%P in ('where python 2^>nul') do (
  "%%P" -c "import socket, http.server" >nul 2>nul
  if not errorlevel 1 set "PYTHON_EXE=%%P"
)
if defined PYTHON_EXE goto use_python

echo Python 3 was not found. Install Python 3, then run this file again.
pause
exit /b 1

:use_py
echo NEXUS is available at http://127.0.0.1:4173
py -3 nexus_server.py
exit /b %errorlevel%

:use_python
echo NEXUS is available at http://127.0.0.1:4173
"%PYTHON_EXE%" nexus_server.py
exit /b %errorlevel%
