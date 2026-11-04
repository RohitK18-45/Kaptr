FROM node:20-bookworm-slim

# Install ffmpeg, python3, curl and certificates
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    python3-pip \
    curl \
    ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Install official yt-dlp binary (runs natively on Debian glibc)
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
 && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

# Copy application files
COPY package.json ./
COPY server.js ./
COPY index.html ./
COPY styles.css ./
COPY app.js ./

EXPOSE 3000

ENV PORT=3000
ENV HOST=0.0.0.0

CMD ["node", "server.js"]
