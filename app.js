const KEY = "croissant_store_records_v5";
const INVENTORY_KEY = "factory_inventory_v1";
const SETTINGS_KEY = "croissant_store_settings_v5";

const DEFAULTS = {
  factoryName: "سجل المصنع",
  products: [
    {
      id: "croissant",
      name: "كرواسون",
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
      boxSize: 8,
      types: [{ id: "donut", name: "دونات" }]
    }
  ]
};

let records = loadRecords();
let inventory = loadInventory();
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
  window.toastTimer = setTimeout(() => el.classList.remove("show"), 2300);
}

function money(value) {
  if (value === "" || value == null) return "";
  return Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 });
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
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
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
    businessDate: record.businessDate || todayKey(),
    boxes: Array.isArray(record.boxes) ? record.boxes : [],
    loose: Array.isArray(record.loose) ? record.loose : [],
    total: Number(record.total) || 0
  };
}

function migrateOldRecord(record) {
  if (Array.isArray(record.boxes)) return normalizeRecord(record);

  const boxes = [];
  const size = Number(record.boxSize) || 40;
  const full = Number(record.fullBoxes) || 0;
  const partials = Array.isArray(record.partials) ? record.partials : [];

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
    total: Number(record.total) || 0
  });
}

function loadRecords() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (Array.isArray(saved)) return saved.map(normalizeRecord);

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

function normalizeBox(box) {
  return {
    id: box.id || uid("box"),
    productId: box.productId || "croissant",
    boxSize: Number(box.boxSize) || productSize(box.productId),
    items: Array.isArray(box.items) ? box.items : [],
    total: Number(box.total) || 0,
    status: box.status || "checked",
    checkedAt: box.checkedAt || null,
    exitedAt: box.exitedAt || null
  };
}

function normalizeInventoryDay(day) {
  return {
    id: day.id || uid("day"),
    businessDate: day.businessDate || todayKey(),
    saleExpectedBoxes: Number(day.saleExpectedBoxes) || 0,
    saleBoxes: Array.isArray(day.saleBoxes) ? day.saleBoxes.map(normalizeBox) : [],
    orders: Array.isArray(day.orders)
      ? day.orders.map(order => ({
          id: order.id || uid("order"),
          customerName: order.customerName || "",
          expected: Array.isArray(order.expected) ? order.expected : [],
          boxes: Array.isArray(order.boxes) ? order.boxes.map(normalizeBox) : []
        }))
      : []
  };
}

function loadInventory() {
  try {
    const saved = JSON.parse(localStorage.getItem(INVENTORY_KEY) || "[]");
    return Array.isArray(saved) ? saved.map(normalizeInventoryDay) : [];
  } catch {
    return [];
  }
}

function saveInventory() {
  localStorage.setItem(INVENTORY_KEY, JSON.stringify(inventory));
}

function getInventoryDay(date = selectedDate) {
  let day = inventory.find(x => x.businessDate === date);

  if (!day) {
    day = normalizeInventoryDay({
      id: uid("day"),
      businessDate: date
    });
    inventory.unshift(day);
    saveInventory();
  }

  return day;
}

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

