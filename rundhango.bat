@echo off
cd /d "D:\stockmarket\AutoVest-Analytics"
REM Call Python directly from virtualenv
D:\stockmarket\AutoVest-Analytics\venv\Scripts\python.exe manage.py runserver 0.0.0.0:7500
pause