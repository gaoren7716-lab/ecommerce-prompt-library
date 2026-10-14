/* ECOM 引擎：装配 / 冲突 / 建议链 / 变形算子 / 约束随机 / 盘点。
 * 双跑（Node CLI + 浏览器页面共用同一份逻辑，杜绝两套实现漂移）：
 *   Node:   var ECOM = require("./tools/compose.js");
 *   浏览器: 引入 assets/engine.js 后 window.ECOM
 * 数据来源：浏览器读 window.ECOM_DATA；Node 直接读 data/*.json。 */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) { module.exports = factory(); }
  else { root.ECOM = factory(); }
})(typeof self !== "undefined" ? self : this, function () {
  var DIM_KEYS = ["forms", "goals", "categories", "shots", "people", "scenes",
    "materials", "styles", "lights", "layouts", "specs", "decors"];
  var ASM_ORDER = ["specs", "forms", "goals", "categories", "shots", "people",
    "scenes", "materials", "styles", "lights", "layouts", "decors"];
  var FOOTER = "no watermark, no logo, no deformed hands, no garbled text, realistic proportions, professional product photography";
  // 配方键（单数）→ 维度键（复数）
  var KEY2DIM = { form: "forms", goal: "goals", spec: "specs", category: "categories",
    shot: "shots", people: "people", scene: "scenes", material: "materials",
    style: "styles", light: "lights", layout: "layouts", decor: "decors" };

  var data = (typeof window !== "undefined" && window.ECOM_DATA) ? window.ECOM_DATA : null;
  if (!data) {
    var fs = require("fs"), path = require("path");
    var DATA_DIR = path.join(__dirname, "..", "data");
    data = {};
    DIM_KEYS.concat(["cases", "conflicts", "templates", "palettes"]).forEach(function (n) {
      data[n] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, n + ".json"), "utf8"));
    });
  }

  var index = {}, byId = {};
  DIM_KEYS.forEach(function (d) {
    index[d] = {};
    data[d].items.forEach(function (it) { index[d][it.id] = it; byId[it.id] = it; });
  });
  function dimOf(id) {
    for (var d in index) if (index[d][id]) return d;
    return null;
  }
  function normalize(sel) {
    // 接受复数键（forms）或单数键（form），decor 接受数组
    var out = {};
    Object.keys(sel || {}).forEach(function (k) {
      var d = KEY2DIM[k] || k;
      if (DIM_KEYS.indexOf(d) === -1) return;
      var v = sel[k];
      if (!v) return;
      out[d] = Array.isArray(v) ? v[0] : v; // decor 单选模式（数组取第一个）
    });
    return out;
  }

  /* 视觉强调强度（0.2~1.6，默认 1.0）：
   * 语义 = 卖点与质感的强调档位，不是画质旋钮。高强度追加"质感锤"词段，
   * 低强度收掉专业摄影完成词、回自然呈现 —— 词面意思跟着变，不骗人。
   * 平台铁律层（spec）永远优先：强度再高也不给 Amazon 主图加戏。 */
  function emphasisOf(strength) {
    var s = Number(strength);
    if (!isFinite(s) || s === 1) return "";
    if (s > 1) return "ultra-crisp focus, rich material texture, magazine-grade commercial finish, hero-shot visual impact";
    return "clean natural rendering, soft honest presentation, minimal post-processing";
  }

  function compose(sel, opts) {
    var s = normalize(sel);
    var strength = opts && opts.strength != null ? Number(opts.strength) : 1;
    var segs = [], zh = [];
    ASM_ORDER.forEach(function (d) {
      var id = s[d]; if (!id) return;
      var it = index[d][id]; if (!it) return;
      segs.push(it.prompt);
      zh.push(data[d].zh + "：" + it.zh);
    });
    var em = emphasisOf(strength);
    if (em) segs.push(em);
    var prompt = segs.length ? segs.join(", ") + ", " + FOOTER : "";
    return { prompt: prompt, zh: zh, warnings: conflicts(s), sel: s, strength: strength };
  }

  /* ---------- 电商专用：商品信息 / 保护规则 / 负面词 ---------- */
  var NEGATIVE = "watermark, logo, garbled text, misspelled text, deformed hands, extra fingers, " +
    "duplicate product, distorted proportions, unnatural reflection, cluttered background, " +
    "blurry, low resolution, oversaturated colors, cheap plastic look";
  // 商品保护规则（英文词面）：来自通用模板母版的第 3 节，页面与 CLI 共用一份
  var PROTECT_EN = "Keep the product shape, proportions, color, structure, packaging text and brand logo " +
    "exactly consistent with the reference image. Do not alter the product design or add accessories, " +
    "features, certifications or brand claims that do not exist. Do not fabricate prices, discounts, " +
    "parameters, reviews, certifications or efficacy claims not provided.";

  // 商品信息词段：name / selling / audience 三项，缺项自动省略
  function productSegment(p) {
    p = p || {};
    var parts = [];
    if (p.name && String(p.name).trim()) parts.push("featured product: " + String(p.name).trim());
    if (p.selling && String(p.selling).trim()) parts.push("key selling points to highlight: " + String(p.selling).trim());
    if (p.audience && String(p.audience).trim()) parts.push("target audience: " + String(p.audience).trim());
    return parts.join(", ");
  }

  // 带商品信息的完整装配：商品词段插在 FOOTER（硬约束）之前，垫底的位置永远不让
  function composeFull(sel, product, opts) {
    var r = compose(sel, opts);
    var seg = productSegment(product);
    var prompt = r.prompt;
    if (seg) prompt = prompt ? prompt.replace(FOOTER, seg + ", " + FOOTER) : seg + ", " + FOOTER;
    return { prompt: prompt, zh: r.zh, warnings: r.warnings, sel: r.sel, strength: r.strength };
  }

  /* 商品信息母版：把当前配方 + 商品信息填进通用模板的 8 节结构。
   * 返回 [{h, lines}]，页面直接渲染；这是「母版不建议填满」的落地——
   * 缺的维度显示【填写】占位，提醒用户补，不替用户编。 */
  function masterTemplate(sel, product) {
    var s = normalize(sel), p = product || {};
    function zhOf(d) { return s[d] && index[d][s[d]] ? index[d][s[d]].zh : null; }
    function enOf(d) { return s[d] && index[d][s[d]] ? index[d][s[d]].prompt : null; }
    var secs = [];
    secs.push({ h: "1. 任务定义", lines: [
      "生成一张用于【" + (zhOf("specs") || "目标平台") + "】的【" + (zhOf("forms") || "图片类型") + "】。",
      "主要目标：【" + (zhOf("goals") || "营销目标") + "】。"
    ]});
    secs.push({ h: "2. 商品信息", lines: [
      "商品名称：" + (p.name ? String(p.name) : "【填写】"),
      "商品品类：" + (zhOf("categories") || "【填写】"),
      "商品关键特征：【形状 / 颜色 / 结构 / 材质 / 包装 / 品牌标识，以参考图为准】",
      "核心卖点：" + (p.selling ? String(p.selling) : "【有事实依据的卖点】"),
      "目标消费者：" + (p.audience ? String(p.audience) : "【填写】")
    ]});
    secs.push({ h: "3. 商品保护规则", lines: [PROTECT_EN] });
    secs.push({ h: "4. 场景与构图", lines: [
      "使用场景：" + (zhOf("scenes") || "【选场景】") + (enOf("scenes") ? "（" + enOf("scenes") + "）" : ""),
      "拍摄角度：" + (zhOf("shots") || "【选机位】"),
      "构图方式：" + (zhOf("layouts") || "【选版式】"),
      "商品在画面中的位置：主体清晰，视觉焦点集中在商品上。",
      "画面留白：【文案预留区域】",
      "背景设计：" + (enOf("scenes") || "【选场景】")
    ]});
    secs.push({ h: "5. 光影与材质", lines: [
      "光线类型：" + (zhOf("lights") || "【选光影】"),
      "阴影效果：自然投影，与光源方向一致。",
      "材质表现：" + (zhOf("materials") || "【选材质】"),
      "色彩方案：见「风格配色搭配」页 —— " + (zhOf("styles") || "【选风格】"),
      "真实呈现表面纹理、反射、透明度及自然阴影。"
    ]});
    secs.push({ h: "6. 商业视觉与文案", lines: [
      "视觉风格：" + (zhOf("styles") || "【选风格】"),
      "核心信息：【主标题，未提供的文案不得编造】",
      "辅助信息：【副标题或卖点】",
      "排版位置：" + (zhOf("layouts") || "【选版式】")
    ]});
    secs.push({ h: "7. 输出要求", lines: [
      "画幅比例：" + (enOf("specs") || "【选平台规格】"),
      "图片用途：" + (zhOf("forms") || "【选产出类型】"),
      "整体要求：清晰、真实、商业摄影效果。避免商品变形、细节错误、文字乱码、重复配件、异常反光、杂乱背景。"
    ]});
    secs.push({ h: "8. 最终检查", lines: [
      "商品是否与参考图一致？",
      "核心卖点是否真实且突出？",
      "构图是否适合目标平台？",
      "文字是否准确？",
      "是否满足平台规范及广告要求？"
    ]});
    return secs;
  }

  /* ---------- 出图参数建议（按平台规格） ----------
   * 复制「出图版」时附带：词面解决"画什么"，参数解决"以什么规格生"。
   * 建议值从 specs.json 的登记词面推导（尺寸写进 prompt 的照抄），
   * 工具端最终以各平台实际上传要求为准。 */
  var RENDER_PARAMS = {
    "SP-01": "size 1024x1024（工具端再裁 800x800）· quality high · background auto",
    "SP-02": "size 1024x1024 · quality high · saturation 偏高的促销风",
    "SP-03": "size 1024x1024 · quality high · 干净白底感优先",
    "SP-04": "size 768x1024（3:4）· quality high · 高对比",
    "SP-05": "size 768x1024（3:4）· quality high",
    "SP-06": "size 1024x1024 · quality high · 生活感种草图",
    "SP-07": "size 750x1334（长图分屏）· quality high",
    "SP-08": "size 2000x2000 · quality high · background 纯白 #FFFFFF · 无文字无道具",
    "SP-09": "size 1024x1024 · quality high",
    "SP-10": "size 1024x1024 · quality high",
    "SP-11": "size 768x1024（3:4）· quality high",
    "SP-12": "size 1440x810（16:9）· quality high",
    "SP-13": "size 1440x810（16:9）· quality high",
    "SP-14": "size 1200x628 · quality high",
    "SP-15": "size 1440x810（16:9）· quality high",
    "SP-16": "size 1080x1080 · quality high"
  };
  function renderParams(sel) {
    var s = normalize(sel);
    return RENDER_PARAMS[s.specs] || "size 1024x1024 · quality high";
  }

  /* ---------- 分享码（ECX1.） ----------
   * 配方 = 12 维选择 + 原话 + 强度 + 商品信息，base64url(JSON) 编码。
   * 用途：把调好的配方发给同事/存进运营文档，粘回即还原 ——
   * 比截图可靠（截图看不出选了谁），比手抄快（12 维 id 抄错一个就歪）。 */
  var SHARE_PREFIX = "ECX1.";
  function b64enc(str) {
    if (typeof TextEncoder !== "undefined") {
      var bytes = new TextEncoder().encode(str), bin = "";
      bytes.forEach(function (b) { bin += String.fromCharCode(b); });
      return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    }
    return Buffer.from(str, "utf8").toString("base64")
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function b64dec(code) {
    var s = String(code).replace(/-/g, "+").replace(/_/g, "/");
    if (typeof TextDecoder !== "undefined") {
      var bin = atob(s), bytes = Uint8Array.from(bin, function (c) { return c.charCodeAt(0); });
      return new TextDecoder().decode(bytes);
    }
    return Buffer.from(s, "base64").toString("utf8");
  }
  function encodeShare(state) {
    var s = normalize(state.sel || {});
    var payload = { v: 1, sel: s };
    if (state.freeText && String(state.freeText).trim()) payload.freeText = String(state.freeText).trim();
    if (state.strength && Number(state.strength) !== 1) payload.strength = Number(state.strength);
    if (state.product) {
      var p = {};
      ["name", "selling", "audience"].forEach(function (k) {
        if (state.product[k] && String(state.product[k]).trim()) p[k] = String(state.product[k]).trim();
      });
      if (Object.keys(p).length) payload.product = p;
    }
    return SHARE_PREFIX + b64enc(JSON.stringify(payload));
  }
  function decodeShare(code) {
    var c = String(code || "").trim();
    if (c.indexOf(SHARE_PREFIX) !== 0) throw new Error("不是有效的 ECX1. 分享码");
    var payload = JSON.parse(b64dec(c.slice(SHARE_PREFIX.length)));
    if (!payload || typeof payload !== "object" || !payload.sel) throw new Error("分享码内容不完整");
    return {
      sel: normalize(payload.sel),
      freeText: payload.freeText || "",
      strength: payload.strength != null ? Number(payload.strength) : 1,
      product: payload.product || {}
    };
  }

  /* ---------- 变更清单（合成器输出 tab） ----------
   * 把"这个配方做了什么决定"逐条列出来：选段、强度、原话、冲突裁决。
   * 复制给别人时对方不用倒推你选了哪 12 个维度。 */
  function changesList(sel, opts) {
    var s = normalize(sel), o = opts || {};
    var rows = [];
    ASM_ORDER.forEach(function (d) {
      var id = s[d];
      if (!id || !index[d][id]) return;
      rows.push({ dim: data[d].zh, id: id, zh: index[d][id].zh });
    });
    return {
      rows: rows,
      strength: o.strength != null ? Number(o.strength) : 1,
      freeText: o.freeText || "",
      warnings: conflicts(s)
    };
  }

  /* ---------- 批量出图计划（编码工作台用） ----------
   * 一个商品五张图型的固定骨架；用户的 spec/category/style/material 选择覆盖骨架同名位。
   * 每条计划自带冲突检查——批量最怕一套错五张全错。 */
  var BATCH_PLANS = [
    { key: "hero-white", zh: "白底主图", spec: "SP-01",
      fills: { form: "FO-01", goal: "GO-01", shot: "SH-01", people: "PP-01", scene: "SC-01", light: "LT-01", layout: "LO-09" } },
    { key: "hero-scene", zh: "场景化主图", spec: "SP-01",
      fills: { form: "FO-02", goal: "GO-01", shot: "SH-02", people: "PP-02", scene: "SC-04", light: "LT-03", layout: "LO-05" } },
    { key: "detail-sell", zh: "卖点详情图", spec: "SP-07",
      fills: { form: "FO-04", goal: "GO-04", shot: "SH-03", people: "PP-01", scene: "SC-09", light: "LT-01", layout: "LO-02" } },
    { key: "promo", zh: "促销海报", spec: "SP-02",
      fills: { form: "FO-08", goal: "GO-08", shot: "SH-08", people: "PP-01", scene: "SC-10", light: "LT-05", layout: "LO-08", decor: "DC-08" } },
    { key: "seed", zh: "社媒种草图", spec: "SP-06",
      fills: { form: "FO-09", goal: "GO-01", shot: "SH-05", people: "PP-05", scene: "SC-08", light: "LT-03", layout: "LO-01" } }
  ];
  function batchPlans(user) {
    var u = normalize(user || {});
    return BATCH_PLANS.map(function (plan) {
      var sel = {};
      Object.keys(plan.fills).forEach(function (k) {
        var d = KEY2DIM[k] || k; // fills 用单数键，统一翻成复数维度键
        sel[d] = plan.fills[k];
      });
      sel.specs = u.specs || plan.spec;
      ["categories", "styles", "materials"].forEach(function (d) {
        if (u[d]) sel[d] = u[d];
      });
      var r = compose(sel);
      return { key: plan.key, zh: plan.zh, sel: sel, warnings: r.warnings, prompt: r.prompt };
    });
  }

  // 风格 → 配色卡（画廊色卡、搭配页、词条抽屉共用）
  function paletteOf(styleId) {
    if (!data.palettes || !data.palettes.items) return null;
    for (var i = 0; i < data.palettes.items.length; i++) {
      if (data.palettes.items[i].style === styleId) return data.palettes.items[i];
    }
    return null;
  }

  function conflicts(sel) {
    var s = normalize(sel), msgs = [];
    data.conflicts.conflicts.forEach(function (r) {
      var whenHit = r.when.every(function (id) { return s[dimOf(id)] === id; });
      if (!whenHit) return;
      r.notWith.forEach(function (id) {
        if (s[dimOf(id)] === id) {
          msgs.push({ verdict: r.verdict, why: r.why,
            a: byId[r.when[0]] ? byId[r.when[0]].zh : r.when[0],
            b: byId[id] ? byId[id].zh : id });
        }
      });
    });
    return msgs;
  }

  function suggest(formId) {
    var f = index.forms[formId];
    return (f && f.suggest) ? f.suggest.slice() : [];
  }

  /* 变形算子：给定当前配方，一步变换到新配方（对应 art-forge OPERATORS 的轻量版） */
  var OPERATORS = {
    "white-to-scene": {
      zh: "白底 → 场景化",
      apply: function (sel) {
        var s = Object.assign({}, sel);
        if (s.scenes === "SC-01") s.scenes = "SC-04";
        if (s.layouts === "LO-09") s.layouts = "LO-05";
        if (s.specs === "SP-08") s.specs = "SP-01"; // Amazon 纯白 → 淘宝场景主图
        if (s.people === "PP-01") s.people = "PP-02";
        return s;
      }
    },
    "to-urgency": {
      zh: "加大促紧迫感",
      apply: function (sel) {
        var s = Object.assign({}, sel);
        s.goals = "GO-08"; s.layouts = "LO-08"; s.decors = "DC-08";
        return s;
      }
    },
    "to-brand": {
      zh: "促销 → 品牌调性",
      apply: function (sel) {
        var s = Object.assign({}, sel);
        s.goals = "GO-03"; s.layouts = "LO-09"; s.decors = null;
        if (s.styles === "ST-12") s.styles = "ST-01";
        return s;
      }
    },
    "to-candid": {
      zh: "棚拍 → 真实生活感",
      apply: function (sel) {
        var s = Object.assign({}, sel);
        s.lights = "LT-03"; s.scenes = "SC-06"; s.people = "PP-05";
        return s;
      }
    },
    "to-detail": {
      zh: "整机 → 细节特写",
      apply: function (sel) {
        var s = Object.assign({}, sel);
        s.shots = "SH-06"; s.layouts = "LO-09";
        return s;
      }
    }
  };
  function applyOperator(sel, opId) {
    var op = OPERATORS[opId];
    if (!op) return null;
    return op.apply(normalize(sel));
  }

  /* 约束随机：lock 里的维度锁定，其余随机；最多重试 40 次避开冲突 */
  function random(lock) {
    var l = normalize(lock), s = {}, i, n;
    for (var t = 0; t < 40; t++) {
      DIM_KEYS.forEach(function (d) {
        var items = data[d].items;
        s[d] = items[Math.floor(Math.random() * items.length)].id;
      });
      Object.keys(l).forEach(function (k) { s[k] = l[k]; });
      if (conflicts(s).length === 0) return s;
    }
    Object.keys(l).forEach(function (k) { s[k] = l[k]; });
    return s; // 40 次仍冲突：返回最后一次（调用方会显示警告）
  }

  function stats() {
    var total = 0, combos = 1, per = {};
    DIM_KEYS.forEach(function (d) {
      var n = data[d].items.length; total += n; combos *= n;
      per[d] = { zh: data[d].zh, n: n };
    });
    return { entries: total, combos: combos, per: per,
      cases: data.cases.items.length, templates: data.templates.items.length,
      conflicts: data.conflicts.conflicts.length,
      palettes: data.palettes && data.palettes.items ? data.palettes.items.length : 0 };
  }

  /* 覆盖缺口：哪些维度条目没被任何案例/模板引用、案例实测进度 */
  function gaps() {
    var used = {}, list = [];
    function mark(id) { used[id] = (used[id] || 0) + 1; }
    data.cases.items.forEach(function (cs) {
      Object.keys(cs.recipe).forEach(function (k) {
        var v = cs.recipe[k];
        (Array.isArray(v) ? v : [v]).forEach(mark);
      });
    });
    data.templates.items.forEach(function (tp) {
      Object.keys(tp.fills).forEach(function (k) { mark(tp.fills[k]); });
    });
    DIM_KEYS.forEach(function (d) {
      var unused = data[d].items.filter(function (it) { return !used[it.id]; })
        .map(function (it) { return it.id; });
      if (unused.length) list.push({ dim: d, zh: data[d].zh, unused: unused });
    });
    var untested = data.cases.items.filter(function (cs) { return cs.tested === false; }).length;
    return { unusedByCaseOrTpl: list, untestedCases: untested,
      testedCases: data.cases.items.length - untested };
  }

  return {
    data: data, DIM_KEYS: DIM_KEYS, ASM_ORDER: ASM_ORDER, FOOTER: FOOTER,
    KEY2DIM: KEY2DIM, index: index, byId: byId, dimOf: dimOf,
    compose: compose, conflicts: conflicts, suggest: suggest,
    NEGATIVE: NEGATIVE, PROTECT_EN: PROTECT_EN,
    productSegment: productSegment, composeFull: composeFull, masterTemplate: masterTemplate,
    BATCH_PLANS: BATCH_PLANS, batchPlans: batchPlans, paletteOf: paletteOf,
    OPERATORS: OPERATORS, applyOperator: applyOperator,
    random: random, stats: stats, gaps: gaps,
    emphasisOf: emphasisOf, RENDER_PARAMS: RENDER_PARAMS, renderParams: renderParams,
    SHARE_PREFIX: SHARE_PREFIX, encodeShare: encodeShare, decodeShare: decodeShare,
    changesList: changesList
  };
});
