#!/usr/bin/env node
/* 引擎冒烟（无 jsdom，Node 直跑 tools/compose.js）：装配顺序、冲突、算子、随机、盘点。 */
"use strict";
const ECOM = require("./compose.js");
const errors = [];
function assert(cond, msg) {
  if (cond) console.log("✓ " + msg);
  else { errors.push(msg); console.log("✗ " + msg); }
}

// 1. 装配顺序：spec 在最前，footer 在最后
const r1 = ECOM.compose({ specs: "SP-08", forms: "FO-01" });
assert(r1.prompt.indexOf("RGB 255 255 255") < r1.prompt.indexOf("pure seamless white"),
  "装配顺序：spec 词面排在 form 之前");
assert(/professional product photography$/.test(r1.prompt), "末尾固定追加硬约束");
assert(r1.zh.length === 2, "zh 配方摘要条数正确");

// 2. 单数键归一（案例配方键）
const r2 = ECOM.compose({ form: "FO-01", spec: "SP-08" });
assert(r2.prompt === r1.prompt, "单数/复数键归一后装配结果一致");

// 3. 冲突检测
assert(ECOM.conflicts({ specs: "SP-08", scenes: "SC-10" }).length === 1, "Amazon × 节日布景 触发冲突");
assert(ECOM.conflicts({ specs: "SP-08", people: "PP-04" }).length === 1, "Amazon × 全身模特 触发冲突");
assert(ECOM.conflicts({ specs: "SP-08" }).length === 0, "Amazon 单独不触发冲突");

// 4. 建议链
assert(ECOM.suggest("FO-01").indexOf("SH-01") !== -1, "FO-01 建议链含 SH-01");

// 5. 变形算子
const op1 = ECOM.applyOperator({ specs: "SP-08", scenes: "SC-01", layouts: "LO-09", people: "PP-01" }, "white-to-scene");
assert(op1.scenes === "SC-04" && op1.specs === "SP-01" && op1.layouts === "LO-05",
  "算子 white-to-scene：白底→场景（含 Amazon→淘宝降规）");
const op2 = ECOM.applyOperator({ goals: "GO-03", layouts: "LO-09" }, "to-urgency");
assert(op2.goals === "GO-08" && op2.layouts === "LO-08", "算子 to-urgency：目标/版式同步改");

// 6. 约束随机：锁定维度保持，且不撞冲突
const lock = { forms: "FO-01" };
const rnd = ECOM.random(lock);
assert(rnd.forms === "FO-01", "随机时锁定维度被保留");
assert(ECOM.conflicts(rnd).length === 0, "随机结果无冲突（重试规避生效）");

// 7. 盘点与缺口
const s = ECOM.stats();
assert(s.entries === 128 && s.combos > 1e10, "盘点：128 条目、组合空间千亿级（" + s.combos.toLocaleString() + "）");
assert(s.palettes === 12, "盘点：12 张风格配色卡");
const g = ECOM.gaps();
assert(typeof g.untestedCases === "number" && g.untestedCases === require("../data/cases.json").items.length, "缺口：全部案例未实测如实上报（数量动态）");
assert(Array.isArray(g.unusedByCaseOrTpl), "缺口：未被引用条目清单可查");

// 8. 商品信息：词段插在硬约束之前，缺项自动省略
const f1 = ECOM.composeFull({ forms: "FO-01", specs: "SP-01" }, { name: "noise-cancelling headphones", selling: "40h battery" });
assert(f1.prompt.indexOf("featured product: noise-cancelling headphones") < f1.prompt.indexOf("professional product photography"),
  "composeFull：商品词段排在硬约束之前");
assert(f1.prompt.indexOf("target audience") === -1, "composeFull：未填的 audience 不出现");
assert(ECOM.composeFull({ forms: "FO-01" }, {}).prompt === ECOM.compose({ forms: "FO-01" }).prompt,
  "composeFull：无商品信息时与普通装配一致");
assert(/reference image/.test(ECOM.PROTECT_EN), "商品保护规则含「以参考图为准」");

