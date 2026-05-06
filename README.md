# 卡尔技能训练网页

一个无构建依赖的 Dota 2 Invoker 训练器。重点不是只按出 Q/W/E 三球，而是练习更贴近实战的三球滚动、Invoke、技能槽、释放键、物品键和冷却节奏。
https://jianwanking.github.io/dota2-invoker-trainer/

## 功能

- `随机技能`：随机滚动 10 个卡尔技能，当前目标固定在中线。
- `固定连招`：内置常见连招，也可以新建、删除、重排和保存自己的连招。
- `真实实战`：在固定连招基础上启用 Invoke CD、技能 CD、物品 CD，以及 D/F 技能槽轮转。
- `自由模式`：不设目标连招，随便按；成功释放的技能/物品会按图标记录为一行，5 秒断开后自动上移成历史。
- `键位`：支持现代 D/F 槽位、传统每技能独立键、自定义 Q/W/E、Invoke、释放键和物品键。
- `技能表`：可展开查看每个技能图标、组合球和当前键位路径。
- `刷新`：真实实战和自由模式里有练习用“刷新技能”按钮；刷新球会重置技能和物品 CD，并让刷新球自己进入 180 秒 CD。

## 运行

直接打开 `index.html` 即可。为了避免浏览器对本地模块文件的限制，也可以用仓库内置的小静态服务器：

```bash
node server.mjs
```

然后访问：

```text
http://localhost:4173
```

## 测试

```bash
node tests/run-tests.mjs
```

测试覆盖三球缓冲、技能识别、Invoke CD 公式、D/F 槽轮转、技能 CD、物品 CD、刷新球重置 CD、手动刷新按钮，以及随机/固定/真实/自由模式的核心输入判定。

## 数据说明

- 技能和图标数据按 2026-05-03 查到的 Dota 2 当前资料固化。
- 技能图标和物品图标使用 Steam 官方 CDN，不下载到仓库。
- Invoke CD 规则为 `7s - 总球等级 * 0.3s`。
- 刷新球使用 `Refresher Orb` 当前数据：`180s` CD，`325` 蓝耗；训练器只模拟冷却刷新，不模拟蓝量不足。
- 真实模式暂不模拟蓝耗、施法前摇、鼠标点目标、敌我状态、BKB、驱散等战斗语境，只模拟练习手感最关键的键位、槽位和 CD。

## 资料来源

- Dota 2 官方 Invoker datafeed: https://www.dota2.com/datafeed/herodata?language=english&hero_id=74
- Steam 图标 CDN: https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/
- Dota 2 Wiki Hotkeys: https://dota2.fandom.com/wiki/Hotkeys
- Dota 2 Wiki Invoker: https://dota2.fandom.com/wiki/Invoker
- Liquipedia Invoker: https://liquipedia.net/dota2/Invoker
- BO3 Invoker guide: https://bo3.gg/dota2/articles/invoker-guide-dota-2
