# syntax=docker/dockerfile:1.7
#
# Sitemaxxing — text it your website for a fit check: nine screens, SEO and
# AI readability, and a fix list your coding agent applies.
#
# Built on Plow's OpenClaw base (plow-pbc/plow-openclaw-agent). That base is
# fetched here from a pinned commit instead of being copied into this repo, so
# this repo is MIT and carries only its own code. The steps up to "Usage
# reporting" reproduce the base's own Dockerfile at that commit.

FROM ghcr.io/openclaw/openclaw:2026.9.4@sha256:cc596b846506a5f4cfcee111394a2725f375f01cca2ebb492a161fd1b747f101

ARG PLOW_BASE_REF=9ac3a563a1c2454f97c50b18dc376386d8b3dec0
ARG TARGETARCH
LABEL org.opencontainers.image.source=https://github.com/Malchiior/sitemaxxing \
      org.opencontainers.image.licenses=MIT \
      co.plow.probe=/opt/plow/ro-probe
USER root

# ── Plow's base, at a pinned commit ──────────────────────────────────────────
ADD --keep-git-dir=false https://github.com/plow-pbc/plow-openclaw-agent.git#${PLOW_BASE_REF} /tmp/plow-base
RUN set -eu; \
    mkdir -p /opt/plow /var/lib/plow; chown node:node /var/lib/plow; \
    cd /tmp/plow-base; \
    cp -r boot plugin prompt skills build.ts package.json package-lock.json tsconfig.json /opt/plow/; \
    cd /opt/plow; \
    npm ci --omit=dev --omit=peer --omit=optional --ignore-scripts; \
    node /opt/plow/build.ts; \
    chmod +x /opt/plow/probe; \
    rm -rf /tmp/plow-base

# ── A browser: headless Chromium from Debian, plus fonts so pages render ─────
RUN set -eu; \
    apt-get update; \
    apt-get install -y --no-install-recommends chromium fonts-liberation fonts-noto-core fonts-noto-color-emoji; \
    rm -rf /var/lib/apt/lists/*; \
    chromium --version

# ── Usage reporting: the Agent Index client and agentsview, pinned ───────────
COPY reporter/pins /opt/ro/reporter/pins
RUN set -eu; \
    pin() { sed -n "s/^$1=//p" /opt/ro/reporter/pins; }; \
    sha="$(pin client_sha)"; \
    curl -fsS --max-time 60 -o /opt/ro/reporter/agent-index-client.py \
      "https://raw.githubusercontent.com/plow-pbc/agent-index-client/${sha}/standalone/agent_index_client.py"; \
    echo "$(pin client_sha256)  /opt/ro/reporter/agent-index-client.py" | sha256sum -c -; \
    arch="${TARGETARCH:-$(dpkg --print-architecture)}"; \
    version="$(pin agentsview_version)"; \
    curl -fsSL --max-time 120 -o /tmp/agentsview.tgz \
      "https://github.com/kenn-io/agentsview/releases/download/v${version}/agentsview_${version}_linux_${arch}.tar.gz"; \
    echo "$(pin "agentsview_${arch}_sha256")  /tmp/agentsview.tgz" | sha256sum -c -; \
    tar -xzf /tmp/agentsview.tgz -C /usr/local/bin agentsview; \
    chmod 0755 /usr/local/bin/agentsview; rm /tmp/agentsview.tgz

# ── This image's layer ───────────────────────────────────────────────────────
COPY boot/ /opt/plow/boot/
COPY build-ro.ts /opt/plow/build-ro.ts
COPY prompt/RO.md /opt/plow/prompt/RO.md
COPY render/ /opt/ro/render/
COPY assets/contact-photo.jpg assets/icon.png /opt/ro/assets/
COPY plugins/ro/ /opt/ro/plugins/ro/
COPY reporter/run.sh reporter/openclaw_bridge.py /opt/ro/reporter/
RUN set -eu; \
    node /opt/plow/build-ro.ts; \
    chmod 0755 /opt/ro/reporter/run.sh /opt/ro/reporter/openclaw_bridge.py; \
    chmod 0644 /opt/ro/reporter/agent-index-client.py

# Which agent this is on the Agent Index. Installs of this image join the
# listing as installers; only the publisher's registration sets the page.
ENV OPENCLAW_STATE_DIR=/var/lib/plow \
    OPENCLAW_CONFIG_PATH=/var/lib/plow/openclaw.json \
    OPENCLAW_NO_RESPAWN=1 \
    NODE_DISABLE_COMPILE_CACHE=1 \
    AGENT_ID=sitemaxxing \
    AGENT_NAME="Sitemaxxing" \
    AGENT_BLURB="Text it your website for a fit check: your homepage on 9 screens with what's broken measured, a Google preview, and whether AI can read you. Reply fix for a prompt your coding agent applies. Mog your competition with a fit check from our sitemaxxing AI agent." \
    AGENT_REPO=https://github.com/Malchiior/sitemaxxing \
    AGENT_RUNTIME="OpenClaw 2.0"

# The inherited healthcheck loads config and can race the boot state lock.
HEALTHCHECK NONE
USER node
CMD ["node", "/opt/plow/boot/ro-main.js"]
