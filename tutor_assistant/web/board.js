/* Доска: рисование, фигуры, текст, ластик. Локальный режим (без входа) и общая доска пары через сервер. */
(function () {
  "use strict";

  var W = 1600, H = 1000;
  var COLORS = ["#1c1d29", "#3b5bdb", "#e03131", "#2f9e44", "#f08c00", "#ae3ec9"];
  var LOCAL_KEY = "school-board-local-v1";

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "class") node.className = attrs[k];
      else if (k === "text") node.textContent = attrs[k];
      else if (k.slice(0, 2) === "on") node.addEventListener(k.slice(2), attrs[k]);
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) node.appendChild(c); });
    return node;
  }

  function dist2(p, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1];
    var len = dx * dx + dy * dy;
    var t = len ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len)) : 0;
    var x = a[0] + t * dx - p[0], y = a[1] + t * dy - p[1];
    return x * x + y * y;
  }

  /**
   * options.remote: {boardId, request(method, path, body) -> Promise} — общая доска; без него — локальная.
   * options.canClear: можно ли очищать доску (на общей доске — преподаватель).
   */
  function Board(container, options) {
    this.opts = options || {};
    this.items = new Map();      // id -> {id, kind, data, author_role}
    this.hidden = new Set();     // стёртые id
    this.clearedBefore = 0;      // всё, что раньше этого id, очищено
    this.mine = [];              // id своих элементов — для «Отменить»
    this.tempId = -1;
    this.lastId = 0;
    this.tool = "pen";
    this.color = COLORS[0];
    this.width = 4;
    this.drawing = null;
    this.timer = null;
    this.build(container);
    if (this.opts.remote) this.poll(); else this.loadLocal();
  }

  Board.prototype.build = function (container) {
    var self = this;
    this.status = el("span", { class: "board-status", "aria-live": "polite" });
    var tools = [["pen", "✏️", "Ручка"], ["marker", "🖍️", "Маркер"], ["line", "／", "Линия"], ["arrow", "➜", "Стрелка"],
      ["rect", "▭", "Прямоугольник"], ["ellipse", "◯", "Эллипс"], ["text", "T", "Текст"], ["eraser", "⌫", "Ластик"]];
    this.toolButtons = {};
    var bar = el("div", { class: "toolbar", role: "toolbar", "aria-label": "Инструменты доски" });
    tools.forEach(function (t) {
      var b = el("button", { type: "button", title: t[2], "aria-label": t[2], text: t[1],
        onclick: function () { self.setTool(t[0]); } });
      self.toolButtons[t[0]] = b;
      bar.appendChild(b);
    });
    bar.appendChild(el("span", { class: "sep" }));
    this.swatches = [];
    COLORS.forEach(function (c) {
      var s = el("button", { type: "button", class: "swatch", title: "Цвет " + c, "aria-label": "Цвет " + c,
        onclick: function () { self.setColor(c); } });
      s.style.background = c;
      s.dataset.color = c;
      self.swatches.push(s);
      bar.appendChild(s);
    });
    this.picker = el("input", { type: "color", value: this.color, title: "Свой цвет", "aria-label": "Свой цвет" });
    this.picker.addEventListener("input", function () { self.setColor(self.picker.value); });
    bar.appendChild(this.picker);
    var range = el("input", { type: "range", min: "1", max: "24", value: String(this.width), "aria-label": "Толщина" });
    range.addEventListener("input", function () { self.width = Number(range.value); });
    bar.appendChild(range);
    bar.appendChild(el("span", { class: "sep" }));
    bar.appendChild(el("button", { type: "button", text: "↶ Отменить", onclick: function () { self.undo(); } }));
    this.gridBtn = el("button", { type: "button", text: "Сетка", onclick: function () { self.toggleGrid(); } });
    bar.appendChild(this.gridBtn);
    if (!this.opts.remote || this.opts.canClear) {
      bar.appendChild(el("button", { type: "button", text: "Очистить", onclick: function () { self.clearAll(); } }));
    }
    bar.appendChild(el("button", { type: "button", text: "⬇ PNG", onclick: function () { self.exportPng(); } }));

    this.canvas = el("canvas", { width: String(W), height: String(H), "aria-label": "Доска для рисования" });
    this.wrap = el("div", { class: "canvas-wrap" }, [this.canvas]);
    this.ctx = this.canvas.getContext("2d");
    container.appendChild(el("div", { class: "board-shell" }, [bar, this.wrap, this.status]));
    this.setTool("pen");
    this.setColor(this.color);

    this.canvas.addEventListener("pointerdown", function (e) { self.down(e); });
    this.canvas.addEventListener("pointermove", function (e) { self.move(e); });
    window.addEventListener("pointerup", this._up = function (e) { self.up(e); });
    this.resize();
    window.addEventListener("resize", this._resize = function () { self.resize(); });
  };

  Board.prototype.destroy = function () {
    clearTimeout(this.timer);
    this.destroyed = true;
    window.removeEventListener("pointerup", this._up);
    window.removeEventListener("resize", this._resize);
  };

  Board.prototype.resize = function () {
    var ratio = Math.min(2, window.devicePixelRatio || 1);
    var cssW = this.wrap.clientWidth || W;
    var scale = Math.max(1, (cssW * ratio) / W);
    this.canvas.width = Math.round(W * scale);
    this.canvas.height = Math.round(H * scale);
    this.scale = scale;
    this.render();
  };

  Board.prototype.setTool = function (t) {
    this.tool = t;
    Object.keys(this.toolButtons).forEach(function (k) {
      this.toolButtons[k].classList.toggle("active", k === t);
      this.toolButtons[k].setAttribute("aria-pressed", String(k === t));
    }, this);
    this.canvas && (this.canvas.style.cursor = t === "text" ? "text" : t === "eraser" ? "cell" : "crosshair");
  };

  Board.prototype.setColor = function (c) {
    this.color = c;
    this.picker.value = c;
    this.swatches.forEach(function (s) { s.classList.toggle("active", s.dataset.color === c); });
  };

  Board.prototype.toggleGrid = function () {
    var on = this.wrap.classList.toggle("grid-on");
    this.gridBtn.classList.toggle("active", on);
  };

  Board.prototype.pos = function (e) {
    var r = this.canvas.getBoundingClientRect();
    return [Math.round(((e.clientX - r.left) / r.width) * W * 10) / 10,
      Math.round(((e.clientY - r.top) / r.height) * H * 10) / 10];
  };

  Board.prototype.down = function (e) {
    if (e.button !== undefined && e.button !== 0) return;
    var p = this.pos(e);
    if (this.tool === "text") { e.preventDefault(); this.askText(p); return; }
    this.canvas.setPointerCapture && this.canvas.setPointerCapture(e.pointerId);
    if (this.tool === "eraser") { this.drawing = { erase: [] }; this.eraseAt(p); return; }
    if (this.tool === "pen" || this.tool === "marker") {
      this.drawing = { kind: "stroke", data: { tool: this.tool, color: this.color,
        width: this.tool === "marker" ? this.width * 4 : this.width, points: [p] } };
    } else {
      this.drawing = { kind: "shape", data: { shape: this.tool, color: this.color, width: this.width, from: p, to: p } };
    }
    this.render();
  };

  Board.prototype.move = function (e) {
    if (!this.drawing) return;
    var p = this.pos(e);
    if (this.drawing.erase) { this.eraseAt(p); return; }
    if (this.drawing.kind === "stroke") {
      var pts = this.drawing.data.points, last = pts[pts.length - 1];
      if (Math.abs(last[0] - p[0]) + Math.abs(last[1] - p[1]) < 2 || pts.length >= 5000) return;
      pts.push(p);
    } else {
      this.drawing.data.to = p;
    }
    this.render();
  };

  Board.prototype.up = function () {
    var d = this.drawing;
    if (!d) return;
    this.drawing = null;
    if (d.erase) {
      if (d.erase.length) this.commit("erase", { ids: d.erase });
      return;
    }
    if (d.kind === "shape" && d.data.from[0] === d.data.to[0] && d.data.from[1] === d.data.to[1]) { this.render(); return; }
    this.commit(d.kind, d.data);
  };

  Board.prototype.askText = function (p) {
    var self = this;
    if (this.textInput) this.textInput.remove();
    var input = el("input", { type: "text", class: "text-input", maxlength: "500", placeholder: "Текст и Enter",
      "aria-label": "Текст на доске" });
    var r = this.canvas.getBoundingClientRect();
    input.style.left = Math.min(r.width - 170, (p[0] / W) * r.width) + "px";
    input.style.top = Math.max(0, (p[1] / H) * r.height - 18) + "px";
    input.style.color = this.color;
    this.wrap.appendChild(input);
    this.textInput = input;
    input.focus();
    setTimeout(function () { if (document.activeElement !== input) input.focus(); }, 0);
    var done = false;
    function finish(save) {
      if (done) return;
      done = true;
      var text = input.value.trim();
      input.remove();
      self.textInput = null;
      if (save && text) self.commit("text", { text: text, color: self.color, size: 18 + self.width * 3, at: [p[0], p[1] + 10] });
    }
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") finish(true);
      if (e.key === "Escape") finish(false);
    });
    input.addEventListener("blur", function () { finish(true); });
  };

  Board.prototype.visible = function () {
    var self = this, out = [];
    this.items.forEach(function (it) {
      if (it.kind === "erase" || it.kind === "clear" || self.hidden.has(it.id)) return;
      if (it.id > 0 && it.id < self.clearedBefore) return;
      out.push(it);
    });
    out.sort(function (a, b) { return (a.id < 0 ? 1e12 - a.id : a.id) - (b.id < 0 ? 1e12 - b.id : b.id); });
    return out;
  };

  Board.prototype.eraseAt = function (p) {
    var self = this;
    this.visible().forEach(function (it) {
      if (it.id < 0 || self.drawing.erase.indexOf(it.id) >= 0 || !self.hit(it, p)) return;
      self.drawing.erase.push(it.id);
      self.hidden.add(it.id);
    });
    this.render();
  };

  Board.prototype.hit = function (it, p) {
    var d = it.data, tol = (d.width || 4) / 2 + 8, tol2 = tol * tol, i;
    if (it.kind === "stroke") {
      if (d.points.length === 1) return dist2(p, d.points[0], d.points[0]) < tol2;
      for (i = 1; i < d.points.length; i++) if (dist2(p, d.points[i - 1], d.points[i]) < tol2) return true;
      return false;
    }
    if (it.kind === "text") {
      var w = d.text.length * d.size * 0.55;
      return p[0] >= d.at[0] - 6 && p[0] <= d.at[0] + w + 6 && p[1] >= d.at[1] - d.size && p[1] <= d.at[1] + 8;
    }
    var a = d.from, b = d.to;
    if (d.shape === "line" || d.shape === "arrow") return dist2(p, a, b) < tol2;
    var x1 = Math.min(a[0], b[0]) - tol, x2 = Math.max(a[0], b[0]) + tol;
    var y1 = Math.min(a[1], b[1]) - tol, y2 = Math.max(a[1], b[1]) + tol;
    return p[0] >= x1 && p[0] <= x2 && p[1] >= y1 && p[1] <= y2;
  };

  Board.prototype.commit = function (kind, data) {
    var self = this;
    var temp = { id: this.tempId--, kind: kind, data: data };
    this.apply(temp);
    if (!this.opts.remote) {
      this.items.delete(temp.id);
      temp.id = ++this.lastId;
      this.apply(temp);
      if (kind !== "erase" && kind !== "clear") this.mine.push(temp.id);
      this.saveLocal();
      this.render();
      return;
    }
    this.opts.remote.request("POST", "/site/v1/boards/" + this.opts.remote.boardId + "/items", { kind: kind, data: data })
      .then(function (res) {
        self.items.delete(temp.id);
        temp.id = res.id;
        if (kind !== "erase" && kind !== "clear") self.mine.push(res.id);
        self.apply(temp);
        if (res.warning) self.say(res.warning);
        self.render();
      })
      .catch(function (err) {
        self.items.delete(temp.id);
        if (kind === "erase") data.ids.forEach(function (id) { self.hidden.delete(id); });
        self.say("⛔ " + err.message);
        self.render();
      });
  };

  Board.prototype.apply = function (it) {
    var self = this;
    if (this.items.has(it.id) && it.id > 0) return;
    this.items.set(it.id, it);
    if (it.kind === "erase") it.data.ids.forEach(function (id) { self.hidden.add(id); });
    if (it.kind === "clear") this.clearedBefore = Math.max(this.clearedBefore, it.id);
    if (it.id > 0) this.lastId = Math.max(this.lastId, it.id);
  };

  Board.prototype.undo = function () {
    while (this.mine.length) {
      var id = this.mine.pop();
      if (!this.hidden.has(id) && this.items.has(id)) { this.commit("erase", { ids: [id] }); return; }
    }
    this.say("Отменять нечего.");
  };

  Board.prototype.clearAll = function () {
    if (!window.confirm("Очистить доску для всех?")) return;
    if (!this.opts.remote) {
      this.items.clear(); this.hidden.clear(); this.mine = []; this.clearedBefore = 0; this.lastId = 0;
      this.saveLocal(); this.render(); return;
    }
    this.commit("clear", {});
  };

  Board.prototype.render = function () {
    var ctx = this.ctx, s = this.scale || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(s, 0, 0, s, 0, 0);
    var self = this;
    this.visible().forEach(function (it) { self.draw(it); });
    if (this.drawing && !this.drawing.erase) this.draw(this.drawing);
  };

  Board.prototype.draw = function (it) {
    var ctx = this.ctx, d = it.data;
    ctx.save();
    ctx.strokeStyle = ctx.fillStyle = d.color;
    ctx.lineWidth = d.width || 3;
    ctx.lineCap = ctx.lineJoin = "round";
    if (it.kind === "stroke") {
      if (d.tool === "marker") ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.moveTo(d.points[0][0], d.points[0][1]);
      if (d.points.length === 1) ctx.lineTo(d.points[0][0] + 0.1, d.points[0][1]);
      for (var i = 1; i < d.points.length; i++) ctx.lineTo(d.points[i][0], d.points[i][1]);
      ctx.stroke();
    } else if (it.kind === "text") {
      ctx.font = d.size + "px system-ui, -apple-system, Segoe UI, sans-serif";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(d.text, d.at[0], d.at[1]);
    } else if (it.kind === "shape") {
      var a = d.from, b = d.to;
      ctx.beginPath();
      if (d.shape === "rect") ctx.strokeRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
      else if (d.shape === "ellipse") {
        ctx.ellipse((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.abs(b[0] - a[0]) / 2, Math.abs(b[1] - a[1]) / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        if (d.shape === "arrow") {
          var ang = Math.atan2(b[1] - a[1], b[0] - a[0]), len = 14 + ctx.lineWidth * 2;
          ctx.beginPath();
          ctx.moveTo(b[0], b[1]);
          ctx.lineTo(b[0] - len * Math.cos(ang - 0.45), b[1] - len * Math.sin(ang - 0.45));
          ctx.moveTo(b[0], b[1]);
          ctx.lineTo(b[0] - len * Math.cos(ang + 0.45), b[1] - len * Math.sin(ang + 0.45));
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  };

  Board.prototype.exportPng = function () {
    var c = document.createElement("canvas");
    c.width = this.canvas.width; c.height = this.canvas.height;
    var x = c.getContext("2d");
    x.fillStyle = "#ffffff"; x.fillRect(0, 0, c.width, c.height);
    x.drawImage(this.canvas, 0, 0);
    var a = el("a", { href: c.toDataURL("image/png"), download: "board.png" });
    document.body.appendChild(a); a.click(); a.remove();
  };

  Board.prototype.say = function (text) {
    var st = this.status;
    st.textContent = text;
    clearTimeout(this._sayTimer);
    this._sayTimer = setTimeout(function () { st.textContent = ""; }, 6000);
  };

  // -- общая доска: опрос сервера -------------------------------------------------
  Board.prototype.poll = function () {
    var self = this, r = this.opts.remote;
    if (this.destroyed) return;
    r.request("GET", "/site/v1/boards/" + r.boardId + "/items?since=" + this.lastId)
      .then(function (res) {
        res.items.forEach(function (it) { self.apply(it); });
        if (res.items.length) self.render();
        self.failures = 0;
        self.timer = setTimeout(function () { self.poll(); }, document.hidden ? 5000 : 1500);
      })
      .catch(function (err) {
        self.failures = (self.failures || 0) + 1;
        self.say("Нет связи с сервером: " + err.message);
        self.timer = setTimeout(function () { self.poll(); }, Math.min(30000, 2000 * self.failures));
      });
  };

  // -- локальная доска: сохраняется только в этом браузере --------------------------------
  Board.prototype.saveLocal = function () {
    try {
      var data = this.visible().map(function (it) { return { id: it.id, kind: it.kind, data: it.data }; });
      localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
    } catch (e) { /* хранилище недоступно — доска работает без сохранения */ }
  };

  Board.prototype.loadLocal = function () {
    var self = this;
    try {
      var data = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
      data.forEach(function (it) { if (it && it.id > 0 && it.data) self.apply(it); });
    } catch (e) { /* пусто */ }
    this.render();
  };

  window.SchoolBoard = Board;
})();