function navigate(view) {
  $$(".view").forEach(el =>
    el.classList.toggle("active", el.id === `view-${view}`)
  );

  $$(".nav-item").forEach(el =>
    el.classList.toggle("active", el.dataset.nav === view)
  );

  if (view === "home") renderHome();
  if (view === "inventory") renderInventory();
  if (view === "new") {
    updatePartyType();
    updateFormDate();
    validateAll();
  }
  if (view === "records") renderRecords();
  if (view === "reports") renderReportPreview();
  if (view === "settings") loadSettingsForm();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

$$("[data-nav]").forEach(btn =>
  btn.addEventListener("click", () => navigate(btn.dataset.nav))
);

function updateFormDate() {
  const el = $("#formDateLabel");
  if (el) el.textContent = formatBusinessDate(selectedDate);
}

function changeDay(amount) {
  const date = new Date(`${selectedDate}T12:00:00`);
  date.setDate(date.getDate() + amount);
  selectedDate = todayKey(date);
  updateFormDate();
  renderHome();
  renderInventory();
  renderRecords();
}

function setSelectedDate(date) {
  if (!date) return;
  selectedDate = date;
  updateFormDate();
  renderHome();
  renderInventory();
  renderRecords();
}

$("#previousDay")?.addEventListener("click", () => changeDay(-1));
$("#nextDay")?.addEventListener("click", () => changeDay(1));
$("#selectedDate")?.addEventListener("change", e => setSelectedDate(e.target.value));

$("#goToday")?.addEventListener("click", () => {
  selectedDate = todayKey();
  updateFormDate();
  renderHome();
  renderInventory();
  renderRecords();
});

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
      <select class="box-product">${productOptions(product.id)}</select>
    </div>

    <div class="box-count-list"></div>

    <div class="box-total-row">
      <div>
        <span>مجموع الصندوق</span>
        <small class="box-status">أدخل الكمية</small>
      </div>
      <strong>
        <span class="box-total">0</span> /
        <span class="box-max">${product.boxSize}</span> حبة
      </strong>
    </div>
  `;

  $("#mixedBoxes").appendChild(box);

  box.querySelector(".box-product").addEventListener("change", () => {
    box.dataset.product = box.querySelector(".box-product").value;
    renderBoxInputs(box);
    validateAll();
  });

  box.querySelector(".remove-box").addEventListener("click", () => {
    box.remove();
    renumberBoxes();
    validateAll();
  });

  box.querySelector(".duplicate-box").addEventListener("click", () => {
    createBox(readBox(box));
    renumberBoxes();
    validateAll();
  });

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

  container.querySelectorAll(".box-quantity").forEach(input =>
    input.addEventListener("input", validateAll)
  );
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
  const total = data.total;
  const max = data.boxSize;

  box.querySelector(".box-total").textContent =
    total.toLocaleString("ar-LB");

  box.querySelector(".box-max").textContent =
    max.toLocaleString("ar-LB");

  let status = "أدخل الكمية";

  if (total === 0) status = "فارغ";
  else if (total > max) status = `زيادة ${total - max} حبة`;
  else if (total === max) status = "صندوق ممتلئ ✓";
  else status = `متبقي ${max - total} حبة`;

  box.querySelector(".box-status").textContent = status;
  box.classList.toggle("box-invalid", total > max);
}

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

  row.querySelectorAll("select,input")
    .forEach(el => el.addEventListener("input", validateAll));

  row.querySelector(".remove-loose-product")
    .addEventListener("click", () => {
      row.remove();
      validateAll();
    });

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
      message = `الصندوق ${i + 1} يحتوي ${box.total} حبة، والحد الأقصى ${box.boxSize}.`;
    }

    const el = $$("#mixedBoxes .mixed-box")[i];
    if (el) updateBox(el);
  });

  getLoose().forEach(item => total += item.quantity);

  if ($("#orderTotal")) {
    $("#orderTotal").textContent = total.toLocaleString("ar-LB");
  }

  if ($("#boxValidationMessage")) {
    $("#boxValidationMessage").textContent = message;
    $("#boxValidationMessage").hidden = !message;
  }

  return { valid, total, message };
}

function resetForm() {
  $("#recordForm")?.reset();
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

$("#addBoxBtn")?.addEventListener("click", () => {
  createBox();

  setTimeout(() => {
    const boxes = $$("#mixedBoxes .mixed-box");
    boxes.at(-1)?.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }, 50);
});

$("#addLooseProductBtn")?.addEventListener("click", () => addLooseRow());

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

$("#recordForm")?.addEventListener("submit", e => {
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
            ${formatTime(record.createdAt)} · ${formatShortDate(record.businessDate)}
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
                      ${esc(productName(box.productId))} —
                      ${esc(boxText(box))} =
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
          <button type="button" data-edit-id="${esc(record.id)}">تعديل</button>
          <button type="button" data-delete-id="${esc(record.id)}">حذف</button>
        </div>
      </div>
    </article>
  `;
}

