#!/usr/bin/env node
/* 体检：验证案例引用完整性 + 维度覆盖矩阵 + 冲突规则/建议链的 id 有效性。
 * 查什么：id 是否都能解析、prompt 是否混入中文、维度是否被案例覆盖。
 * 不保证什么：提示词出图效果（那是模型实测的事，见 FRAMEWORK.md 边界）。 */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DIMS = ["forms", "goals", "categories", "shots", "people", "scenes", "materials", "styles", "lights", "layouts", "specs", "decors"];
const errors = [];
const warns = [];

function load(name) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "data", name + ".json"), "utf8"));
}

function main() {
  const data = {};
  for (const d of DIMS.concat(["cases", "conflicts", "templates"])) data[d] = load(d);

  // 索引：dim -> id -> item；顺便查重复 id / prompt 中文混入
  const index = {};
  const seenIds = {};
  for (const d of DIMS) {
    index[d] = {};
    for (const it of data[d].items) {
      if (seenIds[it.id]) errors.push("id 重复：" + it.id + "（" + seenIds[it.id] + " 与 " + d + "）");
      seenIds[it.id] = d;
      if (!it.prompt || !it.prompt.trim()) errors.push(it.id + " prompt 为空");
      else if (/[\u4e00-\u9fff]/.test(it.prompt)) errors.push(it.id + " prompt 混入中文（prompt 必须是英文视觉指令）");
      index[d][it.id] = it;
    }
  }

  // forms.suggest 指向的 id 必须存在
  for (const f of data.forms.items) {
    for (const sid of f.suggest || []) {
      if (!seenIds[sid]) errors.push(f.id + " suggest 引用不存在的 id：" + sid);
    }
  }

  // conflicts 的 when / notWith id 必须存在；verdict / why 必须给
  data.conflicts.conflicts.forEach((c, i) => {
    for (const id of c.when) if (!seenIds[id]) errors.push("冲突规则#" + (i + 1) + " when 引用不存在：" + id);
    for (const id of c.notWith) if (!seenIds[id]) errors.push("冲突规则#" + (i + 1) + " notWith 引用不存在：" + id);
    if (!c.verdict || !c.why) errors.push("冲突规则#" + (i + 1) + " 缺 verdict 或 why");
  });

  // 案例配方键（单数）→ 维度键（复数）
  var KEY2DIM = { form: "forms", goal: "goals", spec: "specs", category: "categories", shot: "shots",
    people: "people", scene: "scenes", material: "materials", style: "styles", light: "lights",
    layout: "layouts", decor: "decors" };

  // 案例配方逐条解析
  const matrix = {};
  for (const d of DIMS) matrix[d] = 0;
  for (const cs of data.cases.items) {
    const r = cs.recipe;
    for (const [key, ids] of Object.entries(r)) {
      const dim = KEY2DIM[key];
      if (!dim) { errors.push(cs.id + " recipe 里有未知维度键：" + key); continue; }
      const list = Array.isArray(ids) ? ids : [ids];
      for (const id of list) {
        if (!index[dim][id]) {
          errors.push(cs.id + " " + dim + " 引用不存在：" + id);
        } else {
          matrix[dim]++;
        }
      }
    }
    if (!cs.validates) errors.push(cs.id + " 缺 validates（案例必须写明验证点）");
    if (typeof cs.tested !== "boolean") errors.push(cs.id + " 缺 tested 字段（实测状态必须显式声明，不吹牛）");
  }

  // 任务模板：fills 引用的 id 必须存在；protect / checklist 必须给
  for (const tp of data.templates.items) {
    for (const [dim, id] of Object.entries(tp.fills || {})) {
      if (!KEY2DIM[dim]) { errors.push(tp.id + " fills 里有未知维度键：" + dim); continue; }
      if (!index[KEY2DIM[dim]][id]) errors.push(tp.id + " fills 引用不存在：" + KEY2DIM[dim] + "/" + id);
    }
    if (!tp.protect) errors.push(tp.id + " 缺 protect（商品保护规则是模板的硬要求）");
    if (!Array.isArray(tp.checklist) || !tp.checklist.length) errors.push(tp.id + " 缺 checklist");
  }

  // 输出
  console.log("== 覆盖矩阵（6 案例 × 12 维度）==");
  const head = "case        " + DIMS.map(d => d.slice(0, 5).padEnd(6)).join("");
  console.log(head);
  for (const cs of data.cases.items) {
    const r = cs.recipe;
    const row = DIMS.map(d => {
      const key = Object.keys(r).find(k => KEY2DIM[k] === d);
      const v = key ? r[key] : null;
      const hit = d === "decor" ? (v && v.length) : v;
      return (hit ? "  ✔   " : "  ·   ").slice(0, 6);
    }).join("");
    console.log(cs.id.padEnd(11) + row);
  }
  const zero = DIMS.filter(d => matrix[d] === 0);
  if (zero.length) warns.push("维度未被任何案例覆盖：" + zero.join(", ") + "（覆盖盲区，见 FRAMEWORK.md 边界）");

  console.log("");
  if (warns.length) warns.forEach(w => console.log("⚠ " + w));
  if (errors.length) {
    errors.forEach(e => console.log("✗ " + e));
    console.log("体检失败：" + errors.length + " 个错误");
    process.exit(1);
  }
  console.log("✓ 体检通过：案例引用完整，冲突规则与建议链 id 全部可解析。");
}

if (require.main === module) main();
module.exports = { main };
