/* Сайт онлайн-школы: разделы, каталог, заявка, личный кабинет, доска. Без внешних библиотек. */
(function () {
  "use strict";

  var app = document.getElementById("app");
  var TOKEN_KEY = "school-access-token";
  var state = { catalog: null, me: null, board: null };

  // -- утилиты -------------------------------------------------------------------
  function h(tag, attrs) {
    var node = document.createElement(tag);
    var children = Array.prototype.slice.call(arguments, 2);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else if (k.slice(0, 2) === "on") node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? "" : v);
    });
    children.forEach(function add(c) {
      if (c === null || c === undefined || c === false) return;
      if (Array.isArray(c)) { c.forEach(add); return; }
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  function list(items, cls) {
    if (!items || !items.length) return null;
    return h("ul", { class: cls || "clean" }, items.map(function (x) { return h("li", null, x); }));
  }

  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return state.token || null; }
  }
  function setToken(t) {
    state.token = t;
    try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch (e) { /* нет хранилища */ }
  }

  function request(method, path, body) {
    var headers = { "Accept": "application/json" };
    var token = getToken();
    if (token) headers["X-Access-Token"] = token;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    return fetch(path, { method: method, headers: headers, body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin" })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (data) {
          if (!r.ok) {
            var err = new Error(data.error || ("ошибка " + r.status));
            err.status = r.status;
            throw err;
          }
          return data;
        });
      });
  }

  function loadCatalog() {
    if (state.catalog) return Promise.resolve(state.catalog);
    return request("GET", "/site/v1/catalog").then(function (c) {
      state.catalog = c;
      document.getElementById("school-name").textContent = c.school_name;
      document.getElementById("school-name-foot").textContent = c.school_name;
      document.title = c.school_name;
      return c;
    });
  }

  function courseById(id) {
    return (state.catalog.courses || []).filter(function (c) { return c.id === id; })[0];
  }
  function category(id) {
    return (state.catalog.categories || []).filter(function (c) { return c.id === id; })[0];
  }
  function fmtDate(iso) {
    try { return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }); }
    catch (e) { return iso; }
  }
  function botUrl() {
    return state.catalog && state.catalog.bot_username ? "https://t.me/" + state.catalog.bot_username : null;
  }

  function parseHash() {
    var raw = location.hash.replace(/^#\/?/, "");
    var q = raw.indexOf("?");
    var path = q >= 0 ? raw.slice(0, q) : raw;
    var params = new URLSearchParams(q >= 0 ? raw.slice(q + 1) : "");
    return { parts: path.split("/").filter(Boolean), params: params };
  }

  function setActive(route) {
    Array.prototype.forEach.call(document.querySelectorAll("#tabs a"), function (a) {
      var on = a.dataset.route === route;
      a.classList.toggle("active", on);
      if (on) {
        a.setAttribute("aria-current", "page");
        var nav = a.parentNode;  // на телефоне меню прокручивается: показываем активную вкладку
        if (a.offsetLeft < nav.scrollLeft || a.offsetLeft + a.offsetWidth > nav.scrollLeft + nav.clientWidth) {
          nav.scrollLeft = a.offsetLeft - 16;
        }
      } else a.removeAttribute("aria-current");
    });
  }

  function show() {
    if (state.board) { state.board.destroy(); state.board = null; }
    app.textContent = "";
    Array.prototype.forEach.call(arguments, function (n) { if (n) app.appendChild(n); });
    window.scrollTo(0, 0);
  }

  function errorBox(err) {
    return h("div", { class: "notice bad", role: "alert" }, err.message || String(err));
  }

  // -- карточки курсов ------------------------------------------------------------
  function courseCard(c) {
    return h("article", { class: "card course-card" },
      h("div", { class: "chips" }, h("span", { class: "chip accent" }, (category(c.category) || {}).title || "")),
      h("h3", null, c.title),
      h("p", { class: "muted grow" }, c.short),
      h("div", { class: "chips" }, (c.levels || []).map(function (l) { return h("span", { class: "chip" }, l); })),
      h("div", { class: "actions" },
        h("a", { class: "btn small secondary", href: "#/course/" + c.id }, "Подробнее"),
        h("a", { class: "btn small", href: "#/apply?course=" + c.id }, "Пробный урок")));
  }

  // -- страницы ---------------------------------------------------------------------
  function pageHome() {
    var c = state.catalog;
    var counts = {};
    c.courses.forEach(function (x) { counts[x.category] = (counts[x.category] || 0) + 1; });
    show(
      h("section", { class: "hero" },
        h("div", null,
          h("h1", null, "Английский и китайский онлайн — к вашей цели"),
          h("p", { class: "lead" }, "Общий и профессиональный английский: IT, авиация, медицина. Подготовка к IELTS, TOEFL, " +
            "Duolingo English Test, Cambridge и другим экзаменам. Китайский с нуля и HSK всех уровней — от 1 до 7–9."),
          h("div", { class: "btn-row" },
            h("a", { class: "btn", href: "#/apply" }, "Записаться на пробный урок"),
            h("a", { class: "btn secondary", href: "#/courses" }, "Все направления"))),
        h("div", { class: "hero-panel" },
          h("h3", null, "После каждого урока"),
          list(["📘 Конспект: правила, ключевые моменты, работа над ошибками", "🆕 Новые слова — сразу в ваш словарь",
            "✅ Тест для самопроверки дома", "📝 Домашнее задание", "👪 Родителям — отчёт об успехах"]),
          h("p", { class: "muted small" }, "Всё приходит в Telegram и сохраняется в личном кабинете."))),
      h("section", null,
        h("h2", null, "Направления"),
        h("div", { class: "grid cols-4" }, c.categories.map(function (cat) {
          return h("a", { class: "card tile", href: cat.id === "chinese" ? "#/chinese" : cat.id === "exams" ? "#/exams" :
            "#/courses?cat=" + cat.id },
            h("span", { class: "ico", "aria-hidden": "true" }, cat.icon), h("strong", null, cat.title),
            h("span", { class: "count" }, (counts[cat.id] || 0) + " программ"));
        }))),
      h("section", null, h("h2", null, "Как мы учим"), stepsBlock()),
      h("section", null,
        h("h2", null, "Форматы"),
        h("div", { class: "grid cols-3" }, c.formats.map(function (f) {
          return h("div", { class: "card" }, h("h3", null, f.title), h("p", { class: "muted" }, f.text));
        }))),
      h("section", { class: "card" },
        h("h2", null, "Начните с бесплатного пробного урока"),
        h("p", { class: "muted" }, "Определим уровень, поймём цель и подберём преподавателя и программу."),
        h("a", { class: "btn", href: "#/apply" }, "Оставить заявку")));
  }

  function stepsBlock() {
    return h("div", { class: "steps" }, state.catalog.steps.map(function (s) {
      return h("div", { class: "card step" }, h("h3", null, s.title), h("p", { class: "muted small" }, s.text));
    }));
  }

  function pageCourses(params, fixedCat) {
    var c = state.catalog;
    var cat = fixedCat || params.get("cat") || "all";
    var title = fixedCat ? (category(fixedCat) || {}).title : "Направления";
    var grid = h("div", { class: "grid cols-3" });
    var seg = h("div", { class: "segmented", role: "tablist", "aria-label": "Категории" });
    function fill(id) {
      cat = id;
      grid.textContent = "";
      c.courses.filter(function (x) { return id === "all" || x.category === id; }).forEach(function (x) {
        grid.appendChild(courseCard(x));
      });
      Array.prototype.forEach.call(seg.children, function (b) {
        var on = b.dataset.id === id;
        b.classList.toggle("active", on);
        b.setAttribute("aria-selected", String(on));
      });
    }
    if (!fixedCat) {
      [{ id: "all", title: "Все" }].concat(c.categories).forEach(function (x) {
        seg.appendChild(h("button", { type: "button", role: "tab", "data-id": x.id, onclick: function () {
          history.replaceState(null, "", "#/courses" + (x.id === "all" ? "" : "?cat=" + x.id));
          fill(x.id);
        } }, x.icon ? x.icon + " " + x.title : x.title));
      });
    }
    var intro = fixedCat === "chinese" ? h("div", null,
      h("p", { class: "muted" }, "Китайский с нуля, деловой китайский и подготовка к HSK по всем уровням. Тоны и " +
        "иероглифы ставим с первого урока, а слова каждого урока попадают в ваш словарь с пиньинем и переводом."),
      hskTable()) : null;
    show(h("section", null, h("h1", null, title), intro, fixedCat ? null : seg, grid));
    fill(cat);
  }

  function hskTable() {
    var rows = state.catalog.courses.filter(function (x) { return x.hsk; });
    if (!rows.length) return null;
    return h("div", { class: "card table-wrap", style: null },
      h("h3", null, "Уровни HSK"),
      h("p", { class: "muted small" }, "Число слов — по новому стандарту HSK 3.0."),
      h("table", { class: "data" },
      h("thead", null, h("tr", null, h("th", null, "Уровень"), h("th", null, "Что умеете"), h("th", null, "Слов"))),
        h("tbody", null, rows.map(function (r) {
          return h("tr", null, h("td", null, h("a", { href: "#/course/" + r.id }, "HSK " + r.hsk)), h("td", null, r.short),
            h("td", null, r.words ? r.words.toLocaleString("ru-RU") : ""));
        }))));
  }

  function pageExams() {
    var exams = state.catalog.courses.filter(function (x) { return x.exam; });
    show(h("section", null,
      h("h1", null, "Подготовка к международным экзаменам"),
      h("p", { class: "muted" }, "Готовим по официальному формату: пробные экзамены, разбор каждого задания, проверка " +
        "письма и устной части по критериям экзаменаторов. Формат экзаменов иногда меняется — актуальные правила " +
        "проверяем на сайте организатора перед регистрацией."),
      h("div", { class: "card table-wrap" },
        h("table", { class: "data" },
          h("thead", null, h("tr", null, h("th", null, "Экзамен"), h("th", null, "Шкала"), h("th", null, "Длительность"),
            h("th", null, "Важно знать"))),
          h("tbody", null, exams.map(function (c) {
            return h("tr", null,
              h("td", null, h("a", { href: "#/course/" + c.id }, c.exam.name)),
              h("td", null, c.exam.scale || "—"), h("td", null, c.exam.duration || "—"), h("td", null, c.exam.note || ""));
          }))))),
      h("section", null, h("h2", null, "Программы подготовки"),
        h("div", { class: "grid cols-3" }, state.catalog.courses.filter(function (x) {
          return x.category === "exams" || x.hsk;
        }).map(courseCard))));
  }

  function pageCourse(id) {
    var c = courseById(id);
    if (!c) { show(h("section", null, h("h1", null, "Курс не найден"), h("a", { href: "#/courses" }, "Все направления"))); return; }
    var cat = category(c.category) || {};
    show(h("section", null,
      h("p", { class: "small" }, h("a", { href: cat.id === "chinese" ? "#/chinese" : "#/courses?cat=" + cat.id },
        "← " + (cat.title || "Направления"))),
      h("h1", null, c.title),
      h("p", { class: "lead muted" }, c.short),
      h("div", { class: "chips" }, (c.levels || []).map(function (l) { return h("span", { class: "chip accent" }, l); })),
      h("div", { class: "grid cols-2" },
        h("div", { class: "card" }, h("h3", null, "Программа"), list(c.program)),
        h("div", { class: "card" },
          c.for_whom ? [h("h3", null, "Кому подходит"), list(c.for_whom)] : null,
          c.result ? [h("h3", null, "Результат"), h("p", null, c.result)] : null,
          c.exam ? [h("h3", null, "Об экзамене"), list([c.exam.name, c.exam.scale && "Шкала: " + c.exam.scale,
            c.exam.duration && "Длительность: " + c.exam.duration, c.exam.note].filter(Boolean))] : null,
          h("h3", null, "Как проходят занятия"),
          list(["Уроки на платформе ProgressMe: учебник, доска и видеосвязь", "Связь с преподавателем — в Telegram через бота школы",
            "После урока — конспект, новые слова, тест и ДЗ"]))),
      h("div", { class: "btn-row", style: null },
        h("a", { class: "btn", href: "#/apply?course=" + c.id }, "Записаться на пробный урок"))));
  }

  function pageHow() {
    var bot = botUrl();
    show(h("section", null,
      h("h1", null, "Как проходят уроки"),
      stepsBlock()),
      h("section", { class: "grid cols-2" },
        h("div", { class: "card" },
          h("h3", null, "🎥 Урок на ProgressMe"),
          h("p", null, "Занятия идут на платформе ProgressMe: интерактивные учебники, общая доска, аудио и видео в одном окне. " +
            "Ссылку на ваш класс выдаёт школа — она есть в личном кабинете и приходит в Telegram в начале урока."),
          h("p", { class: "muted small" }, "Урок записывается и расшифровывается: так собирается конспект, а школа " +
            "отвечает за качество занятий.")),
        h("div", { class: "card" },
          h("h3", null, "💬 Переписка в Telegram"),
          h("p", null, "Вопросы, домашние задания и материалы — в чате с преподавателем через бота школы. " +
            "Преподаватель не видит ваш номер и аккаунт, а вы — его."),
          bot ? h("a", { class: "btn small", href: bot, target: "_blank", rel: "noopener" }, "Открыть бота школы") : null),
        h("div", { class: "card" },
          h("h3", null, "📘 Материалы после урока"),
          list(["Конспект: тема, правила с примерами, ключевые моменты", "Работа над ошибками", "Новые слова с переводом",
            "Тест для самопроверки", "Домашнее задание — от преподавателя и дополнительное по теме", "Что повторить к следующему уроку"])),
        h("div", { class: "card" },
          h("h3", null, "👪 Для родителей"),
          p("После каждого урока родители получают отчёт: что прошли, успехи, на что обратить внимание, замечания " +
            "преподавателя и статус домашнего задания."))),
      h("section", { class: "card" },
        h("h3", null, "🔒 Безопасность и правила"),
        list(["Общение с преподавателем — только через бота школы и платформу уроков",
          "Обмен личными контактами (телефон, почта, мессенджеры) запрещён и автоматически блокируется",
          "Оплата — только школе. Если преподаватель предлагает заниматься напрямую, сообщите администратору",
          "Записи и переписка хранятся у школы и используются для конспектов и контроля качества"])));
  }

  function p(text) { return h("p", null, text); }

  function pageApply(params) {
    var c = state.catalog;
    var status = h("div", { "aria-live": "polite" });
    var select = h("select", { name: "course_id" }, h("option", { value: "" }, "Пока не знаю — помогите выбрать"),
      c.categories.map(function (cat) {
        return h("optgroup", { label: cat.title }, c.courses.filter(function (x) { return x.category === cat.id; })
          .map(function (x) { return h("option", { value: x.id }, x.title); }));
      }));
    if (params.get("course")) select.value = params.get("course");
    var form = h("form", { class: "stack", novalidate: true },
      h("label", null, "Как к вам обращаться", h("input", { type: "text", name: "name", required: true, maxlength: "80",
        autocomplete: "name" })),
      h("label", null, "Телефон, Telegram или почта для связи с менеджером школы",
        h("input", { type: "text", name: "contact", required: true, maxlength: "120", autocomplete: "tel" }),
        h("span", { class: "muted small" }, "Контакт видит только администратор школы, преподавателям он не передаётся.")),
      h("label", null, "Направление", select),
      h("label", null, "Уровень (если знаете)", h("input", { type: "text", name: "level", maxlength: "40",
        placeholder: "например, B1 или HSK 3" })),
      h("label", null, "Цель", h("input", { type: "text", name: "goal", maxlength: "300",
        placeholder: "сдать IELTS на 7.0, пройти собеседование, HSK 4 для поступления…" })),
      h("label", null, "Комментарий", h("textarea", { name: "comment", maxlength: "1000",
        placeholder: "удобное время, возраст ученика, пожелания" })),
      h("div", { class: "hp", "aria-hidden": "true" }, h("label", null, "Сайт", h("input", { type: "text", name: "website",
        tabindex: "-1", autocomplete: "off" }))),
      h("label", { class: "check" }, h("input", { type: "checkbox", name: "consent", required: true }),
        h("span", null, "Согласен на обработку персональных данных для связи по заявке")),
      h("div", null, h("button", { class: "btn", type: "submit" }, "Отправить заявку")));
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var f = form.elements;
      var body = { name: f.name.value, contact: f.contact.value, course_id: f.course_id.value || null,
        level: f.level.value, goal: f.goal.value, comment: f.comment.value, website: f.website.value,
        consent: f.consent.checked };
      if (!body.name.trim() || !body.contact.trim()) { status.replaceChildren(errorBox(new Error("Заполните имя и контакт для связи"))); return; }
      if (!body.consent) { status.replaceChildren(errorBox(new Error("Нужно согласие на обработку данных"))); return; }
      var btn = form.querySelector("button[type=submit]");
      btn.disabled = true;
      request("POST", "/site/v1/applications", body).then(function () {
        form.replaceWith(h("div", { class: "notice ok", role: "status" },
          "Спасибо! Заявка отправлена — менеджер школы свяжется с вами в течение рабочего дня."));
        status.textContent = "";
      }).catch(function (err) { btn.disabled = false; status.replaceChildren(errorBox(err)); });
    });
    show(h("section", null, h("h1", null, "Пробный урок"),
      h("p", { class: "muted" }, "Бесплатно: определим уровень, обсудим цель и подберём преподавателя."), status, form));
  }

  // -- доска ---------------------------------------------------------------------------
  function pageBoard(params) {
    var token = getToken();
    var boardId = params.get("id");
    var holder = h("div");
    var head = h("div", { class: "cab-head" }, h("h1", null, "Доска"));
    show(h("section", null, head, holder));
    if (!boardId || !token) {
      holder.appendChild(h("p", { class: "muted" }, token ?
        "Личная доска для заметок — сохраняется в этом браузере. Общие доски с преподавателем — в списке ниже." :
        "Личная доска для заметок и объяснений — сохраняется в этом браузере. Общая доска с преподавателем " +
        "открывается из личного кабинета."));
      var area = h("div");
      holder.appendChild(area);
      state.board = new window.SchoolBoard(area, {});
      if (token) {
        request("GET", "/site/v1/boards").then(function (res) { holder.insertBefore(boardList(res), area); })
          .catch(function () { /* без списка */ });
      }
      return;
    }
    request("GET", "/site/v1/boards/" + boardId + "/items?since=0").then(function (res) {
      head.replaceChildren(h("h1", null, res.board.title),
        h("a", { class: "btn small secondary", href: "#/board" }, "Все доски"));
      holder.appendChild(h("p", { class: "muted small" }, "Общая доска: изменения видны обоим участникам. Текст на доске " +
        "проверяется — контакты оставлять нельзя."));
      var area = h("div");
      holder.appendChild(area);
      state.board = new window.SchoolBoard(area, { remote: { boardId: boardId, request: request },
        canClear: res.role === "tutor" || res.role === "admin" });
    }).catch(function (err) { holder.appendChild(errorBox(err)); });
  }

  function boardList(res) {
    var box = h("div", { class: "card", style: null });
    box.appendChild(h("h3", null, "Общие доски"));
    if (res.boards.length) {
      box.appendChild(h("div", { class: "list" }, res.boards.map(function (b) {
        return h("div", { class: "row-item" }, h("div", null, h("strong", null, b.title), " ", h("span", { class: "meta" }, "с " + b.with)),
          h("a", { class: "btn small", href: "#/board?id=" + b.id }, "Открыть"));
      })));
    } else {
      box.appendChild(h("p", { class: "muted" }, "Досок пока нет."));
    }
    if (res.chats.length) {
      var sel = h("select", { "aria-label": "С кем доска" }, res.chats.map(function (c) { return h("option", { value: c.chat_id }, c.title); }));
      var name = h("input", { type: "text", placeholder: "Название, например «Present Perfect»", maxlength: "80", "aria-label": "Название доски" });
      var msg = h("div");
      box.appendChild(h("div", { class: "row-item", style: null }, sel, name,
        h("button", { class: "btn small", type: "button", onclick: function () {
          request("POST", "/site/v1/boards", { chat_id: sel.value, title: name.value }).then(function (b) {
            location.hash = "#/board?id=" + b.id;
          }).catch(function (err) { msg.replaceChildren(errorBox(err)); });
        } }, "Создать доску")));
      box.appendChild(msg);
    }
    return box;
  }

  // -- личный кабинет ----------------------------------------------------------------------
  function pageCabinet(params) {
    if (params.get("t")) {
      setToken(params.get("t"));
      history.replaceState(null, "", "#/cabinet");  // токен не остаётся в адресной строке и истории
    }
    var token = getToken();
    if (!token) { show(cabinetLogin()); return; }
    var section = h("section", null, h("p", { class: "muted" }, "Загружаем…"));
    show(section);
    request("GET", "/site/v1/me").then(function (me) {
      state.me = me;
      renderCabinet(section, me, params.get("tab") || "lessons");
    }).catch(function (err) {
      if (err.status === 401) { setToken(null); section.replaceWith(cabinetLogin(err.message)); return; }
      section.replaceChildren(errorBox(err));
    });
  }

  function cabinetLogin(message) {
    var bot = botUrl();
    return h("section", { class: "card" },
      h("h1", null, "Личный кабинет"),
      message ? h("div", { class: "notice warn" }, message) : null,
      h("p", null, "Вход — по личной ссылке от бота школы. Пароль не нужен."),
      list(["Откройте бота школы в Telegram", "Отправьте команду /cabinet", "Нажмите на ссылку — кабинет откроется здесь"], "clean"),
      bot ? h("a", { class: "btn", href: bot, target: "_blank", rel: "noopener" }, "Открыть бота") : null,
      h("p", { class: "muted small" }, "В кабинете: конспекты уроков, словарь с карточками, тесты, домашние задания, " +
        "отчёты для родителей и общая доска с преподавателем."));
  }

  function renderCabinet(section, me, tab) {
    var tabs = [["lessons", "Уроки"], ["words", "Словарь"], ["boards", "Доски"]];
    if (me.admin) tabs.push(["applications", "Заявки"], ["pairs", "Пары и классы"]);
    var seg = h("div", { class: "segmented", role: "tablist" });
    var body = h("div");
    function open(id) {
      history.replaceState(null, "", "#/cabinet?tab=" + id);
      Array.prototype.forEach.call(seg.children, function (b) {
        b.classList.toggle("active", b.dataset.id === id);
        b.setAttribute("aria-selected", String(b.dataset.id === id));
      });
      body.textContent = "";
      ({ lessons: tabLessons, words: tabWords, boards: tabBoards, applications: tabApplications, pairs: tabPairs }[id] || tabLessons)(body, me);
    }
    tabs.forEach(function (t) {
      seg.appendChild(h("button", { type: "button", role: "tab", "data-id": t[0], onclick: function () { open(t[0]); } }, t[1]));
    });
    section.replaceChildren(
      h("div", { class: "cab-head" }, h("h1", null, "Личный кабинет"),
        h("button", { class: "btn small secondary", type: "button", onclick: function () {
          request("POST", "/site/v1/logout", {}).catch(function () {}).then(function () {
            setToken(null); location.hash = "#/cabinet"; route();
          });
        } }, "Выйти")),
      chatsBlock(me), seg, body);
    open(tabs.some(function (t) { return t[0] === tab; }) ? tab : "lessons");
  }

  function chatsBlock(me) {
    var mine = me.chats.filter(function (c) { return c.role !== "admin"; });
    if (!mine.length) {
      return me.admin ? null : h("div", { class: "notice info" }, "Вы пока не подключены к преподавателю или ученику. " +
        "Откройте ссылку-приглашение от школы в Telegram.");
    }
    return h("div", { class: "grid cols-2", style: null }, mine.map(function (c) {
      return h("div", { class: "card" },
        h("div", { class: "row-item" }, h("h3", null, c.title), h("span", { class: "badge" }, "вы — " + c.role_ru)),
        h("div", { class: "btn-row" },
          c.classroom_url ? h("a", { class: "btn small", href: c.classroom_url, target: "_blank", rel: "noopener" }, "🎥 Войти в класс ProgressMe")
            : h("span", { class: "muted small" }, "Ссылку на класс ProgressMe добавит школа"),
          c.chat_url ? h("a", { class: "btn small secondary", href: c.chat_url, target: "_blank", rel: "noopener" }, "💬 Чат в Telegram") : null));
    }));
  }

  function tabLessons(body, me) {
    if (!me.lessons.length) { body.appendChild(h("p", { class: "muted" }, "Уроков пока нет. Материалы появятся после первого занятия.")); return; }
    body.appendChild(h("div", { class: "list" }, me.lessons.map(function (l) {
      return h("div", { class: "card row-item" },
        h("div", null, h("strong", null, l.title), h("div", { class: "meta" }, fmtDate(l.started_at) +
          (l.words ? " · новых слов: " + l.words : ""))),
        l.has_report ? h("a", { class: "btn small", href: "#/lesson/" + l.id }, l.role === "parent" ? "Отчёт" : "Конспект")
          : h("span", { class: "badge warn" }, l.status === "active" ? "идёт урок" : "готовится"));
    })));
  }

  function tabWords(body) {
    body.appendChild(h("p", { class: "muted" }, "Загружаем…"));
    request("GET", "/site/v1/words").then(function (res) {
      body.textContent = "";
      if (!res.words.length) { body.appendChild(h("p", { class: "muted" }, "Слов пока нет.")); return; }
      var filter = h("input", { type: "text", placeholder: "Поиск по словарю", "aria-label": "Поиск по словарю" });
      var grid = h("div", { class: "words" });
      function fill() {
        var q = filter.value.trim().toLowerCase();
        grid.textContent = "";
        res.words.filter(function (w) {
          return !q || (w.word + " " + (w.translation || "")).toLowerCase().indexOf(q) >= 0;
        }).forEach(function (w) { grid.appendChild(flashcard(w)); });
      }
      filter.addEventListener("input", fill);
      body.appendChild(h("p", { class: "muted small" }, "Всего слов: " + res.count + ". Нажмите на карточку, чтобы увидеть перевод."));
      body.appendChild(h("div", { style: null }, filter));
      body.appendChild(grid);
      fill();
    }).catch(function (err) { body.replaceChildren(errorBox(err)); });
  }

  function flashcard(w) {
    var front = [h("div", { class: "w" }, w.word), w.transcription ? h("div", { class: "t" }, w.transcription) : null];
    var back = [h("div", { class: "w" }, w.translation || "—"), w.example ? h("div", { class: "t small" }, w.example) : null];
    var card = h("button", { type: "button", class: "card flash", "aria-label": w.word + " — показать перевод" }, front);
    card.addEventListener("click", function () {
      var flipped = card.classList.toggle("flipped");
      card.replaceChildren.apply(card, (flipped ? back : front).filter(Boolean));
    });
    return card;
  }

  function tabBoards(body) {
    request("GET", "/site/v1/boards").then(function (res) { body.appendChild(boardList(res)); })
      .catch(function (err) { body.appendChild(errorBox(err)); });
  }

  var APP_STATUS = { "new": "новая", in_progress: "в работе", done: "обработана", rejected: "отклонена" };

  function tabApplications(body) {
    request("GET", "/site/v1/admin/applications").then(function (res) {
      if (!res.applications.length) { body.appendChild(h("p", { class: "muted" }, "Заявок пока нет.")); return; }
      body.appendChild(h("div", { class: "card table-wrap" }, h("table", { class: "data" },
        h("thead", null, h("tr", null, ["№", "Дата", "Имя", "Связь", "Направление", "Цель", "Статус"].map(function (x) { return h("th", null, x); }))),
        h("tbody", null, res.applications.map(function (a) {
          var course = courseById(a.course_id);
          var sel = h("select", { "aria-label": "Статус заявки " + a.id }, Object.keys(APP_STATUS).map(function (k) {
            return h("option", { value: k }, APP_STATUS[k]);
          }));
          sel.value = a.status;
          sel.addEventListener("change", function () {
            request("POST", "/site/v1/admin/applications/" + a.id, { status: sel.value }).catch(function (err) { alert(err.message); });
          });
          return h("tr", null, h("td", null, String(a.id)), h("td", null, fmtDate(a.created_at)), h("td", null, a.name),
            h("td", null, a.contact), h("td", null, course ? course.title : "—"),
            h("td", null, [a.level, a.goal, a.comment].filter(Boolean).join(" · ") || "—"), h("td", null, sel));
        })))));
    }).catch(function (err) { body.appendChild(errorBox(err)); });
  }

  function tabPairs(body, me) {
    var pairs = me.chats.filter(function (c) { return c.pair_id; });
    if (!pairs.length) { body.appendChild(h("p", { class: "muted" }, "Пар пока нет. Создайте пару в боте: /new_pair Преподаватель | Ученик")); return; }
    body.appendChild(h("p", { class: "muted small" }, "Ссылка на класс ProgressMe показывается преподавателю и ученику " +
      "в кабинете и приходит в Telegram в начале урока. Допускаются только ссылки на платформу уроков школы."));
    body.appendChild(h("div", { class: "list" }, pairs.map(function (c) {
      var input = h("input", { type: "url", value: c.classroom_url || "", placeholder: "https://…progressme.ru/…",
        "aria-label": "Ссылка на класс для пары " + c.pair_id });
      var msg = h("span", { class: "small" });
      return h("div", { class: "card" },
        h("div", { class: "row-item" }, h("strong", null, c.title), h("span", { class: "badge" }, "пара " + c.pair_id)),
        h("div", { class: "row-item", style: null }, input,
          h("button", { class: "btn small", type: "button", onclick: function () {
            request("POST", "/site/v1/admin/classroom", { chat_id: c.chat_id, url: input.value.trim() || null })
              .then(function () { msg.className = "small"; msg.textContent = "✅ Сохранено"; })
              .catch(function (err) { msg.className = "small"; msg.textContent = "⛔ " + err.message; });
          } }, "Сохранить"), msg));
    })));
  }

  // -- страница урока --------------------------------------------------------------------------
  function pageLesson(id) {
    if (!getToken()) { show(cabinetLogin()); return; }
    var section = h("section", null, h("p", { class: "muted" }, "Загружаем…"));
    show(section);
    request("GET", "/site/v1/lessons/" + encodeURIComponent(id)).then(function (res) {
      var back = h("p", { class: "small" }, h("a", { href: "#/cabinet" }, "← Личный кабинет"));
      if (!res.report) { section.replaceChildren(back, h("h1", null, res.title || "Урок"), h("p", { class: "muted" }, "Материалы появятся после урока.")); return; }
      if (res.role === "student") section.replaceChildren(back, studentLesson(res, id));
      else if (res.role === "parent") section.replaceChildren(back, parentLesson(res));
      else section.replaceChildren(back, h("h1", null, res.report.topic || res.title || "Урок"),
        h("p", { class: "muted" }, fmtDate(res.started_at) + " · " + res.with), h("pre", { class: "report" }, res.text));
    }).catch(function (err) { section.replaceChildren(errorBox(err)); });
  }

  function block(title, content) {
    if (!content || (Array.isArray(content) && !content.length)) return null;
    return h("div", { class: "card", style: null }, h("h3", null, title), content);
  }

  function studentLesson(res, id) {
    var r = res.report;
    var words = r.vocabulary.length ? h("div", { class: "words" }, r.vocabulary.map(flashcard)) : null;
    var hw = r.homework_teacher.concat(r.homework_generated).map(function (t) {
      return (t.source === "teacher" ? "👩‍🏫 " : "➕ ") + t.text;
    });
    return h("div", { class: "grid" },
      h("div", null, h("h1", null, r.topic || res.title || "Конспект урока"), h("p", { class: "muted" }, fmtDate(res.started_at) + " · " + res.with)),
      block("📘 Главное", [r.summary ? p(r.summary) : null, list(r.key_points)]),
      block("📐 Правила", r.rules.map(function (rule) {
        return h("div", null, h("strong", null, rule.title), p(rule.explanation), list(rule.examples));
      })),
      block("🛠 Работа над ошибками", list(r.corrections.map(function (c) {
        return h("span", null, h("s", null, c.wrong), " → ", h("strong", null, c.correct), c.note ? " — " + c.note : "");
      }))),
      block("🔁 Что повторить", list(r.review_items)),
      block("🆕 Новые слова", words),
      r.test.length ? testBlock(r.test, id) : null,
      block("📝 Домашнее задание", list(hw)));
  }

  function testBlock(test, lessonId) {
    var box = h("div", { class: "card" }, h("h3", null, "✅ Тест для самопроверки"));
    var inputs = [];
    var cards = test.map(function (q, i) {
      var card = h("div", { class: "card q" }, h("div", null, h("strong", null, (i + 1) + ". "), q.question));
      if (q.options && q.options.length) {
        var group = h("div", { class: "opts", role: "radiogroup" });
        q.options.forEach(function (o) {
          group.appendChild(h("label", null, h("input", { type: "radio", name: "q" + i, value: o }), o));
        });
        card.appendChild(group);
        inputs.push(function () { var c = group.querySelector("input:checked"); return c ? c.value : ""; });
      } else {
        var inp = h("input", { type: "text", "aria-label": "Ответ на вопрос " + (i + 1) });
        card.appendChild(h("div", { class: "opts" }, inp));
        inputs.push(function () { return inp.value; });
      }
      return card;
    });
    var result = h("div", { "aria-live": "polite" });
    var btn = h("button", { class: "btn", type: "button" }, "Проверить");
    btn.addEventListener("click", function () {
      btn.disabled = true;
      request("POST", "/site/v1/lessons/" + encodeURIComponent(lessonId) + "/test", { answers: inputs.map(function (f) { return f(); }) })
        .then(function (res) {
          res.results.forEach(function (r) {
            var card = cards[r.index];
            card.classList.remove("correct", "wrong");
            card.classList.add(r.correct ? "correct" : "wrong");
            var old = card.querySelector(".verdict");
            if (old) old.remove();
            card.appendChild(h("div", { class: "verdict" }, r.correct ? "✅ Верно" : "❌ Правильный ответ: " + r.answer,
              r.explanation ? h("div", { class: "muted" }, r.explanation) : null));
          });
          result.replaceChildren(h("div", { class: "notice " + (res.score === res.total ? "ok" : "info") },
            "Результат: " + res.score + " из " + res.total));
          btn.disabled = false;
          btn.textContent = "Проверить ещё раз";
        }).catch(function (err) { btn.disabled = false; result.replaceChildren(errorBox(err)); });
    });
    box.appendChild(h("div", null, cards));
    box.appendChild(result);
    box.appendChild(btn);
    return box;
  }

  function parentLesson(res) {
    var r = res.report, pr = r.parent;
    return h("div", { class: "grid" },
      h("div", null, h("h1", null, "Отчёт об уроке"), h("p", { class: "muted" }, fmtDate(res.started_at) +
        (pr.student_name ? " · " + pr.student_name : "") + (r.topic ? " · " + r.topic : ""))),
      block("Как прошёл урок", [pr.summary ? p(pr.summary) : null, pr.activity ? h("p", { class: "muted" }, "Активность на уроке: " + pr.activity) : null]),
      block("✅ Успехи", list(pr.achievements)),
      block("⚠️ На что обратить внимание", list(pr.attention)),
      block("💬 Замечания преподавателя", list(pr.teacher_remarks)),
      block("📝 Домашнее задание", [h("p", null, "Прошлое ДЗ: " + r.homework_status_ru), list(r.homework)]),
      block("🆕 Новые слова", r.words.length ? h("div", { class: "chips" }, r.words.map(function (w) { return h("span", { class: "chip" }, w); })) : null),
      block("💡 Как помочь дома", list(pr.recommendations)));
  }

  // -- маршрутизация -------------------------------------------------------------------
  function route() {
    var r = parseHash(), name = r.parts[0] || "home";
    var active = { course: "courses", apply: "", lesson: "cabinet" }[name];
    setActive(active === undefined ? name : active);
    loadCatalog().then(function () {
      switch (name) {
        case "home": pageHome(); break;
        case "courses": pageCourses(r.params); break;
        case "chinese": pageCourses(r.params, "chinese"); break;
        case "exams": pageExams(); break;
        case "course": pageCourse(r.parts[1]); break;
        case "how": pageHow(); break;
        case "apply": pageApply(r.params); break;
        case "board": pageBoard(r.params); break;
        case "cabinet": pageCabinet(r.params); break;
        case "lesson": pageLesson(r.parts[1]); break;
        default: show(h("section", null, h("h1", null, "Страница не найдена"), h("a", { href: "#/" }, "На главную")));
      }
      app.focus({ preventScroll: true });
    }).catch(function (err) { show(errorBox(err)); });
  }

  document.getElementById("year").textContent = String(new Date().getFullYear());
  window.addEventListener("hashchange", route);
  route();
})();
