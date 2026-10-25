#!/usr/bin/env bash
set -euo pipefail

update-site

if [[ "${AUTO_PULL_INTERVAL:-0}" =~ ^[0-9]+$ ]] && [[ "${AUTO_PULL_INTERVAL:-0}" -gt 0 ]]; then
  (
    while true; do
      sleep "${AUTO_PULL_INTERVAL}"
      echo "AUTO_PULL_INTERVAL tick: updating site"
      if ! update-site; then
        echo "update-site failed; keeping previous static files" >&2
      fi
    done
  ) &
fi

exec nginx -g 'daemon off;'
