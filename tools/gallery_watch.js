#!/usr/bin/env node
/* 画廊守夜人：监听 gallery/ 目录，文件一有增减/替换就自动重建清单。
 * 不论是 JPG、PNG 还是 WebP，只要文件名主干 = 卡片 id（CS-01 / TP-01）就认。
 * 纯 fs.watch，不 spawn 任何外部命令（本机 node spawn 一律 EBUSY，踩过）。
 * 双击 tools/gallery_watch.bat 启动；Ctrl+C 或直接关闭窗口退出。 */
"use strict";
const fs = require("fs");
const path = require("path");
const sync = require("./gallery_sync.js");

const ROOT = path.join(__dirname, "..");
const GAL = path.join(ROOT, "gallery");
const OUT = path.join(ROOT, "assets", "gallery-imgs.js");
const SKIP = f => f.startsWith("_") || f.startsWith(".");

function snapshot() {
  const m = {};
  if (!fs.existsSync(GAL)) return m;
  for (const f of fs.readdirSync(GAL)) {
    if (SKIP(f)) continue;
    try { m[f] = fs.statSync(path.join(GAL, f)).mtimeMs; } catch (e) { /* 正在被写入，下次事件再收 */ }
  }
  return m;
}

function diff(a, b) {
  const evs = [];
  for (const k of Object.keys(a)) if (!(k in b)) evs.push("删除 " + k);
  for (const k of Object.keys(b)) {
    if (!(k in a)) evs.push("新增 " + k);
    else if (a[k] !== b[k]) evs.push("替换 " + k);
  }
  return evs;
}

function manifestText() {
  try { return fs.readFileSync(OUT, "utf8"); } catch (e) { return ""; }
}

let lastManifest = ""; // 上一次同步后的清单内容，用于判断本次同步是否真有变化

function runSync() {
  try {
    sync.main();
  } catch (e) {
    console.log("同步失败：" + e.message + "（文件可能正被占用，等写入完成会自动重试）");
    return;
  }
  const now = manifestText();
  if (now === lastManifest) {
    console.log("（清单内容无变化，跳过）");
  } else {
    lastManifest = now;
    console.log("清单已更新，刷新浏览器页面即可看到新图");
  }
}

console.log("画廊守夜人已启动，监听目录：" + GAL);
console.log("把图放进 gallery/（文件名 = 卡片 id，JPG / PNG / WebP 都认）即自动同步");
console.log("按 Ctrl+C 或直接关闭本窗口退出");
console.log("--------------------------------------------------");

if (!fs.existsSync(GAL)) fs.mkdirSync(GAL, { recursive: true });
try { sync.main(); } catch (e) { console.log("启动同步失败：" + e.message); }
lastManifest = manifestText();
let last = snapshot();

let timer = null;
fs.watch(GAL, { persistent: true }, () => {
  // 出图工具常分多步写文件（先落临时名再改名），防抖 400ms 等它写完
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    let now;
    try { now = snapshot(); } catch (e) { return; }
    const evs = diff(last, now);
    last = now;
    if (!evs.length) return; // 只是内容被 touch 但清单不变，不刷屏
    const stamp = new Date().toTimeString().slice(0, 8);
    console.log("[" + stamp + "] 检测到变化：" + evs.join("，"));
    runSync();
    console.log("--------------------------------------------------");
  }, 400);
});

process.on("SIGINT", () => { console.log("守夜人已退出"); process.exit(0); });
