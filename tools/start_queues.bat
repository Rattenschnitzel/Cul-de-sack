@echo off
rem The live page of both PCs' ComfyUI queues (tools\queue_watch.py), at http://localhost:8521
rem Double-click to start. Closing this window stops it.
title ComfyUI queues (Cul-de-sack)
cd /d "%~dp0"
start "" http://localhost:8521
"C:\Users\mail\AppData\Local\Programs\Python\Python310\python.exe" queue_watch.py
echo.
echo The queue page stopped. Press a key to close.
pause >nul
