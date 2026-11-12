// Форма заявок TLS (декабрь 2026). Механика взята из TSELINNY_EVENTS (PROTOCOL.md), плюс
// «ни одна заявка не теряется»: черновик + submissionId лежат в localStorage, пока сервер не
// подтвердит запись; автоповтор; повтор при следующем открытии страницы.
(() => {
  "use strict";

  // ---------- настройки ----------
  const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbzTGenDzHUn_dmSzgrQyjTprK217fPdjZ0UvRCClLgZNnGAKlA1Al5mjOfLKKE6qepbug/exec";   // ссылка …/exec после развёртывания Apps Script; пусто = локальный просмотр
  const CAPACITY = 12;     // показывается, пока сервер не ответил; на сервере своя константа в Code.gs
  const DATES = [          // ЗАГЛУШКИ: заменить на настоящие даты и время
    "Дата 1 (уточняется)",
    "Дата 2 (уточняется)",
    "Дата 3 (уточняется)",
    "Дата 4 (уточняется)",
  ];
  const KEY = "tls_2026dec";                // localStorage
  const RETRY_MS = [0, 2000, 5000, 10000];  // пауза перед каждой попыткой
  const TIMEOUT_MS = 25000;

  // Локальный просмотр без сервера: ?count=12 — сколько заявок «уже есть», ?fail=1 — сервер «лежит».
  const Q = new URLSearchParams(location.search);
  const MOCK = !WEBAPP_URL;

  const $ = s => document.querySelector(s);
  const form = $("#f");
  const field = n => form.querySelector(`[name="${n}"]`);
  let busy = false;

  // ---------- хранилище ----------
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (_) { return {}; } };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (_) { /* приватный режим */ } };
  let st = load();          // { sid, data, pending, sent }
  if (!st.sid) { st.sid = newId(); save(); }

  // ---------- старт ----------
  $("#dates").innerHTML = DATES.map(d =>
    `<label class="opt"><input type="checkbox" name="dates" value="${esc(d)}"> ${esc(d)}</label>`).join("");

  if (st.sent) showDone(st.sent);
  else {
    if (st.data) fill(st.data);
    if (st.pending) {
      const r = $("#resume");
      r.textContent = "Ваша прошлая заявка не успела отправиться. Отправляем её сейчас.";
      r.hidden = false;
      send();
    }
  }
  loadCount();

  form.addEventListener("input", onEdit);
  form.addEventListener("change", onEdit);
  form.addEventListener("submit", e => {
    e.preventDefault();
    if (busy) return;
    const d = collect();
    const bad = validate(d);
    form.querySelectorAll(".field").forEach(el => el.classList.toggle("bad", bad.includes(el.dataset.field)));
    if (bad.length) { form.querySelector(`[data-field="${bad[0]}"]`).scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    send();
  });
  $("#fb_retry").addEventListener("click", () => send());
  $("#again").addEventListener("click", e => {
    e.preventDefault();
    st = { sid: newId() }; save();
    form.reset(); toggleOther();
    form.querySelectorAll(".field").forEach(el => el.classList.remove("bad"));
    $("#fallback").hidden = true; setStatus(null);
    $("#done").hidden = true; form.hidden = false;
    window.scrollTo(0, 0);
    loadCount();
  });
  window.addEventListener("online", () => { if (st.pending && !st.sent) send(); });

  function onEdit(e) {
    if (e.target.id === "c_other") toggleOther();
    const f = e.target.closest(".field");
    if (f) f.classList.remove("bad");
    // Если прошлая попытка могла дойти до сервера, а человек правит заявку, — новый id:
    // лучше лишняя строка в таблице, чем потерянная правка. pending остаётся — при следующем
    // открытии страницы заявка уйдёт сама.
    if (st.pending) st.sid = newId();
    st.data = collect(); save();
  }

  // ---------- отправка ----------
  async function send() {
    if (busy) return;
    const data = collect();
    st.data = data; st.pending = true; save();
    setBusy(true);
    $("#fallback").hidden = true;
    let res = null;
    for (let i = 0; i < RETRY_MS.length && !res; i++) {
      if (i === 0) setStatus("Отправляем…");
      else {
        setStatus(`Не получилось, пробуем ещё раз (попытка ${i + 1} из ${RETRY_MS.length})…`);
        await sleep(RETRY_MS[i]);
      }
      res = await attempt({ v: 1, action: "submit", submissionId: st.sid, data });
    }
    setBusy(false);
    if (res) {
      st.pending = false; st.sent = res; save();
      showDone(res);
    } else {
      setStatus("Заявка пока не отправилась.", true);
      $("#fallback").hidden = false;
    }
  }

  async function attempt(msg) {
    if (MOCK) {
      await sleep(600);
      if (Q.has("fail")) return null;
      const pos = mockCount() + 1;
      return { ok: true, n: pos, pos, waitlist: pos > CAPACITY, count: pos, capacity: CAPACITY };
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const r = await fetch(WEBAPP_URL, {
        method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(msg), signal: ctrl.signal,
      });
      const j = await r.json();
      return j && j.ok ? j : null;   // любой отказ сервера = повторить
    } catch (_) {
      return null;
    } finally {
      clearTimeout(t);
    }
  }

  async function loadCount() {
    let c = null, cap = CAPACITY;
    if (MOCK) c = mockCount();
    else {
      try {
        const j = await (await fetch(WEBAPP_URL)).json();
        if (j && j.ok) { c = j.count; cap = j.capacity || cap; }
      } catch (_) { /* без счётчика */ }
    }
    let s = `Ориентировочно ${cap} ${plural(cap, ["место", "места", "мест"])}`;
    if (c != null) s += `, ${c} ${plural(c, ["заявка уже отправлена", "заявки уже отправлены", "заявок уже отправлено"])}`;
    s += ". First come, first served.";
    if (c != null && c >= cap) s += " Но вы всё равно отправьте заявку, вдруг место освободится.";
    $("#seats").textContent = s;
  }

  // ---------- данные ----------
  function collect() {
    const checked = n => [...form.querySelectorAll(`input[name="${n}"]:checked`)].map(i => i.value);
    const otherOn = $("#c_other").checked;
    return {
      name: field("name").value.trim(),
      frame: field("frame").value.trim(),
      carriers: checked("carriers").filter(v => v !== "другое"),
      otherOn,
      carrierOther: otherOn ? field("carrierOther").value.trim() : "",
      dates: checked("dates"),
      comment: field("comment").value.trim(),
    };
  }

  function fill(d) {
    field("name").value = d.name || "";
    field("frame").value = d.frame || "";
    field("comment").value = d.comment || "";
    field("carrierOther").value = d.carrierOther || "";
    form.querySelectorAll('input[name="carriers"]').forEach(i => {
      i.checked = i.value === "другое" ? !!d.otherOn : (d.carriers || []).includes(i.value);
    });
    form.querySelectorAll('input[name="dates"]').forEach(i => { i.checked = (d.dates || []).includes(i.value); });
    toggleOther();
  }

  function validate(d) {
    const bad = [];
    if (!d.name) bad.push("name");
    if (!d.frame) bad.push("frame");
    if ((!d.carriers.length && !d.otherOn) || (d.otherOn && !d.carrierOther)) bad.push("carriers");
    if (!d.dates.length) bad.push("dates");
    return bad;
  }

  // ---------- интерфейс ----------
  function showDone(res) {
    const cap = res.capacity || CAPACITY;
    form.hidden = true;
    $("#resume").hidden = true;
    $("#done").hidden = false;
    $("#done_text").textContent = res.waitlist
      ? `Все ${cap} мест уже заняты, ваш номер в очереди: ${res.pos}. Если место освободится, Влад напишет.`
      : `Ваш номер в очереди: ${res.pos} из ${cap}.`;
  }

  function toggleOther() {
    const on = $("#c_other").checked;
    $("#c_other_text").hidden = !on;
  }

  function setBusy(on) {
    busy = on;
    for (const el of form.elements) el.disabled = on;
  }

  function setStatus(text, bad) {
    const p = $("#status");
    p.hidden = !text;
    p.textContent = text || "";
    p.classList.toggle("bad", !!bad);
  }

  // ---------- мелочи ----------
  function mockCount() { const c = Number(Q.get("count")); return Number.isFinite(c) && Q.has("count") ? c : 3; }
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  function newId() {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, "0")).join("");
  }
  function plural(n, f) {
    const a = Math.abs(n) % 100, b = a % 10;
    return a > 10 && a < 20 ? f[2] : b === 1 ? f[0] : b >= 2 && b <= 4 ? f[1] : f[2];
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  }
})();
