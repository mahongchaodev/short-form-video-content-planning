#!/usr/bin/env bash
set -euo pipefail

IMAGE="${IMAGE:-registry.cn-hangzhou.aliyuncs.com/mhc_private/short-form-video-content-planning}"
TAG="${TAG:-$(git rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)}"
BASE_IMAGE="${BASE_IMAGE:-hub.byted.org/library/debian:bookworm-slim}"
APT_MIRROR="${APT_MIRROR:-http://mirrors.aliyun.com/debian}"
APT_SECURITY_MIRROR="${APT_SECURITY_MIRROR:-http://mirrors.aliyun.com/debian-security}"
PUSH=1

for arg in "$@"; do
  case "$arg" in
    --no-push) PUSH=0 ;;
    --push) PUSH=1 ;;
    *) echo "unknown argument: $arg" >&2; exit 1 ;;
  esac
done

if command -v docker >/dev/null 2>&1; then
  BUILDER=(docker build)
  PUSHER=(docker push)
  TAGGER=(docker tag)
elif command -v buildah >/dev/null 2>&1; then
  BUILDER=(buildah bud --format docker)
  PUSHER=(buildah push)
  TAGGER=(buildah tag)
else
  echo "docker or buildah is required" >&2
  exit 1
fi

echo "Building ${IMAGE}:${TAG}"
"${BUILDER[@]}" \
  --build-arg "BASE_IMAGE=${BASE_IMAGE}" \
  --build-arg "APT_MIRROR=${APT_MIRROR}" \
  --build-arg "APT_SECURITY_MIRROR=${APT_SECURITY_MIRROR}" \
  -t "${IMAGE}:${TAG}" \
  -t "${IMAGE}:latest" \
  .

if [[ "$PUSH" == "1" ]]; then
  echo "Pushing ${IMAGE}:${TAG}"
  "${PUSHER[@]}" "${IMAGE}:${TAG}"
  echo "Pushing ${IMAGE}:latest"
  "${PUSHER[@]}" "${IMAGE}:latest"
fi

cat <<EOF

Image ready:
- ${IMAGE}:${TAG}
- ${IMAGE}:latest

Deploy:
  IMAGE=${IMAGE}:latest bash scripts/deploy-image.sh
EOF
