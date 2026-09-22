const KEY = "croissant_store_records_v5";
const SETTINGS_KEY = "croissant_store_settings_v5";

const DEFAULTS = {
  factoryName: "سجل المصنع",
  products: [
    {
      id: "croissant",
      name: "كرواسون",
      group: "croissant",
      boxSize: 40,
      types: [
        { id: "cheese", name: "جبنة" },
        { id: "chocolate", name: "شوكولا" },
        { id: "zaatar", name: "زعتر" }
      ]
    },
    {
      id: "donut",
      name: "دونات",
      group: "donut",
      boxSize: 8,
      types: [
        { id: "donut", name: "دونات" }
      ]
    }
  ]
};

let records = loadRecords();
let settings = loadSettings();
let selectedDate = todayKey();
let editingId = null;

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

/* =========================
   BASIC
========================= */

function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function uid(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[c]));
}

function toast(message) {
  const el = $("#toast");
  if (!el) return;

  el.textContent = message;
  el.classList.add("show");
  clearTimeout(window.toastTimer);

  window.toastTimer = setTimeout(
    () => el.classList.remove("show"),
    2300
  );
}

function money(value) {
  if (value === "" || value == null) return "";
  return Number(value).toLocaleString("en-US", {
    maximumFractionDigits: 2
  });
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
  if (!date) return "—";

  return new Intl.DateTimeFormat("ar-LB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(`${date}T12:00:00`));
}

function formatTime(date) {
  if (!date) return "—";

  return new Intl.DateTimeFormat("ar-LB", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(date));
}

/* =========================
   STORAGE
========================= */

function cloneDefaults() {
  return {
    factoryName: DEFAULTS.factoryName,
    products: DEFAULTS.products.map(p => ({
      ...p,
      types: p.types.map(t => ({ ...t }))
    }))
  };
}

function loadSettings() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(SETTINGS_KEY) || "null"
    );

    if (!saved) return cloneDefaults();

    const defaults = cloneDefaults();

    return {
      factoryName: saved.factoryName || defaults.factoryName,
      products: Array.isArray(saved.products) && saved.products.length
        ? saved.products
        : defaults.products
    };
  } catch {
    return cloneDefaults();
  }
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function normalizeRecord(record) {
  return {
    ...record,
    businessDate:
      record.businessDate ||
      (record.createdAt
        ? record.createdAt.slice(0, 10)
        : todayKey()),
    boxes: Array.isArray(record.boxes) ? record.boxes : [],
    loose: Array.isArray(record.loose) ? record.loose : [],
    total: Number(record.total) || 0
  };
}

function migrateOldRecord(record) {
  if (Array.isArray(record.boxes)) {
    return normalizeRecord(record);
  }

  const boxes = [];
  const size = Number(record.boxSize) || 40;
  const full = Number(record.fullBoxes) || 0;
  const partials = Array.isArray(record.partials)
    ? record.partials
    : [];

  for (let i = 0; i < full; i++) {
    boxes.push({
      id: uid("box"),
      productId: "croissant",
      boxSize: size,
      items: [{ typeId: "legacy", quantity: size }],
      total: size
    });
  }

  partials.forEach(qty => {
    if (Number(qty) > 0) {
      boxes.push({
        id: uid("box"),
        productId: "croissant",
        boxSize: size,
        items: [{ typeId: "legacy", quantity: Number(qty) }],
        total: Number(qty)
      });
    }
  });

  return normalizeRecord({
    ...record,
    boxes,
    loose: [],
    total: Number(record.total) || 0,
    legacy: true
  });
}

function loadRecords() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(KEY) || "null"
    );

    if (Array.isArray(saved)) {
      return saved.map(normalizeRecord);
    }

    /* Import the previous v4 structure if it exists. */
    const old = JSON.parse(
      localStorage.getItem("croissant_store_records_v4") || "[]"
    );

    if (Array.isArray(old) && old.length) {
      const migrated = old.map(migrateOldRecord);
      localStorage.setItem(KEY, JSON.stringify(migrated));
      return migrated;
    }

    return [];
  } catch {
    return [];
  }
}

