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
