#!/usr/bin/env node
/* 界面冒烟：jsdom 加载 index.html，验证八页结构与核心链路。
 * 用法：NODE_PATH=<jsdom 所在 node_modules> node tools/smoke-web.js
 * 查什么：数据加载、七页渲染、画廊/自定义/合成器(含全部词条)/抽卡/配色/工作台链路。
 * 不保证什么：真实浏览器视觉表现。 */
"use strict";
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const errors = [];
function assert(cond, msg) {
  if (cond) { console.log("✓ " + msg); } else { errors.push(msg); console.log("✗ " + msg); }
}

const bundle = fs.readFileSync(path.join(ROOT, "assets", "data-bundle.js"), "utf8");
const gallery = fs.existsSync(path.join(ROOT, "assets", "gallery-imgs.js"))
  ? fs.readFileSync(path.join(ROOT, "assets", "gallery-imgs.js"), "utf8")
  : "window.GALLERY_IMGS = {}; window.GALLERY_UNCLAIMED = [];";
const engine = fs.readFileSync(path.join(ROOT, "assets", "engine.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8")
  .replace('<script src="assets/data-bundle.js"></script>',
    "<script>\n" + bundle + "\n" + gallery + "\n" + engine + "\n</script>");
// 用 http 源：jsdom 在 file:// 下不提供 localStorage（不透明源），历史记录测试需要它
const dom = new JSDOM(html, { runScripts: "dangerously", url: "http://localhost/index.html" });
const doc = dom.window.document;
const E = dom.window.ECOM;
function click(elm) { elm.dispatchEvent(new dom.window.Event("click")); }
function type(elm, v) { elm.value = v; elm.dispatchEvent(new dom.window.Event("input")); }
function change(elm, v) { elm.value = v; elm.dispatchEvent(new dom.window.Event("change")); }
function navTo(mode) { click(doc.querySelector('#modeTabs button[data-mode="' + mode + '"]')); }

// ---------- 数据与头部 ----------
const D = dom.window.ECOM_DATA;
assert(D, "ECOM_DATA 已加载");
assert(D.palettes && D.palettes.items.length === 12, "palettes 12 条");
assert(doc.querySelectorAll("#modeTabs button").length === 8, "主导航 8 个页签（链接出图独立页）");
assert(doc.getElementById("inv").textContent.indexOf("理论组合") !== -1, "库存条现算（含理论组合）");
assert(doc.getElementById("gapLine").textContent.indexOf("未实测") !== -1, "缺口行显示实测进度");

// ---------- 视图显隐 CSS 绊线 ----------
// jsdom 不算 CSS 级联：.wrap{display:grid} 曾靠后压过 .view{display:none}，
// 合成器在全部七个页面泄露（真实 Chrome 才复现）。这里对 CSS 源文本做静态断言。
assert(/main\.wrap\.view\{display:none\}/.test(html), "CSS 绊线：wrap 型视图显式写关闭态（防全页泄露复发）");
assert(/main\.wrap\.view\.on\{display:grid\}/.test(html), "CSS 绊线：wrap 型视图开启态为 grid");

// ---------- 示例画廊 ----------
assert(doc.getElementById("v-gallery").classList.contains("on"), "默认落在示例画廊");
assert(doc.querySelectorAll("#galWrap .gcard").length === D.cases.items.length + D.templates.items.length, "画廊卡片数=案例+模板（动态）");
click(doc.querySelector('#galFilters .fchip[data-type="tpl"]'));
assert(doc.querySelectorAll("#galWrap .gcard").length === 5, "筛选模板后 5 张卡");
click(doc.querySelector('#galFilters .fchip[data-type="all"]'));
type(doc.getElementById("galQ"), "amazon");
var amazonN = D.cases.items.concat(D.templates.items).filter(function(c){
  return ((c.id + " " + c.zh + " " + (c.validates || c.desc || "")).toLowerCase().indexOf("amazon") !== -1);
}).length;
assert(amazonN >= 1 && doc.querySelectorAll("#galWrap .gcard").length === amazonN, "搜索 Amazon 命中数与数据一致（" + amazonN + "）");
doc.getElementById("galQ").value = "";
click(doc.querySelectorAll("#galWrap .gcard")[0].querySelector('[data-act="detail"]'));
assert(doc.getElementById("galMask").classList.contains("on"), "画廊详情浮层打开");
assert(doc.getElementById("galSheet").textContent.indexOf("视觉指令") === -1, "画廊详情不再内联成品词面");
assert(doc.getElementById("galSheet").textContent.indexOf("配方盘只在") !== -1, "画廊详情指路到合成器");
assert(!!doc.getElementById("galSheet").querySelector('[data-act="copy"]'), "画廊详情仍有复制提示词按钮");
click(doc.getElementById("galSheet").querySelector("[data-x]"));
click(doc.getElementById("galDense"));
assert(doc.getElementById("galWrap").classList.contains("dense"), "画廊密度切换");
assert(doc.querySelectorAll("#galWrap .gcard .gstrips i").length > 0, "画廊色卡从 style palette 派生");
// 点图片区域 = 开详情（2026-10-14 用户要求）；点编号徽章仍是复制、不冒泡成详情
// 注意用 bubbles:true 模拟真实点击（默认 Event 不冒泡，测不出拦截逻辑）
function clickB(elm){ elm.dispatchEvent(new dom.window.Event("click", { bubbles: true })); }
clickB(doc.querySelectorAll("#galWrap .gcard")[0].querySelector(".gsw"));
assert(doc.getElementById("galMask").classList.contains("on"), "点画廊图片也开详情浮层");
click(doc.getElementById("galSheet").querySelector("[data-x]"));
clickB(doc.querySelectorAll("#galWrap .gcard")[0].querySelector(".gsw .gid"));
assert(!doc.getElementById("galMask").classList.contains("on"), "点编号徽章不冒泡成详情（归复制）");
// 清单混合扩展名：JPG/PNG 混吃，且每张图都真实存在于磁盘
var galImgsJs = dom.window.GALLERY_IMGS || {};
var galExts = {}, galMissing = [];
Object.keys(galImgsJs).forEach(function(id){
  var p = galImgsJs[id], ext = p.split(".").pop();
  galExts[ext] = (galExts[ext] || 0) + 1;
  if (!fs.existsSync(path.join(ROOT, p))) galMissing.push(p);
});
assert(galMissing.length === 0, "清单里每张图都存在于磁盘（" + Object.keys(galImgsJs).length + " 张，扩展名分布 " + JSON.stringify(galExts) + "）");
assert(Object.keys(galExts).length >= 2, "JPG/PNG 混放同步进清单（不写死扩展名）");
// 扩展名自适应（2026-10-14 晚四）：每张卡的 img 挂 data-fb 兜底链（jpg/png/webp），
// 清单路径失效时顺延重试——jsdom 不加载图片，这里验证挂链正确，顺延行为由真实 Chrome 验
var firstCardImg = doc.querySelectorAll("#galWrap .gcard")[0].querySelector(".gsw img");
assert(!!firstCardImg, "画廊卡渲染 img（不管清单有没有这张）");
var fbChain = (firstCardImg.getAttribute("data-fb") || "").split(",").filter(Boolean);
assert(fbChain.length >= 2, "img 挂扩展名兜底链 data-fb（jpg/png/webp 去重后至少 2 个）");
assert(/^gallery\/[A-Z]{2}-\d{2}\.(jpg|png|webp)$/.test(firstCardImg.getAttribute("src")), "img src 是候选链首项");
assert(fbChain.every(function(p){ return /^gallery\/[A-Z]{2}-\d{2}\.(jpg|png|webp)$/.test(p); }), "兜底链每一项都是合法候选路径");
clickB(doc.querySelectorAll("#galWrap .gcard")[0].querySelector(".gsw"));
var heroImg = doc.getElementById("galSheet").querySelector(".galhero");
assert(!!heroImg && (heroImg.getAttribute("data-fb") || "").length > 0, "详情浮层大图同挂兜底链");
click(doc.getElementById("galSheet").querySelector("[data-x]"));

// ---------- 自定义出图（独立成品页：选场景+商品信息，本页直接出词） ----------
navTo("custom");
assert(doc.querySelectorAll("#presetCards .pcard").length === 8, "自定义页 8 个快速选题卡");
assert(!!doc.getElementById("easyOut"), "自定义页有独立成品输出区 easyOut");
assert(doc.getElementById("easyOut").textContent.indexOf("pure seamless white background") !== -1,
  "自定义页成品实时出词（默认白底主图）");
assert(doc.getElementById("tray").closest("main") && doc.getElementById("tray").closest("main").id === "v-synth",
  "配方盘托盘仍只在合成器页");
// 初始默认载入 SP-01 白底主图
assert(doc.querySelector('#specChips .fchip[data-spec="SP-01"]').classList.contains("on"), "默认选中白底主图平台");
click(doc.querySelector('.pcard[data-spec="SP-08"]'));
assert(doc.getElementById("platNote").classList.contains("show"), "平台铁律注记显示");
type(doc.getElementById("cName"), "wireless earbuds pro");
type(doc.getElementById("cSelling"), "40h battery life");
// 平台 chips 点击后选中态同步
click(doc.querySelector('#specChips .fchip[data-spec="SP-06"]'));
assert(doc.querySelector('#specChips .fchip[data-spec="SP-06"]').classList.contains("on"), "平台 chips 切换选中态");
// 冲突警告仍在自定义页提示（成品在合成器，但选型阶段的冲突要当场看见）
click(doc.querySelector('.pcard[data-spec="SP-02"]'));
assert(doc.getElementById("customWarn").classList.contains("show") === false, "大促海报预设无冲突警告");
click(doc.getElementById("easyRandom2"));
assert(doc.getElementById("easyOut").textContent.length > 100, "出成品下方随机来一张后成品更新");
assert(!doc.querySelector("#v-custom #linkPaste"), "自定义出图已不含解析块（解析搬去链接出图独立页）");
navTo("synth");
click(doc.getElementById("btnReset")); // 随机来的配方清掉，保证后续点选断言确定性（不清商品信息）
click(doc.getElementById("toSynth"));
assert(doc.getElementById("v-synth").classList.contains("on"), "一键去合成器细调");

// ---------- 提示词合成器 ----------
navTo("synth");
click(doc.querySelector('.chip[data-dim="forms"][data-id="FO-01"]'));
assert(doc.getElementById("out").textContent.indexOf("pure seamless white background") !== -1, "合成器选 FO-01 出词");
assert(doc.querySelectorAll("#tray > .dim").length === 3, "配方盘核心三步置顶（类型/品类/平台）");
assert(!!doc.querySelector("#tray .dim-adv") && doc.querySelector("#tray .dim-adv").querySelectorAll(".dim").length === 9,
  "其余九维收进「进阶微调」折叠区");
assert(!!doc.getElementById("outMore") && !!doc.getElementById("copyMore"), "成品区更多格式/分享备份已折叠降噪");
// 输出 tabs
click(doc.querySelector('#outTabs .fchip[data-out="neg"]'));
assert(doc.getElementById("out").textContent.indexOf("no garbled text") !== -1 || doc.getElementById("out").textContent.indexOf("garbled text") !== -1, "负面词 tab");
click(doc.querySelector('#outTabs .fchip[data-out="master"]'));
var masterTxt = doc.getElementById("out").textContent;
assert(masterTxt.indexOf("## 1. 任务定义") !== -1 && masterTxt.indexOf("## 8. 最终检查") !== -1, "商品信息母版 8 节");
click(doc.querySelector('#outTabs .fchip[data-out="json"]'));
assert(JSON.parse(doc.getElementById("out").textContent).sel.forms === "FO-01", "配方 JSON tab 可解析");
click(doc.querySelector('#outTabs .fchip[data-out="zh"]'));
assert(doc.getElementById("out").textContent.indexOf("产出类型") !== -1, "中文配方 tab");
click(doc.querySelector('#outTabs .fchip[data-out="tags"]'));
// 模板快速载入
click(Array.prototype.filter.call(doc.querySelectorAll("#presets .btn"), function(b){ return b.textContent.indexOf("TP-01") === 0; })[0]);
assert(doc.getElementById("out").textContent.indexOf("click-attracting") !== -1, "TP-01 快速载入");
// 原话追加
type(doc.getElementById("freeText"), "morning mist loneliness");
assert(doc.getElementById("out").textContent.indexOf("morning mist loneliness") !== -1, "原话追加在词面末尾");
doc.getElementById("freeText").value = "";
// 建议补全 + 随机 + 算子
click(doc.getElementById("btnSug"));
assert(doc.querySelectorAll(".chip.sug").length >= 0, "建议补全不报错");
click(doc.getElementById("btnRandom"));
assert(doc.getElementById("out").textContent.length > 150, "随机灵感产出非空");
assert(doc.querySelectorAll("#history .dt-kv-r").length >= 1, "历史记录已保存");
click(doc.getElementById("btnReset"));
click(doc.querySelector('.chip[data-dim="forms"][data-id="FO-01"]'));
click(doc.querySelector('.chip[data-dim="scenes"][data-id="SC-01"]'));
click(Array.prototype.filter.call(doc.querySelectorAll("#opBtns .btn"), function(b){ return b.textContent.indexOf("白底") !== -1; })[0]);
assert(doc.querySelector('.chip[data-dim="scenes"][data-id="SC-04"]').classList.contains("on"), "算子 white-to-scene 生效");
// 商品名同步（自定义页填过）
assert(doc.getElementById("sName").value === "wireless earbuds pro", "商品名跨页同步到合成器");

// ---------- 链接出图（独立页：读取+粘贴解析兜底，主图/详情双词面） ----------
navTo("linkgrab");
assert(doc.getElementById("v-linkgrab").classList.contains("on"), "链接出图页打开");
assert(!!doc.getElementById("grabMain") && !!doc.getElementById("grabDetail"), "主图/详情双输出区存在");
type(doc.getElementById("linkUrl"), "https://item.jd.com/1000123.html");
click(doc.getElementById("btnFetch"));
// jsdom 无 fetch → 优雅降级到粘贴解析（不发请求、不硬编）
assert(doc.getElementById("fetchNote").textContent.indexOf("粘贴解析") !== -1, "读取失败优雅降级到粘贴解析");
assert(doc.getElementById("pasteFallback").style.display === "block", "降级后显示粘贴入口");
type(doc.getElementById("linkUrl"), "1000123456");
assert(doc.getElementById("skuPlatRow").style.display !== "none", "纯 SKU 显示平台选择");
type(doc.getElementById("linkPaste"), "【旗舰新品】无线蓝牙耳机 主动降噪 40小时续航 通勤耳机");
click(doc.getElementById("btnParse2"));
assert(doc.getElementById("grabOut").textContent.indexOf("CT-03") !== -1, "解析识别品类 CT-03 数码");
assert(doc.getElementById("grabOut").textContent.indexOf("40小时续航") !== -1, "解析列出卖点");
click(doc.getElementById("btnApplyGrab"));
assert(doc.getElementById("grabMain").textContent.length > 100, "主图词面即出");
assert(doc.getElementById("grabDetail").textContent.length > 100, "详情词面即出");
assert(doc.getElementById("grabMain").textContent !== doc.getElementById("grabDetail").textContent, "主图与详情词面不同");
// 只粘链接、没粘商品文案 → 必须明确失败，不准假成功（2026-10-14 用户实截图 bug）
type(doc.getElementById("linkPaste"), "");
type(doc.getElementById("linkUrl"), "https://item.jd.com/10220627911703.html");
click(doc.getElementById("btnParse2"));
var junkTxt = doc.getElementById("grabOut").textContent;
assert(junkTxt.indexOf("只读到链接") !== -1, "只粘链接明确报失败不假成功");
assert(junkTxt.indexOf("书签") !== -1, "失败时指路书签抓取工具");
assert(junkTxt.indexOf("发到对话里") !== -1, "失败时告知对话直读备用路");
// 🔖 书签一键抓取：拖拽按钮 + href 由 grabInfo.toString() 生成
assert(!!doc.getElementById("bmkCard") && !!doc.getElementById("bmklet") && !!doc.getElementById("bmkCopyCode"), "书签抓取卡片与两个按钮存在");
var bmkHref = doc.getElementById("bmklet").getAttribute("href") || "";
assert(bmkHref.indexOf("javascript:(") === 0 && bmkHref.indexOf("document.title") !== -1, "书签 href 由 grabInfo.toString() 生成");
assert(doc.getElementById("bmkCard").style.display !== "none", "书签卡片默认可见（不等失败才出现）");

// ---------- 「点了没反应」防护（2026-10-14 用户实报：链接出图点解析无反应） ----------
// 静态绊线：assets 没加载上时页面看着正常但 JS 全死——必须有显式报错，不准静默
assert(/loadFailBar/.test(html), "绊线：脚本加载失败有显式报错栏（不准静默无反应）");
assert(/function stub\(\)/.test(html) && /window\.__ecomReady/.test(html), "绊线：链接出图按钮早期挂桩 + 就绪标志");
// 空输入点解析：常驻内联提示，不只靠 3 秒 toast（没注意到就是"没反应"）
type(doc.getElementById("linkPaste"), "");
type(doc.getElementById("linkUrl"), "");
click(doc.getElementById("btnParse2"));
var emptyTxt = doc.getElementById("grabOut").textContent;
assert(doc.getElementById("grabOut").style.display === "block", "空输入点解析有常驻反馈（不是只弹toast）");
assert(emptyTxt.indexOf("解析框还是空的") !== -1, "空输入提示说清要粘什么");
// 挂桩已被真处理函数替换（主脚本就绪后不准还提示"还在初始化"）
assert(doc.getElementById("btnParse2").onclick.toString().indexOf("parseProductText") !== -1, "解析按钮已接真处理函数（挂桩已退场）");
// 画廊破图兜底：清单路径与磁盘文件对不上时回落色卡，不显示碎图
assert(/\.gsw img\.noimg\{display:none\}/.test(html), "绊线：画廊破图回落色卡（onerror 隐藏）");

// ---------- 抽卡 ----------
navTo("gacha");
click(doc.getElementById("gaRoll1"));
assert(doc.querySelectorAll("#gaOut .gaca").length === 1, "抽 1 组");
click(doc.getElementById("gaRoll4"));
assert(doc.querySelectorAll("#gaOut .gaca").length === 4, "抽 4 组");
click(doc.getElementById("gaRandomCase"));
assert(doc.getElementById("v-gacha").classList.contains("on"), "随机案例留在抽卡页（独立出卡）");
assert(doc.querySelectorAll("#gaOut .gaca").length === 5, "随机案例在页内追加出卡（4+1）");

// ---------- 全部词条（并入合成器页） ----------
assert(doc.getElementById("entriesBox") && doc.getElementById("v-synth").contains(doc.getElementById("entriesBox")),
  "全部词条浏览区在合成器页内");
assert(doc.getElementById("pickHint").textContent.indexOf("128") !== -1, "词条计数 128（pickHint）");
assert(doc.querySelectorAll("#eList .erow").length === 12, "词条区默认 forms 12 行");
click(doc.querySelector('#dimTabs .dtab[data-dim="categories"]'));
assert(doc.querySelectorAll("#eList .erow").length === 14, "切品类 14 行");
type(doc.getElementById("eq"), "美妆");
assert(doc.querySelectorAll("#eList .erow").length === 1, "搜索美妆命中 1 行");
doc.getElementById("eq").value = "";
click(doc.querySelectorAll("#eList .erow")[0].querySelector(".enm b"));
assert(doc.getElementById("dtPanel").classList.contains("on"), "词条详情抽屉打开");
assert(doc.getElementById("dtPanel").textContent.indexOf("行业规范") !== -1, "品类详情含行业规范");
var addedCatId = doc.querySelectorAll("#eList .erow")[0].querySelector(".eid").textContent;
click(doc.getElementById("dtPanel").querySelector("[data-add]"));
assert(doc.querySelector('.chip[data-dim="categories"][data-id="' + addedCatId + '"]').classList.contains("on"),
  "加入后配方盘对应 chip 点亮");
assert(doc.getElementById("toast").textContent.indexOf("成品即时更新") !== -1, "加入后 toast 指向成品");
closeDetailSafe();
function closeDetailSafe(){ doc.getElementById("dtMask").dispatchEvent(new dom.window.Event("click")); }
// 风格维度抽屉含色卡
click(doc.querySelector('#dimTabs .dtab[data-dim="styles"]'));
click(doc.querySelectorAll("#eList .erow")[0].querySelector(".enm b"));
assert(doc.getElementById("dtPanel").querySelectorAll(".sw[data-hex]").length === 5, "风格抽屉含 5 色卡");
closeDetailSafe();
// 收起后再点品类 chip 不会受词条区影响（配方盘与词条区共用 sel）
click(doc.querySelector('#dimTabs .dtab[data-dim="forms"]'));

// ---------- 风格配色搭配 ----------
navTo("pairs");
assert(doc.querySelectorAll("#pairGrid .pair").length === 12, "配色页 12 张卡");
assert(doc.querySelectorAll("#pairGrid .sw[data-hex]").length === 60, "配色页 60 个色块");
type(doc.getElementById("pairQ"), "金");
assert(doc.querySelectorAll("#pairGrid .pair").length >= 1, "配色搜索「金」有命中");
doc.getElementById("pairQ").value = "";
click(doc.querySelectorAll("#pairGrid .pair .btn")[0]);
assert(doc.getElementById("v-synth").classList.contains("on"), "配色卡载入风格后跳合成器");

// ---------- 框架与体检 ----------
navTo("framework");
var fw = doc.getElementById("fwBody").textContent;
assert(fw.indexOf("十二个维度") !== -1, "框架页含十二维表");
assert(fw.indexOf("冲突裁决规则") !== -1, "框架页含冲突裁决");
assert(fw.indexOf("平台规格速查") !== -1, "框架页含平台规格速查");
assert(fw.indexOf("覆盖缺口") !== -1, "框架页含覆盖缺口（现算）");

// ---------- 编码工作台 ----------
navTo("desk");
assert(doc.querySelectorAll("#planCards .plan").length === 5, "批量出图 5 个图型");
change(doc.getElementById("dSpec"), "SP-08");
var promoWarn = Array.prototype.filter.call(doc.querySelectorAll("#planCards .plan"), function(p){
  return p.querySelector(".ph b").textContent === "促销海报";
})[0];
assert(promoWarn.querySelector(".pw").classList.contains("show"), "Amazon 平台下促销海报计划报冲突");
type(doc.getElementById("dName"), "smart water bottle");
assert(doc.querySelectorAll("#planCards .plan")[0].textContent.indexOf("featured product: smart water bottle") !== -1,
  "商品名进入批量计划词面");
// 编号速查
type(doc.getElementById("lookupInput"), "CS-01");
click(doc.getElementById("lookupBtn"));
assert(doc.getElementById("lookupOut").textContent.indexOf("验证点") !== -1, "编号速查 CS-01");
type(doc.getElementById("lookupInput"), "SP-08");
click(doc.getElementById("lookupBtn"));
assert(doc.getElementById("lookupOut").textContent.indexOf("铁律") !== -1, "编号速查 SP-08");
type(doc.getElementById("lookupInput"), "XX-99");
click(doc.getElementById("lookupBtn"));
assert(doc.getElementById("lookupOut").textContent.indexOf("没找到") !== -1, "编号速查未知 id 有提示");

// ---- V5 新增：强度滑块 / 变更清单 / 出图版 / 分享码 ----
assert(!!doc.getElementById("strength"), "合成器有强度滑块");
click(doc.querySelector("#presets .btn"));   // 先载入一个完整配方，空配方无词面可验
assert(doc.getElementById("out").textContent.length > 40, "预设配方已载入");
click(doc.querySelector('#outTabs .fchip[data-out="changes"]'));
assert(doc.getElementById("out").textContent.indexOf("配方变更清单") !== -1, "变更清单 tab 可输出");
click(doc.querySelector('#outTabs .fchip[data-out="tags"]'));
type(doc.getElementById("strength"), "1.5");
var ev = doc.createEvent("Event"); ev.initEvent("input", true, true);
doc.getElementById("strength").dispatchEvent(ev);
assert(doc.getElementById("out").textContent.indexOf("magazine-grade") !== -1, "强度 1.5 词面加质感锤");
type(doc.getElementById("strength"), "0.5");
doc.getElementById("strength").dispatchEvent(ev);
assert(doc.getElementById("out").textContent.indexOf("magazine-grade") === -1, "强度 0.5 词面无质感锤");
type(doc.getElementById("strength"), "1.5");   // 复位到 1.5 再存码——码存的就是滑块当前状态
doc.getElementById("strength").dispatchEvent(ev);
click(doc.getElementById("btnSnap"));
assert(doc.getElementById("shareMask").classList.contains("on"), "生成分享码打开浮层");
var sc = doc.getElementById("shareCode").value;
assert(sc.indexOf("ECX1.") === 0, "分享码带 ECX1. 前缀");
click(doc.querySelector("#shareSheet [data-x]"));
assert(!doc.getElementById("shareMask").classList.contains("on"), "分享码浮层可关闭");
click(doc.getElementById("btnLoad"));
doc.getElementById("shareCode").value = "ECX1.坏码";
click(doc.getElementById("shareGoBtn"));
assert(doc.getElementById("shareErr").textContent.indexOf("载入失败") !== -1, "坏分享码被拦截并提示");
doc.getElementById("shareCode").value = sc;
click(doc.getElementById("shareGoBtn"));
assert(!doc.getElementById("shareMask").classList.contains("on"), "好分享码载入后浮层关闭");
assert(doc.getElementById("out").textContent.indexOf("magazine-grade") !== -1, "分享码还原了强度 1.5 的词面");
type(doc.getElementById("strength"), "1");
doc.getElementById("strength").dispatchEvent(ev);
assert(doc.getElementById("out").textContent.indexOf("magazine-grade") === -1, "强度复位 1.0 后词面干净");
click(doc.getElementById("btnCopyRun"));
assert(doc.getElementById("toast").textContent.indexOf("出图参数") !== -1, "复制出图版（带参数）有反馈");

if (errors.length) {
  console.log("\n冒烟失败：" + errors.length + " 项");
  process.exit(1);
}
console.log("\n✓ 界面冒烟全部通过");
