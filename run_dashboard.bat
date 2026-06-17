@echo off
cd /d "%~dp0"
echo Starting Expensive.io...
echo.
echo Open this URL in your browser:
echo http://127.0.0.1:5055
echo.
".venv\Scripts\python.exe" app.py
pause
