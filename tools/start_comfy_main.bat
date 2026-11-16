@echo off
rem ComfyUI on this PC, port 8188, for the Cul-de-sack art scripts (tools\flux3.py).
rem Runs in its own window so it keeps going on its own; close the window to stop it.
title ComfyUI (Cul-de-sack art)
cd /d "C:\Users\mail\AppData\Local\Comfy-Desktop\ComfyUI-Installs\ComfyUI"
"ComfyUI\.venv\Scripts\python.exe" -s ComfyUI\main.py --port 8188 --listen 127.0.0.1 --disable-auto-launch --extra-model-paths-config "%~dp0comfy_paths_main.yaml"
echo.
echo ComfyUI stopped. Press a key to close.
pause >nul