function saveRecords() {
  localStorage.setItem(KEY, JSON.stringify(records));
}

/* =========================
   PRODUCTS
========================= */

function productById(id) {
  return settings.products.find(p => p.id === id) || null;
}

function productName(id) {
  return productById(id)?.name || "غير محدد";
}

function productSize(id) {
  return Number(productById(id)?.boxSize) || 40;
}

function productTypes(id) {
  return productById(id)?.types || [];
}

function typeName(productId, typeId) {
  const type = productTypes(productId).find(t => t.id === typeId);
  return type?.name || (typeId === "legacy" ? "قديم / غير محدد" : "غير محدد");
}

function productOptions(selected = "") {
  return settings.products.map(p => `
    <option value="${esc(p.id)}" ${p.id === selected ? "selected" : ""}>
      ${esc(p.name)} — ${p.boxSize} حبة
    </option>
  `).join("");
}

/* =========================
   NAVIGATION
========================= */

function navigate(view) {
  $$(".view").forEach(el =>
    el.classList.toggle("active", el.id === `view-${view}`)
  );

  $$(".nav-item").forEach(el =>
    el.classList.toggle("active", el.dataset.nav === view)
  );

  if (view === "home") renderHome();
  if (view === "records") renderRecords();
  if (view === "reports") renderReportPreview();
  if (view === "settings") loadSettingsForm();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

$$("[data-nav]").forEach(btn =>
  btn.addEventListener("click", () => navigate(btn.dataset.nav))
);

/* =========================
   DATE
========================= */

function updateFormDate() {
  $("#formDateLabel").textContent = formatBusinessDate(selectedDate);
}

function changeDay(amount) {
  const date = new Date(`${selectedDate}T12:00:00`);
  date.setDate(date.getDate() + amount);
  selectedDate = todayKey(date);

  updateFormDate();
  renderHome();
  renderRecords();
}

function setSelectedDate(date) {
  if (!date) return;

  selectedDate = date;
  updateFormDate();
  renderHome();
  renderRecords();
}

$("#previousDay").addEventListener("click", () => changeDay(-1));
$("#nextDay").addEventListener("click", () => changeDay(1));

$("#selectedDate").addEventListener("change", e =>
  setSelectedDate(e.target.value)
);

$("#goToday").addEventListener("click", () => {
  selectedDate = todayKey();
  updateFormDate();
  renderHome();
  renderRecords();
});

/* =========================
   BOX UI
========================= */

function createBox(data = {}) {
  const box = document.createElement("div");
  box.className = "mixed-box";

  const productId = data.productId || "croissant";
  const product = productById(productId) || DEFAULTS.products[0];

  box.dataset.product = product.id;

  box.innerHTML = `
    <div class="mixed-box-header">
      <div>
        <span class="box-eyebrow">صندوق</span>
        <strong class="box-number">1</strong>
      </div>

      <div class="box-header-actions">
        <button type="button" class="duplicate-box">نسخ</button>
        <button type="button" class="remove-box">حذف</button>
      </div>
    </div>

    <div class="field box-product-field">
      <label>نوع الصندوق</label>
      <select class="box-product">
        ${productOptions(product.id)}
      </select>
    </div>

    <div class="box-count-list"></div>

    <div class="box-total-row">
      <div>
        <span>مجموع الصندوق</span>
        <small class="box-status">أدخل الكمية</small>
      </div>

      <strong>
        <span class="box-total">0</span>
        /
        <span class="box-max">${product.boxSize}</span>
        حبة
      </strong>
    </div>
  `;

  $("#mixedBoxes").appendChild(box);

  box.querySelector(".box-product").addEventListener(
    "change",
    () => {
      box.dataset.product = box.querySelector(".box-product").value;
      renderBoxInputs(box);
      validateAll();
    }
  );

  box.querySelector(".remove-box").addEventListener(
    "click",
    () => {
      box.remove();
      renumberBoxes();
      validateAll();
    }
  );

  box.querySelector(".duplicate-box").addEventListener(
    "click",
    () => {
      const copy = readBox(box);
      createBox(copy);
      renumberBoxes();
      validateAll();
    }
  );

  renderBoxInputs(box, data.items || []);
  renumberBoxes();
  validateAll();

  return box;
}

function renderBoxInputs(box, oldItems = []) {
  const productId = box.querySelector(".box-product").value;
  const types = productTypes(productId);
  const container = box.querySelector(".box-count-list");

  const oldMap = {};

  oldItems.forEach(item => {
    oldMap[item.typeId] = Number(item.quantity) || 0;
  });

  container.innerHTML = types.map(type => `
    <div class="box-item-row">
      <label>${esc(type.name)}</label>

      <input
        class="box-quantity"
        data-type="${esc(type.id)}"
        type="number"
        min="0"
        max="${productSize(productId)}"
        step="1"
        inputmode="numeric"
        placeholder="0"
        value="${oldMap[type.id] || ""}"
      >

      <span>حبة</span>
    </div>
  `).join("");

  container.querySelectorAll(".box-quantity").forEach(input => {
    input.addEventListener("input", () => validateAll());
  });
}

function readBox(box) {
  const productId = box.querySelector(".box-product").value;

  const items = [...box.querySelectorAll(".box-quantity")]
    .map(input => ({
      typeId: input.dataset.type,
      quantity: Math.max(0, Number(input.value) || 0)
    }))
    .filter(item => item.quantity > 0);

  return {
    id: uid("box"),
    productId,
    boxSize: productSize(productId),
    items,
    total: items.reduce((sum, item) => sum + item.quantity, 0)
  };
}

function getBoxes() {
  return $$("#mixedBoxes .mixed-box").map(readBox);
}

function renumberBoxes() {
  $$("#mixedBoxes .mixed-box").forEach((box, i) => {
    box.querySelector(".box-number").textContent = i + 1;
  });
}

function updateBox(box) {
  const data = readBox(box);
  const max = data.boxSize;
  const total = data.total;

  box.querySelector(".box-total").textContent =
    total.toLocaleString("ar-LB");

  box.querySelector(".box-max").textContent =
    max.toLocaleString("ar-LB");

  let status = "أدخل الكمية";

  if (total === 0) {
    status = "فارغ";
  } else if (total > max) {
    status = `زيادة ${total - max} حبة`;
  } else if (total === max) {
    status = "صندوق ممتلئ ✓";
  } else {
    status = `متبقي ${max - total} حبة`;
  }

  box.querySelector(".box-status").textContent = status;

  box.classList.toggle("box-invalid", total > max);
}

/* =========================
   LOOSE
========================= */

function addLooseRow(data = {}) {
  const row = document.createElement("div");
  row.className = "loose-product-row";

  row.innerHTML = `
    <select class="loose-product">
      <option value="">اختر النوع</option>
      ${productOptions(data.productId || "")}
    </select>

    <input
      class="loose-quantity"
      type="number"
      min="1"
      step="1"
      inputmode="numeric"
      placeholder="العدد"
      value="${data.quantity || ""}"
    >

    <button type="button" class="remove-loose-product">×</button>
  `;

  row.querySelectorAll("select,input").forEach(el =>
    el.addEventListener("input", validateAll)
  );

  row.querySelector(".remove-loose-product").addEventListener(
    "click",
    () => {
      row.remove();
      validateAll();
    }
  );

  $("#looseProducts").appendChild(row);
}

function getLoose() {
  return $$("#looseProducts .loose-product-row")
    .map(row => ({
      id: uid("loose"),
      productId: row.querySelector(".loose-product").value,
      quantity: Math.max(
        0,
        Number(row.querySelector(".loose-quantity").value) || 0
      )
    }))
    .filter(item => item.productId && item.quantity > 0);
}

/* =========================
   TOTAL / VALIDATION
========================= */

function validateAll() {
  let total = 0;
  let valid = true;
  let message = "";

  getBoxes().forEach((box, i) => {
    total += box.total;

    if (!box.items.length) {
      valid = false;
      message = `أدخل محتوى الصندوق ${i + 1}.`;
    }

    if (box.total > box.boxSize) {
      valid = false;
      message =
        `الصندوق ${i + 1} يحتوي ${box.total} حبة، والحد الأقصى ${box.boxSize}.`;
    }

    const el = $$("#mixedBoxes .mixed-box")[i];
    if (el) updateBox(el);
  });

  getLoose().forEach(item => {
    total += item.quantity;
  });

  $("#orderTotal").textContent =
    total.toLocaleString("ar-LB");

  $("#boxValidationMessage").textContent = message;
  $("#boxValidationMessage").hidden = !message;

  return { valid, total, message };
}

/* =========================
   FORM
========================= */

function resetForm() {
  $("#recordForm").reset();
  $("#mixedBoxes").innerHTML = "";
  $("#looseProducts").innerHTML = "";

  $('input[name="type"][value="customer"]').checked = true;
  $('input[name="payment"][value="cash"]').checked = true;

  $("#amount").value = "";
  $("#notes").value = "";

  $("#formTitle").textContent = "تسجيل خروج";
  $("#formEyebrow").textContent = "عملية جديدة";
  $("#saveRecordBtn").textContent = "حفظ العملية";

  updatePartyType();
  updateFormDate();
  validateAll();
}

function openNewRecord() {
  editingId = null;
  resetForm();
  createBox();

  navigate("new");
}

$$("[data-new-record]").forEach(btn =>
  btn.addEventListener("click", openNewRecord)
);

$("#addBoxBtn").addEventListener("click", () => {
  createBox();
  window.setTimeout(() => {
    const boxes = $$("#mixedBoxes .mixed-box");
    boxes.at(-1)?.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }, 50);
});

$("#addLooseProductBtn").addEventListener(
  "click",
  () => addLooseRow()
);

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
    record.type === "hall" ? "صالة" : record.partyName || "";

  $("#mixedBoxes").innerHTML = "";
  $("#looseProducts").innerHTML = "";

  if (record.boxes.length) {
    record.boxes.forEach(box => createBox(box));
  } else {
    createBox();
  }

  record.loose.forEach(item => addLooseRow(item));

  const payment = $(
    `input[name="payment"][value="${record.payment || "cash"}"]`
  );

  if (payment) payment.checked = true;

  $("#amount").value = record.amount || "";
  $("#notes").value = record.notes || "";

  updatePartyType();
  updateFormDate();
  validateAll();

  navigate("new");
}

