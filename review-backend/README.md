# ABGame 在线评审上线与迁移

GitHub Pages 仍存放需求文档（Git 是内容的唯一来源）；Cloudflare 同域提供在线入口和 D1 评审。药品评分、道具状态、意见及互动动作历史在 D1，精灵球可按需求段落写意见。GitHub Pages 上的旧入口可浏览并链接到在线评审，不再创建另一份本地评审。

## 上线前

1. 备份现有 D1 并导出旧评审。不要覆盖或删除旧 Worker、D1 表或 WorkBuddy 项目。现有域名的 `/reviews` 和 `/health` 不切换。
2. 在同一 Cloudflare 账户为 `abgame-review.kccecil.com/abgame-items/*` 配置 [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/)，仅允许已授权评审人员；沿用团队身份提供商，不启用共享评审口令或公开绕过规则。首次访问沿用团队登录；评审页不再要求输口令或填写云端地址。
3. 从 `wrangler.jsonc` 复制本地生产配置 `wrangler.production.jsonc`，把 `database_name` 和 `database_id` 改为现有评审 D1 的实际名称与 ID，保留新的 Worker 名称。添加 `"routes": [{"pattern":"abgame-review.kccecil.com/abgame-items/*","zone_name":"kccecil.com"}]` 和 `"vars": {"ACCESS_ISSUER":"https://<team>.cloudflareaccess.com","ACCESS_AUDIENCE":"<Access application AUD>"}`。此 [Worker 路由](https://developers.cloudflare.com/workers/configuration/routing/routes/) 只扩展同一域名下的 ABGame 路径，不覆盖现有接口或 PixelHoops。生产配置不要提交。
4. 进入此目录，用 Node 22+ 执行 `npm ci`、`npm test`。确认目标账户、D1 备份和路由后，运行 `npx wrangler d1 migrations apply REVIEWS --remote -c wrangler.production.jsonc`；新表为 `item_status`、`item_notes`、`item_scores`、`interaction_reviews`。

## 评审数据迁移

- 导出 WorkBuddy 当前选用的表：`weapon3_status`、`weapon3_notes`、`med2_status`、`med2_notes`、`med2_scores`、`loot6_status`、`loot6_notes`；同一导出 JSON 以表名为键、行数组为值。武器仅取 `v9_`、药品仅取 `v3_`，并去掉旧版本前缀。战利品保留原共用集合。
- 从旧 D1 导出 `interaction` 文档（或由旧接口持有人导出同一列表），将原始行数组放在同一 JSON 的 `interaction` 键下。保留原记录时间、署名、状态和意见。没有记录时也应提供经核对的空数组，不以空值掩盖导出故障。
- 导出包含团队评审内容，留在受控目录，不提交或公开。运行 `node migrate-legacy.mjs /path/to/legacy-tables.json > /path/to/import.sql`，核对范围和条数，再运行 `npx wrangler d1 execute REVIEWS --remote -c wrangler.production.jsonc --file /path/to/import.sql`。重跑同一份导出不会添加重复评论，也不会用更旧的结论覆盖较新的状态。核对各文档行数、最新意见和评分后再切换入口；切换前重做一次最终导出，避免漏掉切换期间的新记录。
- 本机模式的记录可能从未进入旧后台：在原来使用的浏览器打开武器、药品或战利品评审汇总，导出 JSON，再到同一文档的在线评审汇总导入；不要批量把每台浏览器的缓存当作云端源。互动旧浏览器尚未上传的意见应在旧页面先同步，或由持有人导出后补到迁移数据。

## 切换和核对

运行 `npm run deploy`，待静态改动经 PR 合并发布后打开 [ABGame 在线评审](https://abgame-review.kccecil.com/abgame-items/)。用有权限的两个独立浏览器核对新意见和互动目录状态，确认未登录无法读取或写入评审。只用测试环境/测试文档写测试内容。确认旧 `/reviews` 可用后再决定下线旧入口；回滚只撤销新增路由和回退前端，先保全 D1 与新期间写入。
