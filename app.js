const KEY = "croissant_store_records_v3";
const SETTINGS_KEY = "croissant_store_settings_v3";

const DEFAULTS = {
  factoryName: "سجل المصنع",
  boxSize: 40
};

let records = loadRecords();
let settings = loadSettings();

let selectedDate = todayKey();
let editingId = null;

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function loadRecords() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || "[]");

    return data.map(record => ({
      ...record,
      businessDate:
        record.businessDate ||
        (record.createdAt ? record.createdAt.slice(0, 10) : todayKey()),
      boxSize: record.boxSize || DEFAULTS.boxSize
    }));
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

function formatBusinessDate(date) {
  return new Intl.DateTimeFormat("ar-LB", {
    weekday: "long",
    day: "numeric",
    month: "numeric",
    year: "numeric"
  }).format(new Date(`${date}T12:00:00`));
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat("ar-LB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(`${date}T12:00:00`));
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

/* =========================
   DAY NAVIGATION
========================= */

function changeDay(amount) {
  const date = new Date(`${selectedDate}T12:00:00`);
  date.setDate(date.getDate() + amount);

  selectedDate = todayKey(date);

  renderHome();
  renderRecords();
}

function setSelectedDate(date) {
  if (!date) return;

  selectedDate = date;

  renderHome();
  renderRecords();
}

$("#previousDay").addEventListener("click", () => changeDay(-1));
$("#nextDay").addEventListener("click", () => changeDay(1));

$("#selectedDate").addEventListener("change", event => {
  setSelectedDate(event.target.value);
});

$("#goToday").addEventListener("click", () => {
  selectedDate = todayKey();
  renderHome();
  renderRecords();
});

/* =========================
   NEW / EDIT RECORD
========================= */

function partialValues() {
  return $$("#partials input").map(input =>
    Math.max(0, Number(input.value) || 0)
  );
}

function calculateTotal() {
  const full = Math.max(
    0,
    Number($("#fullBoxes").value) || 0
  );

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
}

$("#addPartialBtn").addEventListener("click", () => {
  addPartial();
});

$("#fullBoxes").addEventListener("input", calculateTotal);

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
    if (!editingId) {
      $("#partyName").value = "";
    }

    $("#partyName").setAttribute("required", "");
  }

  const payment =
    $('input[name="payment"]:checked')?.value || "cash";

  $("#amountField").hidden = payment === "unpaid";
}

$$('input[name="type"]').forEach(input => {
  input.addEventListener("change", updatePartyType);
});

$$('input[name="payment"]').forEach(input => {
  input.addEventListener("change", () => {
    $("#amountField").hidden =
      input.value === "unpaid";
  });
});

function openNewRecord() {
  editingId = null;

  $("#formTitle").textContent = "تسجيل خروج";
  $("#formEyebrow").textContent = "عملية جديدة";
  $("#saveRecordBtn").textContent = "حفظ العملية";

  resetForm();
  navigate("new");
}

function openEditRecord(id) {
  const record = records.find(r => r.id === id);

  if (!record) return;

  editingId = id;
  selectedDate = record.businessDate;

  $("#formTitle").textContent = "تعديل العملية";
  $("#formEyebrow").textContent = "تعديل محفوظ";
  $("#saveRecordBtn").textContent = "حفظ التعديل";

  $('input[name="type"][value="customer"]').checked =
    record.type === "customer";

  $('input[name="type"][value="hall"]').checked =
    record.type === "hall";

  $("#partyName").value =
    record.type === "hall" ? "صالة" : record.partyName;

  $("#fullBoxes").value = record.fullBoxes || 0;

  $("#partials").innerHTML = "";

  (record.partials || []).forEach(value => {
    addPartial(value);
  });

  if (record.payment) {
    const payment =
      $(`input[name="payment"][value="${record.payment}"]`);

    if (payment) payment.checked = true;
  }

  $("#amount").value = record.amount || "";
  $("#notes").value = record.notes || "";

  updatePartyType();
  calculateTotal();

  navigate("new");
}