function dayRecords(date = selectedDate) {
  return records
    .filter(r => r.businessDate === date)
    .sort((a, b) =>
      new Date(b.createdAt) - new Date(a.createdAt)
    );
}

function renderHome() {
  const list = dayRecords();

  if ($("#selectedDate")) $("#selectedDate").value = selectedDate;
  if ($("#dayLabel")) $("#dayLabel").textContent = formatBusinessDate(selectedDate);

  if ($("#todayTotal")) {
    $("#todayTotal").textContent =
      list.reduce((sum, r) => sum + Number(r.total || 0), 0)
        .toLocaleString("ar-LB");
  }

  if ($("#todayCount")) {
    $("#todayCount").textContent =
      list.length.toLocaleString("ar-LB");
  }

  if ($("#todayCustomers")) {
    $("#todayCustomers").textContent =
      list.filter(r => r.type === "customer").length
        .toLocaleString("ar-LB");
  }

  if ($("#todayHalls")) {
    $("#todayHalls").textContent =
      list.filter(r => r.type === "hall").length
        .toLocaleString("ar-LB");
  }

  if ($("#recentRecords")) {
    $("#recentRecords").innerHTML =
      list.slice(0, 5).map(card).join("") ||
      `<div class="empty">لا توجد عمليات في هذا اليوم.</div>`;
  }

  renderInventorySummary();
}

function renderRecords() {
  const query = ($("#searchInput")?.value || "").trim().toLowerCase();
  const type = $("#typeFilter")?.value || "all";

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

  if ($("#recordsDateLabel")) {
    $("#recordsDateLabel").textContent =
      formatBusinessDate(selectedDate);
  }

  if ($("#recordsList")) {
    $("#recordsList").innerHTML =
      list.map(card).join("") ||
      `<div class="empty">لا توجد نتائج لهذا اليوم.</div>`;
  }
}

$("#searchInput")?.addEventListener("input", renderRecords);
$("#typeFilter")?.addEventListener("change", renderRecords);

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

function expectedTotals(order) {
  const totals = {};

  (order.expected || []).forEach(item => {
    const key = `${item.productId}:${item.typeId}`;

    totals[key] ||= {
      productId: item.productId,
      typeId: item.typeId,
      quantity: 0
    };

    totals[key].quantity += Number(item.quantity) || 0;
  });

  return Object.values(totals);
}

function physicalTotals(boxes) {
  const totals = {};

  (boxes || []).forEach(box => {
    (box.items || []).forEach(item => {
      const key = `${box.productId}:${item.typeId}`;

      totals[key] ||= {
        productId: box.productId,
        typeId: item.typeId,
        quantity: 0
      };

      totals[key].quantity += Number(item.quantity) || 0;
    });
  });

  return Object.values(totals);
}

function compareOrder(order) {
  const expected = expectedTotals(order);
  const actual = physicalTotals(order.boxes);
  const keys = new Set([
    ...expected.map(x => `${x.productId}:${x.typeId}`),
    ...actual.map(x => `${x.productId}:${x.typeId}`)
  ]);

  const differences = [...keys].map(key => {
    const e = expected.find(
      x => `${x.productId}:${x.typeId}` === key
    )?.quantity || 0;

    const a = actual.find(
      x => `${x.productId}:${x.typeId}` === key
    )?.quantity || 0;

    const [productId, typeId] = key.split(":");

    return {
      productId,
      typeId,
      expected: e,
      actual: a,
      difference: a - e
    };
  });

  const expectedBoxes = Math.ceil(
    expected.reduce((sum, x) => sum + x.quantity, 0) /
    Math.max(1, productSize(expected[0]?.productId))
  );

  const boxDifference =
    order.boxes.length - expectedBoxes;

  return {
    differences,
    boxDifference,
    complete:
      differences.every(x => x.difference === 0) &&
      boxDifference === 0
  };
}

