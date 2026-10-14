#!/usr/bin/env node
/* 字段体检：查条目质量（与 check_cases 分工——那个查引用与覆盖，这个查字）。
 * 查什么：id 格式、空字段、prompt 混中文、中文名混英文单词（中英串味）、
 *          坏字符（西里尔/零宽/非 ASCII 控制符）、suggest/fills 引用存在。
 * 不保证什么：提示词出图效果。 */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DIMS = ["forms", "goals", "categories", "shots", "people", "scenes", "materials", "styles", "lights", "layouts", "specs", "decors"];
const errors = [];

function load(name) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "data", name + ".json"), "utf8"));
}
const data = {};
DIMS.concat(["cases", "templates"]).forEach(d => { data[d] = load(d); });
data.palettes = load("palettes");

// 坏字符：西里尔、零宽、BOM、非 ASCII 控制符
function badChars(s) {
  const hits = [];
  if (/[\u0400-\u04FF]/.test(s)) hits.push("西里尔字母");
  if (/[\u200B-\u200F\uFEFF]/.test(s)) hits.push("零宽字符");
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(s)) hits.push("控制符");
  return hits;
}

const knownIds = {};
DIMS.forEach(d => {
  data[d].items.forEach(it => {
    knownIds[it.id] = true;
    if (!/^[A-Z]{2}-\d{2}$/.test(it.id)) errors.push(it.id + " id 格式非法（应为两位字母-两位数字）");
    ["zh", "prompt"].forEach(f => {
      if (!it[f] || !it[f].trim()) errors.push(it.id + " 字段 " + f + " 为空");
      else badChars(it[f]).forEach(h => errors.push(it.id + " 字段 " + f + " 含" + h));
    });
    if (/[\u4e00-\u9fff]/.test(it.prompt)) errors.push(it.id + " prompt 混入中文（prompt 必须是英文视觉指令）");
    // 中文名混英文单词（中英串味），平台/风格专有名词白名单除外
    var WHITELIST = /Banner|Amazon|Etsy|Shopify|Instagram|Twitter|Facebook|Pinterest|TikTok|\bins\b|Feed|A\+|\bX\b/gi;
    var rest = it.zh.replace(WHITELIST, "");
    if (/[A-Za-z]{3,}/.test(rest)) errors.push(it.id + " 中文名混入英文单词（中英串味）：" + it.zh);
    // 新品类必须补行业规范
    if (d === "categories") {
      if (!it.rules) errors.push(it.id + " 缺 rules（新品类必须补推荐拍法）");
      if (!it.aiTrap) errors.push(it.id + " 缺 aiTrap（新品类必须补 AI 常见错误）");
    }
  });
});

// 所有引用链（suggest / fills / recipe）
function checkRef(from, id, where) {
  if (!knownIds[id]) errors.push(from + " " + where + " 引用不存在：" + id);
}
data.forms.items.forEach(f => (f.suggest || []).forEach(id => checkRef(f.id, id, "suggest")));
data.templates.items.forEach(tp =>
  Object.entries(tp.fills || {}).forEach(([k, id]) => checkRef(tp.id, id, "fills." + k)));

// palettes：style 必须存在、色值必须合法、引用链必须存在
const styleIds = {};
data.styles.items.forEach(s => { styleIds[s.id] = true; });
data.palettes.items.forEach(pl => {
  if (!/^PL-\d{2}$/.test(pl.id)) errors.push(pl.id + " id 格式非法（应为 PL-两位数字）");
  if (!styleIds[pl.style]) errors.push(pl.id + " 指向不存在的风格：" + pl.style);
  if (!pl.styleZh || !pl.note || !pl.avoid) errors.push(pl.id + " 缺 styleZh / note / avoid");
  if (!Array.isArray(pl.swatches) || pl.swatches.length < 4 || pl.swatches.length > 6) {
    errors.push(pl.id + " 色卡应 4-6 色（收到 " + (pl.swatches || []).length + "）");
  }
  (pl.swatches || []).forEach(sw => {
    if (!/^#[0-9A-Fa-f]{6}$/.test(sw.hex || "")) errors.push(pl.id + " 色值非法：" + sw.hex);
    if (!sw.name) errors.push(pl.id + " 色块缺名称");
  });
  ["cats", "scenes", "lights", "layouts"].forEach(field =>
    (pl[field] || []).forEach(id => checkRef(pl.id, id, field)));
});
// 每个风格都要有配色卡（漏一个 = 搭配页缺一格）
data.styles.items.forEach(s => {
  if (!data.palettes.items.some(pl => pl.style === s.id)) {
    errors.push(s.id + " " + s.zh + " 缺配色卡（palettes.json 每个风格都要有）");
  }
});

if (errors.length) {
  errors.forEach(e => console.log("✗ " + e));
  console.log("字段体检失败：" + errors.length + " 个问题");
  process.exit(1);
}
console.log("✓ 字段体检通过：id 格式、字段非空、prompt 无中文、中文名无串味、无坏字符、行业规范齐备。");