// 9. 视觉强调强度：高给质感锤、低收完成词；1.0 时词面不动
const stHi = ECOM.compose({ forms: "FO-01", specs: "SP-01" }, { strength: 1.5 });
const stLo = ECOM.compose({ forms: "FO-01", specs: "SP-01" }, { strength: 0.6 });
const stMd = ECOM.compose({ forms: "FO-01", specs: "SP-01" }, { strength: 1 });
assert(stHi.prompt.includes("magazine-grade commercial finish"), "强度 1.5：追加质感锤词段");
assert(!stLo.prompt.includes("magazine-grade"), "强度 0.6：不加质感锤词段");
assert(stMd.prompt === ECOM.compose({ forms: "FO-01", specs: "SP-01" }).prompt, "强度 1.0：词面与默认一致");

// 10. 分享码 ECX1.：编解码闭环 + 坏码拦截
const code = ECOM.encodeShare({ sel: { forms: "FO-01", specs: "SP-08" }, freeText: "薄雾", strength: 1.3, product: { name: "serum" } });
assert(code.indexOf("ECX1.") === 0, "分享码带 ECX1. 前缀");
const back = ECOM.decodeShare(code);
assert(back.sel.specs === "SP-08" && back.freeText === "薄雾" && back.strength === 1.3 && back.product.name === "serum",
  "分享码：sel/原话/强度/商品信息全量还原");
try { ECOM.decodeShare("ECX1.%%%"); throw new Error("应当拦截"); } catch (e) {
  assert(e.message !== "应当拦截", "分享码：坏码被拦截并给出原因");
}

// 11. 出图参数与变更清单
assert(/2000x2000/.test(ECOM.renderParams({ specs: "SP-08" })), "出图参数：Amazon 给 2000x2000 纯白建议");
assert(/1024x1024/.test(ECOM.renderParams({ specs: "SP-01" })), "出图参数：淘宝主图给 1024 建议");
const cl = ECOM.changesList({ forms: "FO-01", specs: "SP-01", goals: "GO-03" }, { strength: 1, freeText: "" });
assert(cl.rows.length === 3 && cl.rows[0].id === "SP-01", "变更清单：按装配顺序逐条列出决策");

// 9. 商品信息母版：8 节结构、缺位显示占位
const mt = ECOM.masterTemplate({ forms: "FO-01", specs: "SP-08", categories: "CT-01" }, { name: " Vitamin C serum " });
assert(mt.length === 8, "母版 8 节");
assert(mt[1].lines[0].indexOf("Vitamin C serum") !== -1, "母版商品名称入位（trim 后）");
assert(mt[0].lines[0].indexOf("Amazon") !== -1 && mt[0].lines[0].indexOf("白底电商主图") !== -1, "母版任务定义带平台与图型");
assert(mt.some(sec => sec.lines.some(l => l.indexOf("【") !== -1)), "母版缺位显示【填写】占位");

// 10. 批量出图：五计划 + 用户覆盖 + 冲突随行
const bp = ECOM.batchPlans({ specs: "SP-08", categories: "CT-01" });
assert(bp.length === 5, "批量 5 个图型");
assert(bp.every(p => p.sel.specs === "SP-08"), "批量：用户平台覆盖全部计划");
assert(bp[3].sel.decors === "DC-08" && bp[3].warnings.length > 0, "批量：促销海报 × Amazon 纯白触发冲突警告");
const bp2 = ECOM.batchPlans({});
assert(bp2[0].sel.specs === "SP-01" && bp2[2].sel.specs === "SP-07", "批量：默认规格按图型各就各位");

// 11. 风格配色
const pl = ECOM.paletteOf("ST-01");
assert(pl && pl.swatches.length === 5 && /^#[0-9A-Fa-f]{6}$/.test(pl.swatches[0].hex), "paletteOf(ST-01) 返回合法色卡");
assert(ECOM.paletteOf("ST-99") === null, "paletteOf 对不存在的风格返回 null");

if (errors.length) {
  console.log("\n引擎冒烟失败：" + errors.length + " 项");
  process.exit(1);
}
console.log("\n✓ 引擎冒烟全部通过");