function differenceText(diff) {
  const name = typeName(diff.productId, diff.typeId);

  if (diff.difference === 0) {
    return `<span class="ok">✓ ${esc(name)} ${diff.actual}</span>`;
  }

  if (diff.difference > 0) {
    return `
      <span class="warning">
        ⚠ ${esc(name)} +${diff.difference}
        <small>الموجود ${diff.actual} / المطلوب ${diff.expected}</small>
      </span>
    `;
  }

  return `
    <span class="danger">
      ⚠ ${esc(name)} ${diff.difference}
      <small>الموجود ${diff.actual} / المطلوب ${diff.expected}</small>
    </span>
  `;
}

function orderStatus(order) {
  const result = compareOrder(order);

  if (result.complete) {
    return `<span class="status-badge success">✓ مكتمل</span>`;
  }

  const problems = result.differences.filter(
    x => x.difference !== 0
  ).length;

  if (problems) {
    return `<span class="status-badge danger">⚠ اختلاف</span>`;
  }

  return `<span class="status-badge warning">⚠ ${Math.abs(result.boxDifference)} صندوق</span>`;
}

function inventoryBoxCard(box, destination, orderId = "") {
  const exited = box.status === "out";

  return `
    <div class="check-box-card">
      <div>
        <strong>${esc(productName(box.productId))}</strong>
        <span>${esc(boxText(box))}</span>
        <small>
          ${formatTime(box.checkedAt)}
          · ${box.total}/${box.boxSize}
        </small>
      </div>

      <div class="check-box-actions">
        <span class="status-badge ${exited ? "success" : "warning"}">
          ${exited ? "خرج" : "تم التحقق"}
        </span>

        ${
          exited
            ? ""
            : `
              <button
                type="button"
                data-exit-box="${esc(box.id)}"
                data-exit-destination="${destination}"
                data-exit-order="${esc(orderId)}"
              >
                تسجيل خروج
              </button>
            `
        }
      </div>
    </div>
  `;
}

function renderInventorySummary() {
  const day = getInventoryDay();
  const saleChecked = day.saleBoxes.length;
  const saleMissing = day.saleExpectedBoxes - saleChecked;

  let customerExpected = 0;
  let customerChecked = 0;
  let problems = 0;

  day.orders.forEach(order => {
    customerExpected += Math.ceil(
      expectedTotals(order).reduce((sum, x) => sum + x.quantity, 0) /
      Math.max(1, productSize(expectedTotals(order)[0]?.productId))
    );

    customerChecked += order.boxes.length;

    const result = compareOrder(order);
    problems += result.differences.filter(
      x => x.difference !== 0
    ).length;

    if (result.boxDifference !== 0) problems++;
  });

  const totalExpected =
    day.saleExpectedBoxes + customerExpected;

  const totalChecked =
    saleChecked + customerChecked;

  if ($("#inventoryExpected")) {
    $("#inventoryExpected").textContent =
      totalExpected.toLocaleString("ar-LB");
  }

  if ($("#inventoryChecked")) {
    $("#inventoryChecked").textContent =
      totalChecked.toLocaleString("ar-LB");
  }

  if ($("#inventoryProblems")) {
    $("#inventoryProblems").textContent =
      Math.max(
        0,
        (saleMissing > 0 ? 1 : 0) + problems
      ).toLocaleString("ar-LB");
  }

  if ($("#inventorySaleSummary")) {
    $("#inventorySaleSummary").innerHTML = `
      <strong>للبيع</strong>
      <span>
        ${saleChecked} / ${day.saleExpectedBoxes} صندوق
      </span>
      <small>
        ${
          saleMissing > 0
            ? `⚠ ناقص ${saleMissing}`
            : saleMissing < 0
              ? `⚠ زيادة ${Math.abs(saleMissing)}`
              : "✓ مطابق"
        }
      </small>
    `;
  }

  if ($("#inventoryCustomerSummary")) {
    $("#inventoryCustomerSummary").innerHTML = `
      <strong>طلبات الزبائن</strong>
      <span>${day.orders.length} طلب · ${customerChecked} صندوق</span>
      <small>${problems ? `⚠ ${problems} اختلاف` : "✓ لا يوجد اختلاف"}</small>
    `;
  }
}