$("#recordForm").addEventListener("submit", event => {
  event.preventDefault();

  const type =
    $('input[name="type"]:checked').value;

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

  const partials =
    partialValues().filter(v => v > 0);

  if (partials.some(v => v >= settings.boxSize)) {
    toast(
      `الصندوق الناقص يجب أن يكون أقل من ${settings.boxSize} حبة`
    );
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

  if (editingId) {
    const record =
      records.find(r => r.id === editingId);

    if (!record) return;

    record.businessDate = selectedDate;
    record.type = type;
    record.partyName = partyName;
    record.fullBoxes = calc.full;
    record.partials = partials;
    record.total = calc.total;
    record.boxSize = settings.boxSize;
    record.payment = payment;
    record.amount = amount;
    record.notes = $("#notes").value.trim();
    record.updatedAt = new Date().toISOString();

    toast("تم تعديل العملية");
  } else {
    records.unshift({
      id: window.crypto?.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,

      businessDate: selectedDate,
      createdAt: new Date().toISOString(),

      type,
      partyName,

      fullBoxes: calc.full,
      partials,
      total: calc.total,
      boxSize: settings.boxSize,

      payment,
      amount,

      notes: $("#notes").value.trim()
    });

    toast("تم حفظ العملية");
  }

  saveRecords();

  editingId = null;
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

  $("#formTitle").textContent = "تسجيل خروج";
  $("#formEyebrow").textContent = "عملية جديدة";
  $("#saveRecordBtn").textContent = "حفظ العملية";

  calculateTotal();
}

$$("[data-new-record]").forEach(button => {
  button.addEventListener("click", openNewRecord);
});

/* =========================
   RECORD DISPLAY
========================= */

function detailsText(record) {
  const boxSize =
    record.boxSize || settings.boxSize;

  const full = record.fullBoxes
    ? `${record.fullBoxes} × ${boxSize}`
    : "";

  const partial =
    record.partials?.length
      ? record.partials.join(" + ")
      : "";

  return (
    [full, partial]
      .filter(Boolean)
      .join(" + ") || "—"
  );
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
              ${
                record.type === "customer"
                  ? "زبون"
                  : "صالة"
              }
            </span>
          </div>

          <div class="record-meta">
            ${formatTime(record.createdAt)}
            ·
            ${formatShortDate(record.businessDate)}
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

        <div class="record-actions">

          <button
            type="button"
            class="edit-record"
            data-edit-id="${esc(record.id)}"
          >
            تعديل
          </button>

          <button
            type="button"
            class="delete-record"
            data-delete-id="${esc(record.id)}"
          >
            حذف
          </button>

        </div>

      </div>
    </article>
  `;
}

/* =========================
   HOME / SELECTED DAY
========================= */

function dayRecords(date = selectedDate) {
  return records
    .filter(record => record.businessDate === date)
    .sort((a, b) =>
      new Date(b.createdAt) -
      new Date(a.createdAt)
    );
}

function renderHome() {
  const list = dayRecords();

  $("#selectedDate").value = selectedDate;

  $("#dayLabel").textContent =
    formatBusinessDate(selectedDate);

  $("#todayTotal").textContent =
    list
      .reduce((sum, record) => sum + record.total, 0)
      .toLocaleString("ar-LB");

  $("#todayCount").textContent =
    list.length.toLocaleString("ar-LB");

  $("#todayCustomers").textContent =
    list
      .filter(r => r.type === "customer")
      .length
      .toLocaleString("ar-LB");

  $("#todayHalls").textContent =
    list
      .filter(r => r.type === "hall")
      .length
      .toLocaleString("ar-LB");

  $("#recentRecords").innerHTML =
    list.slice(0, 5).map(card).join("") ||
    `<div class="empty">لا توجد عمليات في هذا اليوم.</div>`;
}

/* =========================
   RECORDS
========================= */

function renderRecords() {
  const query =
    $("#searchInput").value.trim().toLowerCase();

  const type = $("#typeFilter").value;

  const list = dayRecords().filter(record => {
    const matchesSearch =
      !query ||
      record.partyName
        .toLowerCase()
        .includes(query) ||
      (record.notes || "")
        .toLowerCase()
        .includes(query);

    const matchesType =
      type === "all" ||
      record.type === type;

    return matchesSearch && matchesType;
  });

  $("#recordsDateLabel").textContent =
    formatBusinessDate(selectedDate);

  $("#recordsList").innerHTML =
    list.map(card).join("") ||
    `<div class="empty">لا توجد نتائج لهذا اليوم.</div>`;
}

$("#searchInput").addEventListener(
  "input",
  renderRecords
);

$("#typeFilter").addEventListener(
  "change",
  renderRecords
);

/* =========================
   EDIT / DELETE
========================= */

document.addEventListener("click", event => {
  const editButton =
    event.target.closest("[data-edit-id]");

  if (editButton) {
    openEditRecord(editButton.dataset.editId);
    return;
  }

  const deleteButton =
    event.target.closest("[data-delete-id]");

  if (!deleteButton) return;

  const record =
    records.find(
      r => r.id === deleteButton.dataset.deleteId
    );

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

/* =========================
   REPORTS
========================= */

function filteredReport(from, to, type) {
  return records
    .filter(record => {
      const date = record.businessDate;

      return (
        (!from || date >= from) &&
        (!to || date <= to) &&
        (type === "all" || record.type === type)
      );
    })
    .sort((a, b) =>
      a.businessDate.localeCompare(b.businessDate) ||
      new Date(a.createdAt) - new Date(b.createdAt)
    );
}

function setDailyReport() {
  $("#fromDate").value = selectedDate;
  $("#toDate").value = selectedDate;
  renderReportPreview();
}

function renderReportPreview() {
  const from = $("#fromDate").value;
  const to = $("#toDate").value;
  const type = $("#reportType").value;

  const list =
    filteredReport(from, to, type);

  const total =
    list.reduce(
      (sum, record) => sum + record.total,
      0
    );

  const customers =
    list.filter(r => r.type === "customer");

  const halls =
    list.filter(r => r.type === "hall");

  const customerTotal =
    customers.reduce(
      (sum, record) => sum + record.total,
      0
    );

  const hallTotal =
    halls.reduce(
      (sum, record) => sum + record.total,
      0
    );

  const title =
    from && to && from === to
      ? "تقرير يومي"
      : "تقرير فترة";

  $("#reportPreview").innerHTML = `
    <div class="print-header">

      <h2>${esc(settings.factoryName)}</h2>

      <h3>${title}</h3>

      <p>
        ${
          from && to && from === to
            ? formatBusinessDate(from)
            : `${formatShortDate(from)} — ${formatShortDate(to)}`
        }
      </p>

    </div>

    <div class="report-summary-grid">

      <div>
        <span>العمليات</span>
        <strong>${list.length}</strong>
      </div>

      <div>
        <span>إجمالي الحبات</span>
        <strong>${total.toLocaleString("ar-LB")}</strong>
      </div>

      <div>
        <span>الزبائن</span>
        <strong>${customerTotal.toLocaleString("ar-LB")}</strong>
      </div>

      <div>
        <span>الصالة</span>
        <strong>${hallTotal.toLocaleString("ar-LB")}</strong>
      </div>

    </div>

    <table class="report-table">

      <thead>
        <tr>
          <th>التاريخ</th>
          <th>الجهة</th>
          <th>النوع</th>
          <th>الكمية</th>
          <th>الدفع</th>
          <th>ملاحظات</th>
        </tr>
      </thead>

      <tbody>

        ${
          list.map(record => `
            <tr>

              <td>
                ${formatShortDate(record.businessDate)}
              </td>

              <td>
                ${esc(record.partyName)}
              </td>

              <td>
                ${
                  record.type === "customer"
                    ? "زبون"
                    : "صالة"
                }
              </td>

              <td>
                ${record.total.toLocaleString("ar-LB")}
              </td>

              <td>
                ${
                  record.type === "customer"
                    ? paymentText(record.payment)
                    : "—"
                }
              </td>

              <td>
                ${esc(record.notes || "—")}
              </td>

            </tr>
          `).join("")
          ||
          `<tr>
            <td colspan="6">
              لا توجد عمليات.
            </td>
          </tr>`
        }

      </tbody>

    </table>

    <div class="report-footer">
      إجمالي الحبات:
      <strong>${total.toLocaleString("ar-LB")}</strong>
    </div>
  `;
}

$("#dailyReport").addEventListener(
  "click",
  setDailyReport
);

$("#fromDate").addEventListener(
  "change",
  renderReportPreview
);

$("#toDate").addEventListener(
  "change",
  renderReportPreview
);

$("#reportType").addEventListener(
  "change",
  renderReportPreview
);

$("#printReport").addEventListener(
  "click",
  () => {
    renderReportPreview();

    setTimeout(() => {
      window.print();
    }, 100);
  }
);

/* =========================
   SETTINGS
========================= */

function loadSettingsForm() {
  $("#factoryName").value =
    settings.factoryName;

  $("#defaultBoxSize").value =
    settings.boxSize;
}

$("#saveSettings").addEventListener(
  "click",
  () => {
    const box = Math.max(
      1,
      Number($("#defaultBoxSize").value) || 40
    );

    settings = {
      factoryName:
        $("#factoryName").value.trim() ||
        "سجل المصنع",

      boxSize: box
    };

    saveSettings();

    toast("تم حفظ الإعدادات");

    calculateTotal();
    renderHome();
  }
);

$("#clearData").addEventListener(
  "click",
  () => {
    if (
      !confirm(
        "هل أنت متأكد؟ سيتم حذف جميع العمليات نهائياً من هذا الجهاز."
      )
    ) {
      return;
    }

    records = [];
    saveRecords();

    renderHome();
    renderRecords();
    renderReportPreview();

    toast("تم حذف جميع العمليات");
  }
);

/* =========================
   PWA
========================= */

let deferredPrompt = null;

window.addEventListener(
  "beforeinstallprompt",
  event => {
    event.preventDefault();
    deferredPrompt = event;
    $("#installBtn").hidden = false;
  }
);

$("#installBtn").addEventListener(
  "click",
  async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();

    await deferredPrompt.userChoice;

    deferredPrompt = null;
    $("#installBtn").hidden = true;
  }
);

if (
  "serviceWorker" in navigator &&
  location.protocol === "https:"
) {
  navigator.serviceWorker
    .register("./sw.js")
    .catch(console.error);
}

/* =========================
   START
========================= */

$("#fromDate").value = selectedDate;
$("#toDate").value = selectedDate;

loadSettingsForm();
updatePartyType();
calculateTotal();
renderHome();
renderRecords();
renderReportPreview();