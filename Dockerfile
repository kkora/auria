# Auria in a headless Linux container — proves the full audit, including the narrated
# video, runs server-side (the P2 milestone / the SaaS-worker story).
#
#   docker build -t auria .
#   docker run --rm -v "$PWD/out:/out" auria \
#     https://example.com/page --out /out            # analysis + reports + narrated video
#
# Narration uses espeak-ng (the cross-platform TTS engine, auto-selected on Linux). For
# higher-quality neural narration, mount a Piper voice and set PIPER_VOICE/PIPER_BIN.
FROM node:22-bookworm-slim

# espeak-ng: cross-platform narration TTS. fonts-liberation: legible text in the recorded
# video. ffmpeg is provided by ffmpeg-static (fetched per-platform during `npm ci`), so no
# system ffmpeg is needed. Chromium's own OS libs are installed by `playwright install
# --with-deps` below.
RUN apt-get update && apt-get install -y --no-install-recommends \
      espeak-ng ca-certificates fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci
# Chromium + its Linux system libraries; headless recordVideo runs against it.
RUN npx playwright install --with-deps chromium

COPY . .

# Default output dir inside the container; mount a volume or pass --out to collect it.
ENTRYPOINT ["node", "bin/auria.mjs"]
CMD ["--help"]