function renderInventory() {
  const day = getInventoryDay();

  if ($("#inventoryDateLabel")) {
    $("#inventoryDateLabel").textContent =
      formatBusinessDate(selectedDate);
  }

  if ($("#saleExpectedBoxes")) {
    $("#saleExpectedBoxes").value =
      day.saleExpectedBoxes || "";
  }

  renderSaleInventory(day);
  renderCustomerOrders(day);
  renderInventorySummary();
}

function renderSaleInventory(day) {
  const el = $("#saleInventoryList");
  if (!el) return;

  el.innerHTML =
    day.saleBoxes.map(box =>
      inventoryBoxCard(box, "sale")
    ).join("") ||
    `<div class="empty">لم يتم فحص أي صندوق للبيع بعد.</div>`;
}

function renderCustomerOrders(day) {
  const el = $("#customerOrdersList");
  if (!el) return;

  el.innerHTML =
    day.orders.map(order => {
      const result = compareOrder(order);
      const expectedText = expectedTotals(order)
        .map(x =>
          `${esc(typeName(x.productId, x.typeId))}: ${x.quantity}`
        )
        .join(" · ");

      return `
        <article class="customer-order-card">
          <div class="customer-order-head">
            <div>
              <strong>${esc(order.customerName)}</strong>
              <span>${order.boxes.length} صندوق تم التحقق منه</span>
            </div>
            ${orderStatus(order)}
          </div>

          <div class="expected-line">
            <b>المطلوب:</b> ${expectedText || "—"}
          </div>

          <div class="difference-list">
            ${result.differences.map(differenceText).join("")}
          </div>

          <div class="box-count-line">
            <span>
              الصناديق:
              ${order.boxes.length}
            </span>

            ${
              result.boxDifference === 0
                ? `<span class="ok">✓ مطابق</span>`
                : result.boxDifference > 0
                  ? `<span class="warning">+${result.boxDifference} صندوق</span>`
                  : `<span class="danger">${result.boxDifference} صندوق</span>`
            }
          </div>

          <div class="inventory-boxes">
            ${
              order.boxes.map(box =>
                inventoryBoxCard(box, "customer", order.id)
              ).join("") ||
              `<div class="empty small">لم يتم فحص صناديق بعد.</div>`
            }
          </div>

          <div class="order-actions">
            <button type="button" data-check-order="${esc(order.id)}">
              + فحص صندوق
            </button>
            <button type="button" data-edit-order="${esc(order.id)}">
              تعديل الطلب
            </button>
            <button type="button" data-delete-order="${esc(order.id)}">
              حذف
            </button>
          </div>
        </article>
      `;
    }).join("") ||
    `<div class="empty">لا توجد طلبات زبائن لهذا اليوم.</div>`;
}

function openOrderForm(order = null) {
  const form = $("#orderForm");
  if (!form) return;

  $("#orderEditId").value = order?.id || "";
  $("#orderCustomerName").value = order?.customerName || "";

  const container = $("#expectedItems");
  container.innerHTML = "";

  if (order?.expected?.length) {
    order.expected.forEach(item => addExpectedRow(item));
  } else {
    addExpectedRow();
  }

  $("#orderModal").hidden = false;
  $("#orderCustomerName").focus();
}

function closeOrderForm() {
  $("#orderModal").hidden = true;
}

