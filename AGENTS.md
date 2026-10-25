# 短视频创作规划：代理协作说明

本文件适用于 `short-form-video-content-planning/` 及其所有子目录。所有面向用户的沟通、目录说明、模板正文和新增内容均使用中文；文件名、目录名和 GitBook Space 名称保持既有的英文 kebab-case 约定。

## 内容真源与边界

- 本目录是 **Short-Form Video Content Planning** 的本地 Markdown 内容真源；对应 GitBook Space ID 为 `PvV0Wl8B1sGKlplExkQj`。
- `/data00/mygit/book/` 是多个 Space 共用的 Git 仓库根目录。不要把本 Space 的页面、素材或模板直接写到仓库根目录或其他 Space 的一级目录。
- GitBook 是后续的阅读与协作入口。修改 GitBook 内容必须先创建变更请求；未经用户明确确认，不得合并变更请求、发布站点或配置同步。
- 不得在未获用户明确许可的情况下执行 `git commit`、推送远程仓库、删除内容、批量重命名目录，或覆盖用户已有的策划与素材文件。

## 目录与命名规则

```text
<赛道>/
├── account-positioning.md
└── content-planning/
    ├── README.md
    └── video-<nnn>-<短名称>/
        ├── video-plan.md
        ├── assets/
        └── prompts/
```

- 一级赛道目录采用英文 kebab-case，例如 `ai-office-productivity`、`mother-baby`。
- 单条视频使用三位序号，如 `video-001-meeting-summary`；目录名称稳定后不随标题微调而改名。
- 每新建视频，必须更新所属赛道 `content-planning/README.md` 的视频索引。
- 优先复制 `templates/` 中的模板，再填充内容；不要删除模板中的验收、边界或复盘字段。

## 内容维护准则

- `account-positioning.md`：先明确目标受众、典型场景、差异化与内容边界，再开始选题。账号定位变化时，评估受影响的视频规划与视频，而不是只改标题。
- `content-planning/README.md`：记录固定栏目、发布节奏、视频清单和复盘规则；不要把单条视频的完整脚本堆在这里。
- `video-*/video-plan.md`：保存单条视频的策划简报、脚本与镜头、制作清单、发布指标和复盘。修改结论时保留可追溯的证据或来源链接。
- AI 办公提效内容应呈现适用条件与人工核验环节，不得虚构节省时间、效果数据、客户案例或产品能力。
- 母婴内容必须写清适用阶段、信息来源与边界；不得将个人经验表述为医疗诊断或治疗建议，不得保存或发布儿童及家庭可识别隐私。

## 素材与 Agent Prompt

- 每条视频的 `assets/README.md` 是素材台账，至少记录用途、来源或链接、授权/使用限制和状态。原始视频、渲染文件等大文件默认存放在受管存储，只在台账中记录链接。
- `prompts/` 中一个任务一个 Markdown 文件。每份 Prompt 必须包含：任务目标、输入上下文、执行要求、输出格式和验收标准。
- Prompt、素材台账和文稿中不得写入密钥、Token、手机号、儿童身份信息或其他不应提交 Git 的敏感数据。

## 变更流程

1. 先阅读目标文件、所属赛道视频索引及相关账号定位，确认不会破坏既有层级。
2. 将修改限制在最小必要范围；新增内容时同步更新上层索引。
3. 检查 Markdown 链接、相对路径、序号唯一性和表格完整性。
4. 向用户说明变更文件、内容结论与尚未完成的待填字段。

## GitBook 同步规则

- 未来同步时，以本目录作为 GitBook 的 `repoProjectDirectory`，不要将父仓库根目录直接作为单一 Space 的内容根目录。
- 若通过 GitBook API/CLI 写入页面，先确认 Space 归属 `mhc` 组织（`lZHQ2oggO6j4W45vcGjT`），并仅通过变更请求操作。
- 创建变更请求后只报告其 ID 和内容摘要；等待用户明确说“合并”后才执行 merge。