$("#recordForm").addEventListener("submit", e => {
  e.preventDefault();

  const type = $('input[name="type"]:checked').value;
  const partyName =
    type === "hall" ? "صالة" : $("#partyName").value.trim();

  if (type === "customer" && !partyName) {
    toast("أدخل اسم الزبون");
    $("#partyName").focus();
    return;
  }

  const validation = validateAll();

  if (!validation.valid) {
    toast(validation.message || "صحح الصناديق أولاً");
    return;
  }

  const boxes = getBoxes();
  const loose = getLoose();

  if (!boxes.length && !loose.length) {
    toast("أدخل كمية المنتجات");
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

  const now = new Date().toISOString();

  const data = {
    businessDate: selectedDate,
    type,
    partyName,
    boxes,
    loose,
    total: validation.total,
    payment,
    amount,
    notes: $("#notes").value.trim()
  };

  if (editingId) {
    const record = records.find(r => r.id === editingId);

    if (!record) return;

    Object.assign(record, data, { updatedAt: now });
    toast("تم تعديل العملية");
  } else {
    records.unshift({
      id: uid("record"),
      createdAt: now,
      ...data
    });

    toast("تم حفظ العملية");
  }

  saveRecords();
  editingId = null;
  resetForm();
  navigate("home");
});

/* =========================
   PARTY / PAYMENT
========================= */

function updatePartyType() {
  const type = $('input[name="type"]:checked')?.value;
  const hall = type === "hall";

  $("#customerNameField").hidden = hall;
  $("#hallSelected").hidden = !hall;
  $("#paymentSection").hidden = hall;

  if (hall) {
    $("#partyName").value = "صالة";
    $("#partyName").removeAttribute("required");
  } else {
    if (!editingId) $("#partyName").value = "";
    $("#partyName").setAttribute("required", "");
  }

  const payment =
    $('input[name="payment"]:checked')?.value || "cash";

  $("#amountField").hidden = payment === "unpaid";
}

$$('input[name="type"]').forEach(input =>
  input.addEventListener("change", updatePartyType)
);

$$('input[name="payment"]').forEach(input =>
  input.addEventListener("change", () => {
    $("#amountField").hidden = input.value === "unpaid";
  })
);

/* =========================
   RECORD DISPLAY
========================= */

function composition(record) {
  const totals = {};

  const add = (productId, typeId, qty) => {
    const key = `${productId}:${typeId}`;

    totals[key] ||= {
      productId,
      typeId,
      quantity: 0
    };

    totals[key].quantity += Number(qty) || 0;
  };

  (record.boxes || []).forEach(box =>
    (box.items || []).forEach(item =>
      add(box.productId, item.typeId, item.quantity)
    )
  );

  (record.loose || []).forEach(item =>
    add(item.productId, "loose", item.quantity)
  );

  return Object.values(totals);
}

function compositionText(record) {
  return composition(record)
    .map(item => {
      const name =
        item.typeId === "loose"
          ? productName(item.productId)
          : typeName(item.productId, item.typeId);

      return `${name}: ${item.quantity}`;
    })
    .join(" · ");
}

function boxText(box) {
  return (box.items || [])
    .map(item =>
      `${typeName(box.productId, item.typeId)} ${item.quantity}`
    )
    .join(" + ");
}

function paymentText(payment) {
  return {
    cash: "نقداً",
    whish: "Whish Money",
    unpaid: "غير مدفوع"
  }[payment] || "—";
}

function card(record) {
  const boxes = record.boxes || [];
  const loose = record.loose || [];

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
            ${formatTime(record.createdAt)} ·
            ${formatShortDate(record.businessDate)}
          </div>
        </div>

        <div class="record-total">
          ${Number(record.total).toLocaleString("ar-LB")}
          <small>حبة</small>
        </div>
      </div>

      <div class="record-details">

        <div class="composition-summary">
          <b>الإجمالي حسب النوع:</b>
          ${esc(compositionText(record) || "—")}
        </div>

        ${
          boxes.length
            ? `
              <div class="record-boxes">
                <b>${boxes.length} صندوق:</b>

                ${boxes.map((box, i) => `
                  <div class="saved-box">
                    <strong>صندوق ${i + 1}</strong>
                    <span>
                      ${esc(productName(box.productId))}
                      —
                      ${esc(boxText(box))}
                      =
                      ${box.total}/${box.boxSize}
                    </span>
                  </div>
                `).join("")}
              </div>
            `
            : ""
        }

        ${
          loose.length
            ? `
              <div class="saved-loose">
                <b>خارج الصندوق:</b>
                ${loose.map(item =>
                  `${esc(productName(item.productId))}: ${item.quantity}`
                ).join(" · ")}
              </div>
            `
            : ""
        }

        ${
          record.type === "customer"
            ? `
              <div>
                <b>الدفع:</b>
                ${paymentText(record.payment)}
                ${record.amount ? ` · ${money(record.amount)}` : ""}
              </div>
            `
            : ""
        }

        ${
          record.notes
            ? `<div class="note-line"><b>ملاحظات:</b> ${esc(record.notes)}</div>`
            : ""
        }

        <div class="record-actions">
          <button type="button" data-edit-id="${esc(record.id)}">
            تعديل
          </button>

          <button type="button" data-delete-id="${esc(record.id)}">
            حذف
          </button>
        </div>
      </div>
    </article>
  `;
}

/* =========================
   HOME / RECORDS
========================= */

function dayRecords(date = selectedDate) {
  return records
    .filter(r => r.businessDate === date)
    .sort(
      (a, b) =>
        new Date(b.createdAt) - new Date(a.createdAt)
    );
}

function renderHome() {
  const list = dayRecords();

  $("#selectedDate").value = selectedDate;
  $("#dayLabel").textContent = formatBusinessDate(selectedDate);

  $("#todayTotal").textContent = list
    .reduce((sum, r) => sum + Number(r.total || 0), 0)
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
    `<div class="empty">لا توجد عمليات في هذا اليوم.</div>`;
}

function renderRecords() {
  const query = $("#searchInput").value.trim().toLowerCase();
  const type = $("#typeFilter").value;

  const list = dayRecords().filter(record => {
    const text = [
      record.partyName,
      record.notes,
      compositionText(record)
    ].join(" ").toLowerCase();

    return (
      (!query || text.includes(query)) &&
      (type === "all" || record.type === type)
    );
  });

  $("#recordsDateLabel").textContent =
    formatBusinessDate(selectedDate);

  $("#recordsList").innerHTML =
    list.map(card).join("") ||
    `<div class="empty">لا توجد نتائج لهذا اليوم.</div>`;
}

$("#searchInput").addEventListener("input", renderRecords);
$("#typeFilter").addEventListener("change", renderRecords);

/* =========================
   EDIT / DELETE
========================= */

document.addEventListener("click", e => {
  const edit = e.target.closest("[data-edit-id]");

  if (edit) {
    openEditRecord(edit.dataset.editId);
    return;
  }

  const del = e.target.closest("[data-delete-id]");
  if (!del) return;

  const record = records.find(r => r.id === del.dataset.deleteId);
  if (!record) return;

  if (!confirm(
    `حذف عملية ${record.partyName} — ${record.total} حبة؟\n\nلا يمكن التراجع عن هذا الحذف.`
  )) return;

  records = records.filter(r => r.id !== record.id);
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
    .filter(r =>
      (!from || r.businessDate >= from) &&
      (!to || r.businessDate <= to) &&
      (type === "all" || r.type === type)
    )
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

function reportProductTotals(list) {
  const totals = {};

  list.forEach(record =>
    composition(record).forEach(item => {
      const key = `${item.productId}:${item.typeId}`;

      totals[key] ||= {
        productId: item.productId,
        typeId: item.typeId,
        quantity: 0
      };

      totals[key].quantity += item.quantity;
    })
  );

  return Object.values(totals);
}

function renderReportPreview() {
  const from = $("#fromDate").value;
  const to = $("#toDate").value;
  const type = $("#reportType").value;
  const list = filteredReport(from, to, type);

  const total = list.reduce(
    (sum, r) => sum + Number(r.total || 0),
    0
  );

  const customerTotal = list
    .filter(r => r.type === "customer")
    .reduce((sum, r) => sum + Number(r.total || 0), 0);

  const hallTotal = list
    .filter(r => r.type === "hall")
    .reduce((sum, r) => sum + Number(r.total || 0), 0);

  const productTotals = reportProductTotals(list);

  let dateText = "—";

  if (from && to && from === to) {
    dateText = formatBusinessDate(from);
  } else if (from && to) {
    dateText = `${formatShortDate(from)} — ${formatShortDate(to)}`;
  } else if (from) {
    dateText = `من ${formatShortDate(from)}`;
  } else if (to) {
    dateText = `حتى ${formatShortDate(to)}`;
  }

  $("#reportPreview").innerHTML = `
    <div class="print-header">
      <h2>${esc(settings.factoryName)}</h2>
      <h3>${from && to && from === to ? "تقرير يومي" : "تقرير فترة"}</h3>
      <p>${dateText}</p>
    </div>

    <div class="report-summary-grid">
      <div><span>العمليات</span><strong>${list.length}</strong></div>
      <div><span>إجمالي الحبات</span><strong>${total.toLocaleString("ar-LB")}</strong></div>
      <div><span>الزبائن</span><strong>${customerTotal.toLocaleString("ar-LB")}</strong></div>
      <div><span>الصالة</span><strong>${hallTotal.toLocaleString("ar-LB")}</strong></div>
    </div>

    <div class="report-products">
      <h3>الإجمالي حسب النوع</h3>

      ${
        productTotals.length
          ? productTotals.map(item => `
            <div class="report-product-row">
              <span>
                ${esc(
                  item.typeId === "loose"
                    ? productName(item.productId)
                    : typeName(item.productId, item.typeId)
                )}
              </span>
              <strong>${item.quantity.toLocaleString("ar-LB")} حبة</strong>
            </div>
          `).join("")
          : `<div class="empty">لا توجد منتجات.</div>`
      }
    </div>

    <table class="report-table">
      <thead>
        <tr>
          <th>التاريخ</th>
          <th>الجهة</th>
          <th>الصناديق</th>
          <th>الكمية</th>
          <th>المنتجات</th>
          <th>الدفع</th>
        </tr>
      </thead>

      <tbody>
        ${
          list.length
            ? list.map(r => `
              <tr>
                <td>${formatShortDate(r.businessDate)}</td>
                <td>${esc(r.partyName)}</td>
                <td>${r.boxes.length}</td>
                <td>${Number(r.total).toLocaleString("ar-LB")}</td>
                <td>${esc(compositionText(r))}</td>
                <td>
                  ${r.type === "customer" ? paymentText(r.payment) : "—"}
                </td>
              </tr>
            `).join("")
            : `<tr><td colspan="6">لا توجد عمليات.</td></tr>`
        }
      </tbody>
    </table>

    ${
      list.length
        ? `
          <div class="report-box-details">
            <h3>تفاصيل الصناديق</h3>

            ${list.map(r => `
              <div class="report-record-detail">
                <strong>${esc(r.partyName)}</strong>
                <span>${formatShortDate(r.businessDate)}</span>

                ${
                  r.boxes.map((box, i) => `
                    <div>
                      صندوق ${i + 1}:
                      ${esc(productName(box.productId))}
                      —
                      ${esc(boxText(box))}
                      =
                      ${box.total}/${box.boxSize}
                    </div>
                  `).join("")
                }
              </div>
            `).join("")}
          </div>
        `
        : ""
    }

    <div class="report-footer">
      إجمالي الحبات:
      <strong>${total.toLocaleString("ar-LB")}</strong>
    </div>
  `;
}

$("#dailyReport").addEventListener("click", setDailyReport);
$("#fromDate").addEventListener("change", renderReportPreview);
$("#toDate").addEventListener("change", renderReportPreview);
$("#reportType").addEventListener("change", renderReportPreview);

$("#printReport").addEventListener("click", () => {
  renderReportPreview();
  setTimeout(() => window.print(), 100);
});

/* =========================
   SETTINGS
========================= */

function loadSettingsForm() {
  $("#factoryName").value = settings.factoryName;

  const croissant = productById("croissant");
  const donut = productById("donut");

  $("#croissantBoxSize").value = croissant?.boxSize || 40;
  $("#donutBoxSize").value = donut?.boxSize || 8;
}

$("#saveSettings").addEventListener("click", () => {
  settings.factoryName =
    $("#factoryName").value.trim() || "سجل المصنع";

  const croissant = productById("croissant");
  const donut = productById("donut");

  if (croissant) {
    croissant.boxSize = Math.max(
      1,
      Number($("#croissantBoxSize").value) || 40
    );
  }

  if (donut) {
    donut.boxSize = Math.max(
      1,
      Number($("#donutBoxSize").value) || 8
    );
  }

  saveSettings();

  toast("تم حفظ الإعدادات");
  renderHome();
  renderRecords();
  renderReportPreview();
});

$("#clearData").addEventListener("click", () => {
  if (!confirm(
    "هل أنت متأكد؟ سيتم حذف جميع العمليات نهائياً من هذا الجهاز."
  )) return;

  records = [];
  localStorage.removeItem(KEY);
  localStorage.removeItem("croissant_store_records_v4");

  saveRecords();

  renderHome();
  renderRecords();
  renderReportPreview();

  toast("تم حذف جميع العمليات");
});

/* =========================
   PWA
========================= */

let deferredPrompt = null;

window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  deferredPrompt = e;
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

/* =========================
   START
========================= */

$("#fromDate").value = selectedDate;
$("#toDate").value = selectedDate;

loadSettingsForm();
updatePartyType();
updateFormDate();
renderHome();
renderRecords();
renderReportPreview();