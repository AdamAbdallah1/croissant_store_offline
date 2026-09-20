const KEY = "croissant_store_records_v2";
const SETTINGS_KEY = "croissant_store_settings_v2";

const DEFAULTS = {
  factoryName: "سجل المصنع",
  boxSize: 40
};

let records = loadRecords();
let settings = loadSettings();

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function saveRecords() {
  localStorage.setItem(KEY, JSON.stringify(records));
}

function loadSettings() {
  try {
    return {
      ...DEFAULTS,
      ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDate(iso) {
  return new Intl.DateTimeFormat("ar-LB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(iso));
}

function formatTime(iso) {
  return new Intl.DateTimeFormat("ar-LB", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(iso));
}

function money(value) {
  if (value === "" || value == null) return "";
  return Number(value).toLocaleString("en-US", {
    maximumFractionDigits: 2
  });
}

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");

  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => {
    el.classList.remove("show");
  }, 2200);
}

function navigate(view) {
  $$(".view").forEach(el => {
    el.classList.toggle("active", el.id === `view-${view}`);
  });

  $$(".nav-item").forEach(el => {
    el.classList.toggle("active", el.dataset.nav === view);
  });

  if (view === "home") renderHome();
  if (view === "records") renderRecords();
  if (view === "reports") renderReportPreview();
  if (view === "settings") loadSettingsForm();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

$$("[data-nav]").forEach(button => {
  button.addEventListener("click", () => navigate(button.dataset.nav));
});

/* ---------------- NEW RECORD ---------------- */

function partialValues() {
  return $$("#partials input").map(input =>
    Math.max(0, Number(input.value) || 0)
  );
}

function calculateTotal() {
  const full = Math.max(0, Number($("#fullBoxes").value) || 0);

  const partial = partialValues().reduce(
    (sum, value) => sum + value,
    0
  );

  const total = full * settings.boxSize + partial;

  $("#totalPieces").textContent =
    total.toLocaleString("ar-LB");

  $("#boxSizeLabel").textContent = settings.boxSize;

  return { full, partial, total };
}

function addPartial(value = "") {
  const row = document.createElement("div");
  row.className = "partial-row";

  row.innerHTML = `
    <input
      type="number"
      min="1"
      max="${settings.boxSize - 1}"
      step="1"
      inputmode="numeric"
      placeholder="عدد الحبات"
      value="${esc(value)}"
    >

    <button
      type="button"
      class="remove-partial"
      aria-label="حذف"
    >×</button>
  `;

  row.querySelector("input")
    .addEventListener("input", calculateTotal);

  row.querySelector(".remove-partial")
    .addEventListener("click", () => {
      row.remove();
      calculateTotal();
    });

  $("#partials").appendChild(row);

  setTimeout(() => row.querySelector("input").focus(), 50);
}

$("#addPartialBtn").addEventListener("click", () => addPartial());

$("#fullBoxes").addEventListener("input", calculateTotal);

/* CUSTOMER / HALL */

function updatePartyType() {
  const type = $('input[name="type"]:checked').value;
  const isHall = type === "hall";

  $("#customerNameField").hidden = isHall;
  $("#hallSelected").hidden = !isHall;
  $("#paymentSection").hidden = isHall;

  if (isHall) {
    $("#partyName").value = "صالة";
    $("#partyName").removeAttribute("required");
  } else {
    $("#partyName").value = "";
    $("#partyName").setAttribute("required", "");
  }
}

$$('input[name="type"]').forEach(input => {
  input.addEventListener("change", updatePartyType);
});

$$('input[name="payment"]').forEach(input => {
  input.addEventListener("change", () => {
    $("#amountField").hidden =
      $('input[name="payment"]:checked').value === "unpaid";
  });
});

/* SAVE */

$("#recordForm").addEventListener("submit", event => {
  event.preventDefault();

  const type = $('input[name="type"]:checked').value;

  const partyName =
    type === "hall"
      ? "صالة"
      : $("#partyName").value.trim();

  if (type === "customer" && !partyName) {
    toast("أدخل اسم الزبون");
    $("#partyName").focus();
    return;
  }

  const calc = calculateTotal();

  if (calc.total <= 0) {
    toast("أدخل كمية المنتجات");
    return;
  }

  const partials = partialValues().filter(v => v > 0);

  if (partials.some(v => v >= settings.boxSize)) {
    toast(`الصندوق الناقص أقل من ${settings.boxSize} حبة`);
    return;
  }

  const payment =
    type === "customer"
      ? $('input[name="payment"]:checked').value
      : null;

  const amount =
    type === "customer" && payment !== "unpaid"
      ? $("#amount").value
      : "";

  const record = {
    id: crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`,

    createdAt: new Date().toISOString(),

    type,
    partyName,

    fullBoxes: calc.full,
    partials,
    total: calc.total,

    payment,
    amount,

    notes: $("#notes").value.trim()
  };

  records.unshift(record);
  saveRecords();

  toast("تم حفظ العملية");

  resetForm();
  navigate("home");
});

function resetForm() {
  $("#recordForm").reset();

  $("#partials").innerHTML = "";
  $("#fullBoxes").value = 0;
  $("#amount").value = "";
  $("#notes").value = "";

  $('input[name="type"][value="customer"]').checked = true;
  $('input[name="payment"][value="cash"]').checked = true;

  updatePartyType();

  $("#amountField").hidden = false;

  calculateTotal();
}

/* ---------------- RECORD DISPLAY ---------------- */

function detailsText(record) {
  const full = record.fullBoxes
    ? `${record.fullBoxes} × ${settings.boxSize}`
    : "";

  const partial = record.partials?.length
    ? record.partials.join(" + ")
    : "";

  return [full, partial].filter(Boolean).join(" + ") || "—";
}

function paymentText(payment) {
  if (payment === "cash") return "نقداً";
  if (payment === "whish") return "Whish Money";
  if (payment === "unpaid") return "غير مدفوع";
  return "—";
}

function card(record) {
  return `
    <article class="record-card">

      <div class="record-top">

        <div>
          <div class="record-name">
            ${esc(record.partyName)}
            <span class="pill">
              ${record.type === "customer" ? "زبون" : "صالة"}
            </span>
          </div>

          <div class="record-meta">
            ${formatDate(record.createdAt)}
            ·
            ${formatTime(record.createdAt)}
          </div>
        </div>

        <div class="record-total">
          ${record.total.toLocaleString("ar-LB")}
          <small>حبة</small>
        </div>

      </div>

      <div class="record-details">

        <div>
          <b>الكمية:</b>
          ${esc(detailsText(record))}
        </div>

        ${
          record.type === "customer"
            ? `
              <div>
                <b>الدفع:</b>
                ${paymentText(record.payment)}
                ${
                  record.amount
                    ? ` · ${money(record.amount)}`
                    : ""
                }
              </div>
            `
            : ""
        }

        ${
          record.notes
            ? `
              <div class="note-line">
                <b>ملاحظات:</b>
                ${esc(record.notes)}
              </div>
            `
            : ""
        }

        <button
          type="button"
          class="delete-record"
          data-delete-id="${esc(record.id)}"
        >
          حذف العملية
        </button>

      </div>
    </article>
  `;
}

/* ---------------- HOME ---------------- */

function renderHome() {
  const today = todayKey();

  const list = records.filter(
    record => record.createdAt.slice(0, 10) === today
  );

  $("#todayLabel").textContent =
    new Intl.DateTimeFormat("ar-LB", {
      weekday: "long",
      day: "numeric",
      month: "long"
    }).format(new Date());

  $("#todayTotal").textContent =
    list.reduce((sum, record) => sum + record.total, 0)
      .toLocaleString("ar-LB");

  $("#todayCount").textContent =
    list.length.toLocaleString("ar-LB");

  $("#todayCustomers").textContent =
    list.filter(r => r.type === "customer").length
      .toLocaleString("ar-LB");

  $("#todayHalls").textContent =
    list.filter(r => r.type === "hall").length
      .toLocaleString("ar-LB");

  $("#recentRecords").innerHTML =
    list.slice(0, 5).map(card).join("") ||
    `<div class="empty">لا توجد عمليات اليوم.</div>`;
}

/* ---------------- SEARCH ---------------- */

function renderRecords() {
  const query = $("#searchInput").value
    .trim()
    .toLowerCase();

  const type = $("#typeFilter").value;
  const date = $("#dateFilter").value;

  const list = records.filter(record => {

    const matchesSearch =
      !query ||
      record.partyName.toLowerCase().includes(query) ||
      (record.notes || "").toLowerCase().includes(query);

    const matchesType =
      type === "all" || record.type === type;

    const matchesDate =
      !date ||
      record.createdAt.slice(0, 10) === date;

    return matchesSearch && matchesType && matchesDate;
  });

  $("#recordsList").innerHTML =
    list.map(card).join("") ||
    `<div class="empty">لا توجد نتائج.</div>`;
}

$("#searchInput").addEventListener("input", renderRecords);
$("#typeFilter").addEventListener("change", renderRecords);
$("#dateFilter").addEventListener("change", renderRecords);

/* ---------------- DELETE ---------------- */

document.addEventListener("click", event => {

  const button =
    event.target.closest("[data-delete-id]");

  if (!button) return;

  const record =
    records.find(r => r.id === button.dataset.deleteId);

  if (!record) return;

  const confirmed = confirm(
    `حذف عملية ${record.partyName} — ${record.total} حبة؟\n\nلا يمكن التراجع عن هذا الحذف.`
  );

  if (!confirmed) return;

  records = records.filter(
    r => r.id !== record.id
  );

  saveRecords();

  renderHome();
  renderRecords();
  renderReportPreview();

  toast("تم حذف العملية");
});

/* ---------------- REPORT ---------------- */

function filteredReport(from, to, type) {
  return records.filter(record => {

    const date = record.createdAt.slice(0, 10);

    return (
      (!from || date >= from) &&
      (!to || date <= to) &&
      (type === "all" || record.type === type)
    );
  });
}

function renderReportPreview() {

  const from = $("#fromDate").value;
  const to = $("#toDate").value;
  const type = $("#reportType").value;

  const list = filteredReport(from, to, type);

  const total = list.reduce(
    (sum, record) => sum + record.total,
    0
  );

  $("#reportPreview").innerHTML = `
    <h3>${esc(settings.factoryName)}</h3>

    <div class="record-meta">
      ${from || "—"} إلى ${to || "—"}
    </div>

    <table class="report-table">

      <thead>
        <tr>
          <th>التاريخ</th>
          <th>الجهة</th>
          <th>النوع</th>
          <th>الكمية</th>
          <th>الدفع</th>
        </tr>
      </thead>

      <tbody>

        ${
          list.map(record => `
            <tr>
              <td>${formatDate(record.createdAt)}</td>
              <td>${esc(record.partyName)}</td>
              <td>${record.type === "customer" ? "زبون" : "صالة"}</td>
              <td>${record.total}</td>
              <td>
                ${
                  record.type === "customer"
                    ? paymentText(record.payment)
                    : "—"
                }
              </td>
            </tr>
          `).join("")
          ||
          `<tr><td colspan="5">لا توجد عمليات.</td></tr>`
        }

      </tbody>

    </table>

    <div class="report-summary">
      إجمالي العمليات: ${list.length}
      ·
      إجمالي الحبات: ${total.toLocaleString("ar-LB")}
    </div>
  `;
}

$("#fromDate").value =
  todayKey(new Date(Date.now() - 30 * 86400000));

$("#toDate").value = todayKey();

$("#fromDate").addEventListener("change", renderReportPreview);
$("#toDate").addEventListener("change", renderReportPreview);
$("#reportType").addEventListener("change", renderReportPreview);

$("#printReport").addEventListener("click", () => {
  renderReportPreview();
  setTimeout(() => window.print(), 100);
});

/* ---------------- SETTINGS ---------------- */

function loadSettingsForm() {
  $("#factoryName").value = settings.factoryName;
  $("#defaultBoxSize").value = settings.boxSize;
}

$("#saveSettings").addEventListener("click", () => {

  const box =
    Math.max(
      1,
      Number($("#defaultBoxSize").value) || 40
    );

  settings = {
    factoryName:
      $("#factoryName").value.trim() || "سجل المصنع",

    boxSize: box
  };

  saveSettings();

  $("#boxSizeLabel").textContent = box;

  toast("تم حفظ الإعدادات");
  calculateTotal();
  renderHome();
});

$("#clearData").addEventListener("click", () => {

  if (!confirm(
    "هل أنت متأكد؟ سيتم حذف جميع العمليات نهائياً من هذا الجهاز."
  )) return;

  records = [];
  saveRecords();

  renderHome();
  renderRecords();
  renderReportPreview();

  toast("تم حذف العمليات");
});

/* ---------------- PWA ---------------- */

let deferredPrompt = null;

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();

  deferredPrompt = event;
  $("#installBtn").hidden = false;
});

$("#installBtn").addEventListener("click", async () => {

  if (!deferredPrompt) return;

  deferredPrompt.prompt();

  await deferredPrompt.userChoice;

  deferredPrompt = null;
  $("#installBtn").hidden = true;
});

if (
  "serviceWorker" in navigator &&
  location.protocol === "https:"
) {
  navigator.serviceWorker
    .register("./sw.js")
    .catch(console.error);
}

/* ---------------- START ---------------- */

loadSettingsForm();
updatePartyType();
calculateTotal();
renderHome();