function addExpectedRow(data = {}) {
  const row = document.createElement("div");
  row.className = "expected-item-row";

  row.innerHTML = `
    <select class="expected-product">
      ${productOptions(data.productId || "croissant")}
    </select>

    <select class="expected-type"></select>

    <input
      class="expected-quantity"
      type="number"
      min="1"
      step="1"
      inputmode="numeric"
      placeholder="العدد"
      value="${data.quantity || ""}"
    >

    <button type="button" class="remove-expected">×</button>
  `;

  $("#expectedItems").appendChild(row);

  const product = row.querySelector(".expected-product");
  const type = row.querySelector(".expected-type");

  function updateTypes() {
    const types = productTypes(product.value);

    type.innerHTML = types.map(t => `
      <option value="${esc(t.id)}"
        ${t.id === data.typeId ? "selected" : ""}>
        ${esc(t.name)}
      </option>
    `).join("");
  }

  product.addEventListener("change", updateTypes);

  row.querySelector(".remove-expected")
    .addEventListener("click", () => row.remove());

  updateTypes();
}

$("#addExpectedRow")?.addEventListener("click", () => addExpectedRow());
$("#cancelOrder")?.addEventListener("click", closeOrderForm);

$("#orderForm")?.addEventListener("submit", e => {
  e.preventDefault();

  const name = $("#orderCustomerName").value.trim();
  if (!name) {
    toast("أدخل اسم الزبون");
    return;
  }

  const expected = $$(".expected-item-row")
    .map(row => ({
      productId: row.querySelector(".expected-product").value,
      typeId: row.querySelector(".expected-type").value,
      quantity: Math.max(
        0,
        Number(row.querySelector(".expected-quantity").value) || 0
      )
    }))
    .filter(x => x.quantity > 0);

  if (!expected.length) {
    toast("أدخل الكمية المطلوبة");
    return;
  }

  const day = getInventoryDay();
  const id = $("#orderEditId").value;

  if (id) {
    const order = day.orders.find(x => x.id === id);

    if (order) {
      order.customerName = name;
      order.expected = expected;
    }
  } else {
    day.orders.push({
      id: uid("order"),
      customerName: name,
      expected,
      boxes: []
    });
  }

  saveInventory();
  closeOrderForm();
  renderInventory();
  toast(id ? "تم تعديل الطلب" : "تم حفظ الطلب");
});

function openCheckBox(destination, orderId = "") {
  $("#checkDestination").value = destination;
  $("#checkOrderId").value = orderId;

  const select = $("#checkCustomer");

  if (destination === "customer") {
    const day = getInventoryDay();

    select.innerHTML = day.orders.map(order => `
      <option value="${esc(order.id)}">
        ${esc(order.customerName)}
      </option>
    `).join("");

    select.value = orderId;
    $("#checkCustomerField").hidden = false;
  } else {
    select.innerHTML = "";
    $("#checkCustomerField").hidden = true;
  }

  $("#checkBoxes").innerHTML = "";
  createCheckBox();
  $("#checkModal").hidden = false;
}

function closeCheckBox() {
  $("#checkModal").hidden = true;
}

function createCheckBox(data = {}) {
  const box = document.createElement("div");
  box.className = "mixed-box check-builder";

  const productId = data.productId || "croissant";
  const product = productById(productId) || DEFAULTS.products[0];

  box.innerHTML = `
    <div class="mixed-box-header">
      <div>
        <span class="box-eyebrow">الصندوق</span>
        <strong>فحص فعلي</strong>
      </div>
    </div>

    <div class="field">
      <label>نوع المنتج</label>
      <select class="check-product">
        ${productOptions(product.id)}
      </select>
    </div>

    <div class="check-count-list"></div>

    <div class="box-total-row">
      <div>
        <span>المجموع</span>
        <small class="check-status">أدخل الكمية</small>
      </div>
      <strong>
        <span class="check-total">0</span> /
        <span class="check-max">${product.boxSize}</span>
      </strong>
    </div>
  `;

  $("#checkBoxes").appendChild(box);

  box.querySelector(".check-product")
    .addEventListener("change", () => {
      renderCheckInputs(box);
    });

  renderCheckInputs(box, data.items || []);
}

