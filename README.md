# 短视频内容策划

本目录是 **Short-Form Video Content Planning** Space 的本地内容真源。内容按赛道（领域）组织；每个赛道先定义账号定位，再在 `content-planning/` 下直接沉淀每条视频的制作资料。

## 目录约定

```text
<domain>/
├── account-positioning.md          # 账号定位、受众和内容边界
└── content-planning/
    ├── README.md                   # 栏目、发布节奏和全部视频索引
    └── video-<nnn>-<slug>/         # 单条视频的可执行资料
        ├── video-plan.md           # 详细策划、脚本、镜头与发布复盘
        ├── assets/                 # 素材索引、授权和外部存储链接
        └── prompts/                # 按任务拆分的 Agent Prompt
```

## 开始方式

1. 先填写各领域的 `account-positioning.md`，明确账号要为谁解决什么问题。
2. 在领域的 `content-planning/README.md` 登记栏目、发布节奏和视频索引。
3. 在 `content-planning/` 下新增 `video-001-<slug>/`；复制 `templates/video-plan.md` 和 `templates/agent-prompt.md`。
4. 将小型可版本管理素材放进 `assets/`，并在 `assets/README.md` 记录来源、授权和链接。原始视频、渲染文件等大文件默认放在受管存储，不直接提交 Git。

## GitBook 同步

当前 Space 目录以本地 Markdown 为内容真源。常规流程是：先提交并推送 Git，然后使用脚本将本目录内容写入 GitBook 变更请求，并在检查通过后合并发布正式 GitBook。

```bash
node scripts/sync-to-gitbook-space.mjs --dry-run
node scripts/sync-to-gitbook-space.mjs --subject "Sync short-form video planning content"
```

脚本默认同步到 mhc 组织下的 **Short-Form Video Content Planning** Space（`PvV0Wl8B1sGKlplExkQj`），并会先校验 Space 属于授权组织 `lZHQ2oggO6j4W45vcGjT`。脚本只负责创建/更新 GitBook 变更请求；本项目默认在同步检查通过后继续执行 merge 发布正式 GitBook。若只想保留草稿，需要在任务中明确说明“不要合并/不要发布”。

常用参数：

- `--change-request <id>`：续跑并更新已有变更请求。
- `--skip-existing`：续跑时跳过已存在页面，只补缺失页面。
- `--delete-stale`：删除变更请求中本地已不存在的旧页面；默认不删除，使用前先 `--dry-run` 核对页面树。

同步时会尽量将 GitBook 页面标题中文化，例如 `Agent Prompt` 会显示为“代理提示词”；文件名和 URL slug 继续保持英文 kebab-case，方便链接稳定。

如果后续改为 GitBook 官方 Git Sync，将父仓库推送到可访问的远程地址后，使用本目录作为 GitBook 的 `repoProjectDirectory` 配置同步，避免本地 Markdown 与 GitBook 页面双向编辑产生冲突。

## 自托管 Nginx 镜像

本仓库支持把 Markdown 内容生成静态 HTML，并随 Nginx 打包为镜像。镜像内置一份构建时内容，同时也支持容器运行时 `git pull` 后热更新静态文件，不需要重建镜像或重启容器。

```bash
npm run build:site
bash scripts/build-and-push-image.sh
```

默认镜像地址：

```text
registry.cn-hangzhou.aliyuncs.com/mhc_private/short-form-video-content-planning
```

如果只在本地构建不推送：

```bash
bash scripts/build-and-push-image.sh --no-push
```

构建默认使用国内 apt 依赖源：

- `APT_MIRROR=http://mirrors.aliyun.com/debian`
- `APT_SECURITY_MIRROR=http://mirrors.aliyun.com/debian-security`

当前静态站生成器零 npm 依赖，容器内只安装 `nodejs` 运行脚本，不安装 npm 包。

如需切换源：

```bash
APT_MIRROR=http://mirrors.tuna.tsinghua.edu.cn/debian \
APT_SECURITY_MIRROR=http://mirrors.tuna.tsinghua.edu.cn/debian-security \
bash scripts/build-and-push-image.sh
```

服务器一键部署：

```bash
docker login registry.cn-hangzhou.aliyuncs.com
IMAGE=registry.cn-hangzhou.aliyuncs.com/mhc_private/short-form-video-content-planning:latest \
GIT_REPO_URL=https://github.com/mahongchaodev/short-form-video-content-planning.git \
PORT=8080 \
bash scripts/deploy-image.sh
```

部署后访问 `http://服务器IP:8080/`；如需绑定域名，可用服务器 Nginx 或负载均衡将域名反向代理到该端口。

内容更新但不重建/不重启容器：

```bash
IMAGE=registry.cn-hangzhou.aliyuncs.com/mhc_private/short-form-video-content-planning:latest \
GIT_REPO_URL=https://github.com/mahongchaodev/short-form-video-content-planning.git \
bash scripts/deploy-image.sh
```

脚本发现容器已存在时，会执行容器内 `update-site`：`git fetch && git pull --ff-only`，重新生成静态 HTML 并覆盖 Nginx Web 根目录；Nginx 会直接读取新文件。

也可以开启容器内自动轮询更新：

```bash
IMAGE=registry.cn-hangzhou.aliyuncs.com/mhc_private/short-form-video-content-planning:latest \
GIT_REPO_URL=https://github.com/mahongchaodev/short-form-video-content-planning.git \
AUTO_PULL_INTERVAL=60 \
bash scripts/deploy-image.sh --recreate
```

如果 GitHub 仓库是私有仓库，将 `GIT_REPO_URL` 替换为带访问凭证的 HTTPS 地址，或在服务器上配置可用于容器拉取的只读仓库地址。
