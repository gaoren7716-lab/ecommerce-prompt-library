#!/usr/bin/env node
/* CLI 查配方：node tools/show_prompt.js FO-01 GO-03 CT-01 PP-01 SH-01 SC-01 MT-01 ST-01 LT-01 LO-09 SP-08
 * 也支持：--case CS-01 / --template TP-01 / --random [--lock forms=FO-01] / --operator <opId>
 *        --batch [--spec SP-08 --category CT-01]（批量五图型）
 *        --product "name=...,selling=...,audience=..."（商品信息随行） */
"use strict";
const ECOM = require("./compose.js");

const args = process.argv.slice(2);
const ids = args.filter(a => /^[A-Z]{2}-\d{2}$/.test(a));

function readProduct() {
  const pi = args.indexOf("--product");
  if (pi === -1 || !args[pi + 1]) return null;
  const p = {};
  args[pi + 1].split(",").forEach(kv => {
    const i = kv.indexOf("=");
    if (i > 0) p[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
  });
  return p;
}
function readSel(flag) {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : null;
}

if (args.includes("--case")) {
  const cs = ECOM.data.cases.items.find(c => c.id === args[args.indexOf("--case") + 1]);
  if (!cs) { console.error("案例不存在"); process.exit(1); }
  const r = ECOM.compose(cs.recipe);
  console.log("== " + cs.id + " " + cs.zh + " ==");
  console.log("验证点：" + cs.validates + "　tested=" + cs.tested);
  console.log(r.prompt);
  r.warnings.forEach(w => console.log("⚠ [" + w.verdict + "] " + w.a + " × " + w.b + " —— " + w.why));
} else if (args.includes("--template")) {
  const tp = ECOM.data.templates.items.find(t => t.id === args[args.indexOf("--template") + 1]);
  if (!tp) { console.error("模板不存在"); process.exit(1); }
  const r = ECOM.compose(tp.fills);
  console.log("== " + tp.id + " " + tp.zh + " ==");
  console.log("说明：" + tp.desc);
  console.log("槽位：" + (tp.slots || []).map(s => "【" + s + "】").join(" "));
  console.log("保护：" + tp.protect);
  console.log("检查：" + (tp.checklist || []).join(" · "));
  console.log(r.prompt);
} else if (args.includes("--random")) {
  const lock = {};
  const li = args.indexOf("--lock");
  if (li !== -1 && args[li + 1]) {
    args[li + 1].split(",").forEach(kv => {
      const p = kv.split("=");
      if (p.length === 2) lock[p[0]] = p[1];
    });
  }
  const sel = ECOM.random(lock);
  const r = ECOM.compose(sel);
  console.log("== 随机配方" + (Object.keys(lock).length ? "（含锁定）" : "") + " ==");
  console.log(r.zh.map(z => "· " + z).join("\n"));
  console.log(r.prompt);
} else if (args.includes("--batch")) {
  const user = {};
  const sp = readSel("--spec"), ct = readSel("--category"), st = readSel("--style"), mt = readSel("--material");
  if (sp) user.specs = sp;
  if (ct) user.categories = ct;
  if (st) user.styles = st;
  if (mt) user.materials = mt;
  const prod = readProduct();
  console.log("== 批量五图型 ==");
  ECOM.batchPlans(user).forEach(p => {
    const r = ECOM.composeFull(p.sel, prod);
    console.log("\n-- " + p.zh + "（" + p.sel.forms + " · " + p.sel.specs + "）");
    console.log(r.prompt);
    p.warnings.forEach(w => console.log("⚠ [" + w.verdict + "] " + w.a + " × " + w.b + " —— " + w.why));
  });
  if (prod) console.log("\n[商品保护规则]\n" + ECOM.PROTECT_EN);
  console.log("\n[负面词]\n" + ECOM.NEGATIVE);
} else if (args.includes("--operator")) {
  const opId = args[args.indexOf("--operator") + 1];
  const sel = {};
  ids.forEach(id => { sel[ECOM.dimOf(id)] = id; });
  const next = ECOM.applyOperator(sel, opId);
  if (!next) { console.error("算子不存在，可用：" + Object.keys(ECOM.OPERATORS).join(", ")); process.exit(1); }
  const r = ECOM.compose(next);
  console.log("== 变形：" + (ECOM.OPERATORS[opId] || {}).zh + " ==");
  console.log(r.zh.map(z => "· " + z).join("\n"));
  console.log(r.prompt);
} else if (ids.length) {
  const sel = {};
  ids.forEach(id => { sel[ECOM.dimOf(id)] = id; });
  const r = ECOM.compose(sel);
  console.log("== 配方（" + r.zh.length + "/12 维） ==");
  console.log(r.zh.map(z => "· " + z).join("\n"));
  console.log("\n" + r.prompt);
  r.warnings.forEach(w => console.log("⚠ [" + w.verdict + "] " + w.a + " × " + w.b + " —— " + w.why));
} else {
  console.log("用法：node tools/show_prompt.js <id...> | --case CS-01 | --template TP-01 | --random [--lock forms=FO-01] | --operator <opId> | --batch");
  console.log("批量：node tools/show_prompt.js --batch --spec SP-08 --category CT-01 [--product \"name=...,selling=...,audience=...\"]");
  console.log("算子：" + Object.keys(ECOM.OPERATORS).map(k => k + "（" + ECOM.OPERATORS[k].zh + "）").join("，"));
}
