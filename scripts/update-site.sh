#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/short-form-video-content-planning}"
WEB_ROOT="${WEB_ROOT:-/usr/share/nginx/html}"
REPO_DIR="${REPO_DIR:-/data/repo}"
GIT_REPO_URL="${GIT_REPO_URL:-}"
GIT_BRANCH="${GIT_BRANCH:-master}"

SOURCE_DIR="${APP_DIR}"

if [[ -n "${GIT_REPO_URL}" ]]; then
  if [[ -d "${REPO_DIR}/.git" ]]; then
    echo "Updating repository in ${REPO_DIR}"
    git -C "${REPO_DIR}" fetch origin "${GIT_BRANCH}"
    git -C "${REPO_DIR}" checkout "${GIT_BRANCH}"
    git -C "${REPO_DIR}" pull --ff-only origin "${GIT_BRANCH}"
  else
    echo "Cloning ${GIT_REPO_URL} into ${REPO_DIR}"
    rm -rf "${REPO_DIR:?}"/*
    git clone --branch "${GIT_BRANCH}" --depth 1 "${GIT_REPO_URL}" "${REPO_DIR}"
  fi
  SOURCE_DIR="${REPO_DIR}"
else
  echo "GIT_REPO_URL is empty. Building bundled content from ${APP_DIR}"
fi

TMP_OUTPUT="$(mktemp -d)"
trap 'rm -rf "${TMP_OUTPUT}"' EXIT

echo "Building static site from ${SOURCE_DIR}"
(
  cd "${SOURCE_DIR}"
  SITE_OUTPUT_DIR="${TMP_OUTPUT}" node scripts/build-static-site.mjs
)

echo "Publishing static files to ${WEB_ROOT}"
mkdir -p "${WEB_ROOT}"
find "${WEB_ROOT}" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
cp -a "${TMP_OUTPUT}/." "${WEB_ROOT}/"

echo "Site updated at $(date -Iseconds)"
