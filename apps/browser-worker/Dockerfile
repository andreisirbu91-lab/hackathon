FROM mcr.microsoft.com/playwright:v1.60.0-noble

# X server, VNC, noVNC, fluxbox WM
RUN apt-get update && apt-get install -y --no-install-recommends \
      xvfb x11vnc fluxbox novnc websockify supervisor \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund

COPY src ./src
COPY start.sh ./
RUN chmod +x start.sh

# 6080 = noVNC HTTP, 3002 = Playwright WS, 5900 = raw VNC
EXPOSE 6080 3002 5900

CMD ["./start.sh"]
