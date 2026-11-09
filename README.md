# DSH Skill Sync Manager

DeepSeek Harness 的技能管理插件，帮助你把 Codex 和 Cursor 的本地技能导入 Harness，并在侧栏查看和管理技能。

## 功能

- 扫描 Codex、Cursor 的个人及当前工作区技能目录，按名称跳过已存在的技能。
- 支持启动时、定时和手动同步；查看来源、搜索技能和管理模型调用状态。
- 对已记录来源的技能检查更新，并在更新前检查本地修改。
- 提供 `skill_sync_status` 和 `skill_sync_now` Agent 工具。

同步会复制技能到 Harness 可写技能目录。建议先检查技能内容，确认信任来源后再启用。

## 安装

需要支持插件安装的 DeepSeek Harness（声明兼容 `>=0.2.1-rc.2 <0.3.0`）。从源码构建安装包：

```bash
git clone https://github.com/rick-2023/dsh-skill-sync-manager.git
cd dsh-skill-sync-manager
npm pack
```

在 Harness 插件管理器中安装生成的 `.tgz` 文件。根据安装提示重启应用或重新打开 profile，然后在侧栏打开技能面板。

## 配置

默认在启动约 8 秒后同步，之后每小时同步一次；目标为 `user-dsh`，默认启用全部来源。可通过插件配置调整 `autoSyncOnBoot`、`bootDelayMs`、`intervalMs`、`targetRootId` 和 `enabledSourceIds`。默认配置见 [cordis.patch.yml](cordis.patch.yml)。

来源包括 `~/.codex/skills`、`~/.cursor/skills`、`~/.cursor/skills-cursor`，以及当前工作区的 `.codex/skills` 和 `.cursor/skills`。

## 开发与测试

```bash
pnpm install --frozen-lockfile
npm test
```

## 许可与致谢

本项目采用 [MIT License](LICENSE)。`dsh/vendor` 包含基于 [dsh-skill-station](https://github.com/WilShi/dsh-skill-station) 的代码，原作者版权与许可见 [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES)。
