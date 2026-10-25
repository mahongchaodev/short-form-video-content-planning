#!/usr/bin/env bash
set -euo pipefail

IMAGE="${IMAGE:-registry.cn-hangzhou.aliyuncs.com/mhc_private/short-form-video-content-planning:latest}"
NAME="${NAME:-short-form-video-content-planning}"
PORT="${PORT:-8080}"
DATA_DIR="${DATA_DIR:-/data/short-form-video-content-planning}"
GIT_REPO_URL="${GIT_REPO_URL:-}"
GIT_BRANCH="${GIT_BRANCH:-master}"
AUTO_PULL_INTERVAL="${AUTO_PULL_INTERVAL:-0}"
RECREATE=0

for arg in "$@"; do
  case "$arg" in
    --recreate) RECREATE=1 ;;
    --update-only) RECREATE=0 ;;
    *) echo "unknown argument: $arg" >&2; exit 1 ;;
  esac
done

if command -v docker >/dev/null 2>&1; then
  RUNTIME=docker
elif command -v podman >/dev/null 2>&1; then
  RUNTIME=podman
else
  echo "docker or podman is required on the target server" >&2
  exit 1
fi

echo "Pulling ${IMAGE}"
"$RUNTIME" pull "${IMAGE}"

if "$RUNTIME" ps -a --format '{{.Names}}' | grep -Fxq "${NAME}"; then
  if [[ "$RECREATE" == "1" ]]; then
    echo "Removing old container ${NAME}"
    "$RUNTIME" rm -f "${NAME}"
  else
    echo "Container ${NAME} already exists. Updating content in-place without rebuilding/restarting container."
    "$RUNTIME" exec \
      -e GIT_REPO_URL="${GIT_REPO_URL}" \
      -e GIT_BRANCH="${GIT_BRANCH}" \
      "${NAME}" update-site
    cat <<EOF

Updated existing container in-place:
- Container: ${NAME}
- URL: http://127.0.0.1:${PORT}/

Use --recreate only when you need to replace the image/container.
EOF
    exit 0
  fi
fi

mkdir -p "${DATA_DIR}/repo"

echo "Starting ${NAME} on port ${PORT}"
"$RUNTIME" run -d \
  --name "${NAME}" \
  --restart unless-stopped \
  -p "${PORT}:80" \
  -e GIT_REPO_URL="${GIT_REPO_URL}" \
  -e GIT_BRANCH="${GIT_BRANCH}" \
  -e AUTO_PULL_INTERVAL="${AUTO_PULL_INTERVAL}" \
  -v "${DATA_DIR}/repo:/data/repo" \
  "${IMAGE}"

cat <<EOF

Deployed:
- Container: ${NAME}
- Image: ${IMAGE}
- URL: http://127.0.0.1:${PORT}/
- Data dir: ${DATA_DIR}

Update without rebuilding/restarting:
  IMAGE=${IMAGE} GIT_REPO_URL=${GIT_REPO_URL:-<repo-url>} bash scripts/deploy-image.sh

Enable automatic git pull inside the running container:
  AUTO_PULL_INTERVAL=60 GIT_REPO_URL=<repo-url> bash scripts/deploy-image.sh --recreate

If this is a public server, bind your domain to this host and proxy/forward to port ${PORT}.
EOF
