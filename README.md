# 短视频内容策划

本目录是 **Short-Form Video Content Planning** Space 的本地内容真源。内容按赛道（领域）组织；每个赛道先定义账号定位，再按一期一期的内容规划沉淀实际视频的制作资料。

## 目录约定

```text
<domain>/
├── account-positioning.md          # 账号定位、受众和内容边界
└── content-planning/
    ├── README.md                   # 全部期次的索引和排期
    └── phase-<nnn>-<topic>/        # 一期内容规划
        ├── README.md               # 本期主题、目标、选题与发布节奏
        └── video-<nnn>-<slug>/     # 单条视频的可执行资料
            ├── video-plan.md       # 详细策划、脚本、镜头与发布复盘
            ├── assets/             # 素材索引、授权和外部存储链接
            └── prompts/            # 按任务拆分的 Agent Prompt
```

## 开始方式

1. 先填写各领域的 `account-positioning.md`，明确账号要为谁解决什么问题。
2. 在领域的 `content-planning/README.md` 登记一期内容；复制 `templates/phase-plan.md` 作为新一期的起点。
3. 在期次目录中新增 `video-001-<slug>/`；复制 `templates/video-plan.md` 和 `templates/agent-prompt.md`。
4. 将小型可版本管理素材放进 `assets/`，并在 `assets/README.md` 记录来源、授权和链接。原始视频、渲染文件等大文件默认放在受管存储，不直接提交 Git。

## GitBook 同步

当前 Space 目录以本地 Markdown 为内容真源。可以使用脚本将本目录内容写入 GitBook 变更请求：

```bash
node scripts/sync-to-gitbook-space.mjs --dry-run
node scripts/sync-to-gitbook-space.mjs --subject "Sync short-form video planning content"
```

脚本默认同步到 mhc 组织下的 **Short-Form Video Content Planning** Space（`PvV0Wl8B1sGKlplExkQj`），并会先校验 Space 属于授权组织 `lZHQ2oggO6j4W45vcGjT`。脚本只创建并填充 GitBook 变更请求，不会自动合并或发布；确认内容无误后，再到 GitBook 后台合并变更请求。

如果后续改为 GitBook 官方 Git Sync，将父仓库推送到可访问的远程地址后，使用本目录作为 GitBook 的 `repoProjectDirectory` 配置同步，避免本地 Markdown 与 GitBook 页面双向编辑产生冲突。
