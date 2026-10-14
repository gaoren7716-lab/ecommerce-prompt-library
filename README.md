# 电商做图提示词库 ecommerce-prompt-library

开放式电商视觉 Prompt 知识库。一张电商图 = **12 个维度叠加**的成品，不是「选一个模板」：分类体系、行业经验、视觉模块、真实案例、质量标准、可重复执行的生产流程。

- **128 条词条**：12 维自由组合，理论组合空间 1.49 万亿+（页面现算）；冲突自动裁决，平台铁律选中即展开；
- **45 个验证案例**：覆盖 14 品类，各带按配方生成的 AI 配图（50 张，JPG/PNG/WebP 自动识别）；
- **纯静态单页应用**：双击 `index.html` 即用，免依赖免服务器；线上 https://gaoren7716-lab.github.io/ecommerce-prompt-library/

## 八个页签

| 页签 | 干什么 |
|---|---|
| 示例画廊 | 45 案例 + 5 模板共 50 卡，点图看详情，卡上一键复制/载入合成器 |
| 自定义出图 | 8 个场景预设 + 商品表单 + 平台铁律 → 实时出词，🎲 随机来一张 |
| 链接出图 | 粘贴商品链接/SKU 识别品类平台，出主图 + 详情两份词面；带书签抓取兜底 |
| 提示词合成器 | 核心三步（产出类型/品类/平台）+ 九维进阶微调，成品多格式复制 |
| 抽卡 | 抽没见过的组合，冲突自动规避；随机案例卡页内直出 |
| 全部词条 | 128 条检索，点「加入」直接进配方 |
| 风格配色 | 12 张风格配色卡，点色块复制 hex |
| 框架与体检 | 规模盘点 + 覆盖缺口 + 冲突裁决 + 平台规格速查 |

## 框架

见 [FRAMEWORK.md](FRAMEWORK.md)。一句话：**form / goal / category / style 是你定的；shot / people / scene / material / light / layout 是派生的；spec 是平台铁律，谁都不能碰。**

## 结构

```
index.html            八页单页应用（配方盘/成品/词条集中在合成器一页）
data/*.json           十二维条目 + 冲突规则 + 案例 + 模板 + 配色
gallery/              实测配图（文件名=卡片 id，换图刷新即读，无需同步）
assets/               派生物（build_web.js 生成，勿手改）
tools/compose.js      ★ 引擎单一真源，页面与 CLI 共用
tools/build_web.js    重建 data-bundle + 同步 engine.js
tools/check_*.js      字段/引用/案例体检
tools/smoke*.js       引擎 + 界面冒烟
tools/gallery_sync.js 画廊清单同步 + 体检
```

## 维护

```bash
node tools/build_web.js    # 改完 data/*.json 必跑
node tools/check_fields.js && node tools/check_cases.js   # 体检
node tools/smoke.js && NODE_PATH=<jsdom> node tools/smoke-web.js   # 冒烟
```

## 已知边界

- 词条是视觉观察 + 通用摄影常识，案例未经模型逐条实测，按路线图推进回填；
- 平台尺寸规则以官方文档为准，改版需人工核对；中文长文案建议排版叠加，不让模型直出。
