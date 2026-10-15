# AGENTS.md · 本库维护约定

## 回归清单（改完 data/*.json 必跑，全绿才算完）

```bash
node tools/build_web.js    # 重建派生 bundle + engine.js（两个都是生成物，永远不手改）
node tools/check_fields.js # 字段体检：id 格式/空字段/prompt 禁中文/中英串味/坏字符/行业规范/配色卡校验
node tools/check_cases.js  # 体检：引用完整性 + 12 维覆盖矩阵 + 模板 fills/protect/checklist 校验
node tools/smoke.js        # 引擎冒烟（Node 直跑，无 jsdom）：装配顺序/冲突/算子/随机/商品信息/母版/批量/盘点
NODE_PATH=<jsdom> node tools/smoke-web.js   # 界面冒烟（含 CSS 绊线，覆盖九页，133 项）
# 验收闭环页（v-check）：API 配置/出图在 details 折叠内（playwright 测试要先点开 #apiBox summary）；
# 检测算法与 tools 外的 Node 原型同参数（128 采样、四角+四边 8 块 14px、非白阈值 24）——改一边要同步另一边。
node tools/inventory.js    # 盘点 + 覆盖缺口（数字现算，README 引用它）
node tools/gallery_sync.js # 画廊清单重建（--check 体检：清单与磁盘逐张 diff）
# 新图入库：JPG/PNG/WebP 均可直接放 gallery/（文件名=卡片 id）——页面自动探测扩展名，刷新即读
# （2026-10-14 起用户明确 PNG 不压缩也收；想控体积再跑 NODE_PATH=<sharp> node tools/gallery_compress.js，
#  PNG→1200px JPEG q88 并删原图——纯可选步骤）
# 想让清单也保持准确（可选）：双击 tools/gallery_sync.bat 同步一次，或 tools/gallery_watch.bat 守夜自动同步
```

## 约定

1. **id 一旦发布不可改**，新增条目只往后追加。组合串、案例配方、模板 fills、配色卡都引用 id。
2. **prompt 必须是英文视觉指令**，中文只出现在 zh/note/rules——check_fields 会拦。
3. **案例必须带 validates + tested**（boolean）。tested=false 表示未实测，不许在文档里宣称有效。
4. **冲突规则三件套缺一不可**：when / notWith / verdict+why。只写「会冲突」不写「听谁的」等于没写。
5. **模板三件套缺一不可**：fills / protect / checklist。fills 键用单数（form/goal/spec…），与案例一致。
6. **引擎单一真源是 tools/compose.js**：页面装配与 CLI 必须都走它。`assets/engine.js` 是它的副本
   （build_web.js 同步），改装配逻辑只改 compose.js 然后重跑 build_web。
   **compose.js 的注释里不能出现 `</script>` 字样**——内联注入 jsdom/打包时会把脚本截断，
   报错指向无关行，极难定位（2026-10-13 踩过：注释里写了示例 script 标签）。
7. 键名两套体系：维度文件/页面用**复数**（forms），案例配方与模板 fills 用**单数**（form），
   由 KEY2DIM 映射——真源在 compose.js，页面与 check 都引用它，不要再抄第二份。
   **注意 batchPlans 返回的 sel 已翻成复数键**（fills 单数入、复数出），页面直接按复数取。
8. **form 的 children 与 category 的 rules/aiTrap/compliance 是知识层**，不进提示词；
   新品类必须补 rules 与 aiTrap，有监管的品类补 compliance。
9. **变形算子**加进 compose.js 的 OPERATORS（apply 纯函数：入旧 sel 出新 sel），
   页面按钮自动出现在合成器工具栏，smoke.js 必须补对应断言。
10. spec 是平台铁律层：新增平台先查官方文档，硬性禁区写进 note，违规词面直接写进 prompt。
11. **画廊**：gallery/ 目录里文件名主干 = 卡片 id（CS-01.jpg / CS-01.png / CS-01.webp 均可）。
    **页面自适应扩展名**（2026-10-14 晚四）：渲染时按「清单路径 → jpg → png → webp」顺序探测，
    第一个加载成功的就是它——用户换图不用跑任何同步，刷新页面即读；清单（assets/gallery-imgs.js）
    降级为「已知路径缓存」，不再是页面能读到图的前提。assets/gallery-imgs.js 仍是派生物勿手改，
    野文件名进 GALLERY_UNCLAIMED 页面提示。PNG 可直接入仓库（2026-10-14 用户指定），
    想控体积再跑 gallery_compress.js（PNG→1200px JPEG q88 并删原图，纯可选）。
    点画廊图片区域 = 开详情浮层；点编号徽章 .gid = 复制配图文件名（不冒泡成详情）。
    清单维护两条路（都只是让清单保持准确，不影响页面读图）：一次性——双击
    tools/gallery_sync.bat（或 `node tools/gallery_sync.js`）；持续——双击 tools/gallery_watch.bat
    （守夜人 fs.watch 监听 gallery/，400ms 防抖，检测到增删替换自动重建；Ctrl+C 或关窗退出）。
    注意：bash 里 `node ... &` 起的后台进程会在会话结束时被清理，守夜人必须用 bat 独立窗口跑。
    用户批量换图期间清单会暂时落后于磁盘（--check 报不一致）——页面不碎，属预期，
    换完跑一次 gallery_sync 即对齐。
