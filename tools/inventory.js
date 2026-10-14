#!/usr/bin/env node
/* 盘点 + 覆盖缺口：规模数字现算，不写死。
 * 呼应定位约定：首页与 README 显示实体数与缺口，不给过期数字。 */
"use strict";
const ECOM = require("./compose.js");

const s = ECOM.stats();
console.log("== 规模 ==");
ECOM.DIM_KEYS.forEach(d => {
  console.log(("  " + d).padEnd(15) + String(s.per[d].n).padStart(4) + "  " + s.per[d].zh);
});
console.log(("  合计条目").padEnd(15) + String(s.entries).padStart(4));
console.log(("  理论组合").padEnd(15) + s.combos.toLocaleString());
console.log("  案例 " + s.cases + " · 模板 " + s.templates + " · 冲突规则 " + s.conflicts + " · 配色卡 " + s.palettes);

const g = ECOM.gaps();
console.log("\n== 覆盖缺口 ==");
if (!g.unusedByCaseOrTpl.length) {
  console.log("✓ 所有条目都被案例或模板引用");
} else {
  g.unusedByCaseOrTpl.forEach(x => {
    console.log("· " + x.zh + "（" + x.dim + "）未被引用 " + x.unused.length + " 条：" + x.unused.join(", "));
  });
}
console.log("· 案例实测进度：" + g.testedCases + "/" + (g.testedCases + g.untestedCases) +
  " 已实测（" + g.untestedCases + " 个案例尚未回填）");
