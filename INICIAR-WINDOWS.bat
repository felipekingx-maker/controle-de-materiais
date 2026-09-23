@echo off
chcp 65001 >nul
cd /d "%~dp0"
where py >nul 2>&1
if %errorlevel% equ 0 (
  py -3 iniciar.py
  pause
  exit /b
)
python --version >nul 2>&1
if %errorlevel% equ 0 (
  python iniciar.py
  pause
  exit /b
)
echo Para abrir por este atalho, instale o Python 3 em https://www.python.org/downloads/windows/
echo Alternativa: abra a pasta no VS Code e use a extensao Live Server.
echo Consulte o arquivo LEIA-PRIMEIRO.html.
pause