12. **配色卡 palettes.json**：每个 style 必须且只能有一张（check_fields 查双向）；
    色值 4-6 个合法 hex；cats/scenes/lights/layouts 引用必须存在。
    配色卡是参考层不进提示词，但画廊色卡与词条抽屉都从它派生——改色只改这里。
13. **商品信息三段**（name/selling/audience）在页面多处共享同一份 state：
    自定义出图填了，合成器与工作台的「载入」会带过去。复制分三档：
    视觉指令（纯词面）/ 完整版（+商品保护规则+负面词）/ 母版（8 节，缺位显示【填写】）。
14. **配方盘 / 全部词条只在合成器页显示**：词条浏览是合成器内折叠区（#entriesBox），详情抽屉
    dtMask/dtPanel 挂在 body 层不在任何 main 内——新页面不得再复刻这两块 UI。
    自定义出图带**独立成品输出区**（#easyOut，2026-10-14 用户指定回改：成品在本页直接出 +
    「随机来一张」，去合成器是次级入口）；画廊详情浮层不内联配方模块表与成品词面（只读展示
    一律经「复制/载入」动作取词）；抽卡随机案例卡与批量结果卡属只读结果预览，不算复刻。
    链接/文案解析在**独立页 v-linkgrab（链接出图）**：#linkUrl/#btnFetch 读取（公共跨域通道
    allorigins/corsproxy，纯前端不存数据）+ #linkPaste/#btnParse2 粘贴解析兜底，失败必须如实降级
    不硬编；解析是纯本地词典（品类 14 组关键词 + 平台 host 规则 + 功效词正则）；出**主图 + 详情
    两份词面**（详情基座=详情预设 + 长图规格覆盖 + 同品类）。自定义出图**不含**解析块。
    **公共代理过不了淘宝/京东/Amazon 登录墙是常态**（2026-10-14 实测：allorigins 522、corsproxy 401
    收费、cors.eu.org 429+验证码、codetabs/workers 不可达）——页面必须如实说明，主力解是
    **🔖 书签一键抓取**（#bmkCard/#bmklet/#bmkCopyCode）：grabInfo() 自包含函数，href 用
    `grabInfo.toString()` 生成（**不许写字符串数组拼 bookmarklet——四层转义会把正则反斜杠吃光**，
    2026-10-14 实锤）；抓 title/description/价格/店铺进剪贴板，用用户自己的登录态，零请求零存储。
    **只粘链接、无商品文案（junk=去掉 URL 后无文字）必须明确报失败**，不准因识别出平台就假成功
    （2026-10-14 用户实截图 bug：满屏「未识别」看似坏了）。品类词典含食品速食词（拌饭/米饭/自热…）；
    商品名提取**保留行边界再分割**（店铺名里的「旗舰」曾误杀真品名段）、优先取含品类词的段、
    砍 `/12桶装` 与 `124g` 规格尾巴。
    **预设卡点击必须按 idx（presetCards.children[idx]）**：白底主图与场景化主图同 spec（SP-01），
    用 data-spec 选择器永远命中第一张（2026-10-14 实锤 bug）；预设卡高亮同步用 dataset.key。
15. **批量出图 BATCH_PLANS**：五图型骨架 + 用户 spec/category/style/material 覆盖同名位，
    每张自带冲突检查——改骨架或加图型，smoke.js 的批量断言要同步。
16. **视图显隐与布局类**：显隐只走 `.view.on`；**任何挂在 main.view 上的布局类不得设 display**，
    若必须设（如 .wrap 的 grid），必须同时写显式关闭态 `main.wrap.view{display:none}`，
    否则同特异性后者胜出、合成器会在全部页面泄露（2026-10-14 事故）。smoke-web 有静态 CSS
    源文本绊线（「CSS 绊线」两条），改视图结构必须保持其通过；界面显隐类改动加跑真实 Chrome 复现。

## 已知边界（不许在文档里吹掉）

- 提示词未经模型逐条实测（seen≠test，案例 tested=false）。
- 平台规则会改版，note 里的尺寸只是快照。
- 配色 hex 是搭配起点，不是品牌规范。

## 发布到 GitHub（仓库未建，建后照此推）

本机环境事实（跨项目通用）：github.com 直连不通、api.github.com 通；
git 走代理 127.0.0.1:7890 且必须 `-c http.sslBackend=openssl`；gh 在 Git Bash 里 stdout 恒空，
取 token/建仓库走 PowerShell；推送别用 `-u`（防 token 落盘 .git/config）。

```bash
# 1. PowerShell 建仓库（gh 的 stdout 在 bash 里拿不到）
#    Invoke-RestMethod + Bearer $tok → POST https://api.github.com/user/repos
# 2. bash 推送
git -c http.sslBackend=openssl -c http.proxy=http://127.0.0.1:7890 push origin main
#    卡住超过几分钟 → 走 GitHub Git Data API 建 commit（api.github.com 直连很快）
# 3. Pages：仓库 Settings → Pages → main 根目录（index.html 双击即用，不用起服务器）
```
