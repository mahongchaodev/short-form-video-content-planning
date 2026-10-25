ARG BASE_IMAGE=hub.byted.org/library/debian:bookworm-slim

FROM ${BASE_IMAGE}

ARG APT_MIRROR=http://mirrors.aliyun.com/debian
ARG APT_SECURITY_MIRROR=http://mirrors.aliyun.com/debian-security

ENV APP_DIR=/opt/short-form-video-content-planning \
    WEB_ROOT=/usr/share/nginx/html \
    REPO_DIR=/data/repo \
    GIT_BRANCH=master \
    AUTO_PULL_INTERVAL=0

RUN set -eux; \
    if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
      sed -i \
        -e "s#http://deb.debian.org/debian#${APT_MIRROR}#g" \
        -e "s#http://security.debian.org/debian-security#${APT_SECURITY_MIRROR}#g" \
        /etc/apt/sources.list.d/debian.sources; \
    elif [ -f /etc/apt/sources.list ]; then \
      sed -i \
        -e "s#http://deb.debian.org/debian#${APT_MIRROR}#g" \
        -e "s#http://security.debian.org/debian-security#${APT_SECURITY_MIRROR}#g" \
        /etc/apt/sources.list; \
    fi; \
    apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates git nginx nodejs wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR ${APP_DIR}
COPY . ${APP_DIR}
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY scripts/update-site.sh /usr/local/bin/update-site
COPY scripts/container-entrypoint.sh /usr/local/bin/container-entrypoint
RUN rm -f /etc/nginx/sites-enabled/default /etc/nginx/sites-available/default \
    && chmod +x /usr/local/bin/update-site /usr/local/bin/container-entrypoint \
    && update-site

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1

ENTRYPOINT ["/usr/local/bin/container-entrypoint"]