function renderCheckInputs(box, oldItems = []) {
  const productId = box.querySelector(".check-product").value;
  const types = productTypes(productId);
  const container = box.querySelector(".check-count-list");
  const old = {};

  oldItems.forEach(item => {
    old[item.typeId] = item.quantity;
  });

  container.innerHTML = types.map(type => `
    <div class="box-item-row">
      <label>${esc(type.name)}</label>
      <input
        class="check-quantity"
        data-type="${esc(type.id)}"
        type="number"
        min="0"
        step="1"
        inputmode="numeric"
        value="${old[type.id] || ""}"
        placeholder="0"
      >
      <span>حبة</span>
    </div>
  `).join("");

  container.querySelectorAll(".check-quantity")
    .forEach(input =>
      input.addEventListener("input", () => updateCheckBox(box))
    );

  updateCheckBox(box);
}

function readCheckBox(box) {
  const productId = box.querySelector(".check-product").value;

  const items = [...box.querySelectorAll(".check-quantity")]
    .map(input => ({
      typeId: input.dataset.type,
      quantity: Number(input.value) || 0
    }))
    .filter(x => x.quantity > 0);

  return {
    id: uid("box"),
    productId,
    boxSize: productSize(productId),
    items,
    total: items.reduce((sum, x) => sum + x.quantity, 0),
    status: "checked",
    checkedAt: new Date().toISOString(),
    exitedAt: null
  };
}

function updateCheckBox(box) {
  const data = readCheckBox(box);
  const total = data.total;
  const max = data.boxSize;

  box.querySelector(".check-total").textContent =
    total.toLocaleString("ar-LB");

  box.querySelector(".check-max").textContent =
    max.toLocaleString("ar-LB");

  const status = box.querySelector(".check-status");

  if (!total) {
    status.textContent = "أدخل الكمية";
  } else if (total > max) {
    status.textContent = `زيادة ${total - max} حبة`;
  } else if (total === max) {
    status.textContent = "ممتلئ ✓";
  } else {
    status.textContent = `متبقي ${max - total}`;
  }

  box.classList.toggle("box-invalid", total > max);
}

$("#cancelCheck")?.addEventListener("click", closeCheckBox);

$("#checkForm")?.addEventListener("submit", e => {
  e.preventDefault();

  const destination = $("#checkDestination").value;
  const orderId = $("#checkCustomer").value;
  const boxEl = $("#checkBoxes .check-builder");

  if (!boxEl) return;

  const box = readCheckBox(boxEl);

  if (!box.items.length) {
    toast("أدخل محتوى الصندوق");
    return;
  }

  if (box.total > box.boxSize) {
    toast("كمية الصندوق أكبر من الحد المسموح");
    return;
  }

  const day = getInventoryDay();

  if (destination === "sale") {
    day.saleBoxes.push(box);
  } else {
    const order = day.orders.find(x => x.id === orderId);

    if (!order) {
      toast("اختر طلب الزبون");
      return;
    }

    order.boxes.push(box);
  }

  saveInventory();
  closeCheckBox();
  renderInventory();
  renderHome();

  toast("تم تسجيل الصندوق");
});

function markBoxOut(boxId, destination, orderId) {
  const day = getInventoryDay();

  let box = null;

  if (destination === "sale") {
    box = day.saleBoxes.find(x => x.id === boxId);
  } else {
    const order = day.orders.find(x => x.id === orderId);
    box = order?.boxes.find(x => x.id === boxId);
  }

  if (!box) return;

  box.status = "out";
  box.exitedAt = new Date().toISOString();

  saveInventory();
  renderInventory();
  toast("تم تسجيل خروج الصندوق");
}

