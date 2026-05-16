#!/bin/bash
set -e

# Xvfb display
Xvfb :99 -screen 0 1280x800x24 -ac +extension RANDR +extension GLX &
export DISPLAY=:99
sleep 0.5

# Lightweight WM (helps with window placement and focus)
fluxbox >/dev/null 2>&1 &
sleep 0.3

# VNC server on :99 (port 5900)
x11vnc -display :99 -nopw -forever -shared -rfbport 5900 -quiet >/dev/null 2>&1 &
sleep 0.3

# noVNC websocket bridge on port 6080 → 5900
websockify --web=/usr/share/novnc/ 6080 localhost:5900 >/dev/null 2>&1 &
sleep 0.3

echo "[browser-worker] Xvfb :99, x11vnc:5900, noVNC:6080, Playwright WS:3002"

# Playwright server (headed because DISPLAY is set) — audience sees the browser
exec npx playwright run-server --port 3002 --path /
