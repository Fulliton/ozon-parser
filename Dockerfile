FROM node:20-bookworm-slim

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Avoid downloading Chromium bundled with puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Install system dependencies, Xvfb, fonts, dumb-init, and Google Chrome (amd64) or Chromium (arm64)
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    gnupg \
    ca-certificates \
    procps \
    xvfb \
    dumb-init \
    fonts-liberation \
    fonts-freefont-ttf \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libgbm1 \
    libnss3 \
    libpango-1.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libxshmfence1 \
    libxss1 \
    && ARCH="$(dpkg --print-architecture)" \
    && if [ "$ARCH" = "amd64" ]; then \
         wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
         && apt-get install -y --no-install-recommends ./google-chrome-stable_current_amd64.deb \
         && rm -f google-chrome-stable_current_amd64.deb; \
       else \
         apt-get install -y --no-install-recommends chromium; \
       fi \
    && if [ ! -f /usr/bin/google-chrome ] && [ -f /usr/bin/chromium ]; then \
         ln -s /usr/bin/chromium /usr/bin/google-chrome; \
       fi \
    && rm -rf /var/lib/apt/lists/*

# Set Chrome executable paths and production environment
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome
ENV CHROME_PATH=/usr/bin/google-chrome
ENV NODE_ENV=production

WORKDIR /app

# Install dependencies first for better layer caching
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application code
COPY src/ ./src/

# Ensure data directory exists
RUN mkdir -p /app/data

# Use dumb-init to reap zombie processes (Xvfb / Chrome) and forward signals correctly
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

CMD ["node", "src/index.js"]