document.addEventListener("click", e => {
  const checkOrder = e.target.closest("[data-check-order]");
  if (checkOrder) {
    openCheckBox("customer", checkOrder.dataset.checkOrder);
    return;
  }

  const exit = e.target.closest("[data-exit-box]");
  if (exit) {
    if (!confirm("تسجيل هذا الصندوق كخارج؟")) return;

    markBoxOut(
      exit.dataset.exitBox,
      exit.dataset.exitDestination,
      exit.dataset.exitOrder
    );
    return;
  }

  const editOrder = e.target.closest("[data-edit-order]");
  if (editOrder) {
    const day = getInventoryDay();
    const order = day.orders.find(x => x.id === editOrder.dataset.editOrder);
    if (order) openOrderForm(order);
    return;
  }

  const deleteOrder = e.target.closest("[data-delete-order]");
  if (deleteOrder) {
    const day = getInventoryDay();
    const order = day.orders.find(x => x.id === deleteOrder.dataset.deleteOrder);

    if (!order) return;

    if (!confirm(`حذف طلب ${order.customerName}؟`)) return;

    day.orders = day.orders.filter(x => x.id !== order.id);
    saveInventory();
    renderInventory();
    toast("تم حذف الطلب");
  }
});

$("#saveSaleExpected")?.addEventListener("click", () => {
  const day = getInventoryDay();

  day.saleExpectedBoxes = Math.max(
    0,
    Number($("#saleExpectedBoxes").value) || 0
  );

  saveInventory();
  renderInventory();
  toast("تم حفظ الكمية المطلوبة");
});

$("#addCustomerOrder")?.addEventListener("click", () => {
  openOrderForm();
});

$("#addSaleBox")?.addEventListener("click", () => {
  openCheckBox("sale");
});

$("#addInventoryBox")?.addEventListener("click", () => {
  openCheckBox("sale");
});

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
  if (!$("#reportPreview")) return;

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
                  <td>${r.type === "customer" ? paymentText(r.payment) : "—"}</td>
                </tr>
              `).join("")
            : `<tr><td colspan="6">لا توجد عمليات.</td></tr>`
        }
      </tbody>
    </table>

    <div class="report-footer">
      إجمالي الحبات:
      <strong>${total.toLocaleString("ar-LB")}</strong>
    </div>
  `;
}

$("#dailyReport")?.addEventListener("click", setDailyReport);
$("#fromDate")?.addEventListener("change", renderReportPreview);
$("#toDate")?.addEventListener("change", renderReportPreview);
$("#reportType")?.addEventListener("change", renderReportPreview);

$("#printReport")?.addEventListener("click", () => {
  renderReportPreview();
  setTimeout(() => window.print(), 100);
});

function loadSettingsForm() {
  $("#factoryName").value = settings.factoryName;

  const croissant = productById("croissant");
  const donut = productById("donut");

  $("#croissantBoxSize").value = croissant?.boxSize || 40;
  $("#donutBoxSize").value = donut?.boxSize || 8;
}

$("#saveSettings")?.addEventListener("click", () => {
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
  renderInventory();
  renderRecords();
  renderReportPreview();
});

$("#clearData")?.addEventListener("click", () => {
  if (!confirm(
    "هل أنت متأكد؟ سيتم حذف جميع العمليات والجرد نهائياً من هذا الجهاز."
  )) return;

  records = [];
  inventory = [];

  localStorage.removeItem(KEY);
  localStorage.removeItem(INVENTORY_KEY);
  localStorage.removeItem("croissant_store_records_v4");

  saveRecords();
  saveInventory();

  renderHome();
  renderInventory();
  renderRecords();
  renderReportPreview();

  toast("تم حذف جميع البيانات");
});

let deferredPrompt = null;

window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  deferredPrompt = e;

  if ($("#installBtn")) {
    $("#installBtn").hidden = false;
  }
});

$("#installBtn")?.addEventListener("click", async () => {
  if (!deferredPrompt) return;

  deferredPrompt.prompt();
  await deferredPrompt.userChoice;

  deferredPrompt = null;
  $("#installBtn").hidden = true;
});

if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("./sw.js").catch(console.error);
}

$("#fromDate").value = selectedDate;
$("#toDate").value = selectedDate;

loadSettingsForm();
updatePartyType();
updateFormDate();
renderHome();
renderInventory();
renderRecords();
renderReportPreview();