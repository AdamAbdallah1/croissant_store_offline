const KEY = "croissant_store_records_v4";
const SETTINGS_KEY = "croissant_store_settings_v4";

const DEFAULTS = {
  factoryName: "سجل المصنع",

  products: [
    {
      id: "cheese",
      name: "كرواسون جبنة",
      group: "croissant",
      boxSize: 40
    },
    {
      id: "chocolate",
      name: "كرواسون شوكولا",
      group: "croissant",
      boxSize: 40
    },
    {
      id: "zaatar",
      name: "كرواسون زعتر",
      group: "croissant",
      boxSize: 40
    },
    {
      id: "donut",
      name: "دونات",
      group: "donut",
      boxSize: 8
    }
  ]
};

let records = loadRecords();
let settings = loadSettings();

let selectedDate = todayKey();
let editingId = null;

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

/* =========================================================
   DATE
========================================================= */

function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
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

function formatTime(iso) {
  if (!iso) return "—";

  return new Intl.DateTimeFormat("ar-LB", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(iso));
}

/* =========================================================
   STORAGE
========================================================= */

function cloneDefaults() {
  return {
    factoryName: DEFAULTS.factoryName,

    products: DEFAULTS.products.map(product => ({
      ...product
    }))
  };
}

function loadSettings() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(SETTINGS_KEY) || "{}"
    );

    const defaults = cloneDefaults();

    return {
      ...defaults,
      ...saved,

      products:
        Array.isArray(saved.products) &&
        saved.products.length
          ? saved.products
          : defaults.products
    };
  } catch {
    return cloneDefaults();
  }
}

function saveSettings() {
  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify(settings)
  );
}

function normalizeRecord(record) {
  return {
    ...record,

    businessDate:
      record.businessDate ||
      (
        record.createdAt
          ? record.createdAt.slice(0, 10)
          : todayKey()
      ),

    boxes:
      Array.isArray(record.boxes)
        ? record.boxes
        : [],

    loose:
      Array.isArray(record.loose)
        ? record.loose
        : [],

    total:
      Number(record.total) || 0
  };
}

function loadRecords() {
  try {
    const data = JSON.parse(
      localStorage.getItem(KEY) || "[]"
    );

    if (!Array.isArray(data)) {
      return [];
    }

    return data.map(normalizeRecord);
  } catch {
    return [];
  }
}

function saveRecords() {
  localStorage.setItem(
    KEY,
    JSON.stringify(records)
  );
}

/* =========================================================
   HELPERS
========================================================= */

function esc(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[char])
  );
}

function money(value) {
  if (value === "" || value == null) {
    return "";
  }

  return Number(value).toLocaleString("en-US", {
    maximumFractionDigits: 2
  });
}

function uid(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

function toast(message) {
  const el = $("#toast");

  if (!el) return;

  el.textContent = message;
  el.classList.add("show");

  clearTimeout(window.toastTimer);

  window.toastTimer = setTimeout(() => {
    el.classList.remove("show");
  }, 2400);
}

function productById(id) {
  return (
    settings.products.find(
      product => product.id === id
    ) || null
  );
}

function productName(id) {
  return (
    productById(id)?.name ||
    "منتج غير محدد"
  );
}

function productBoxSize(id) {
  return (
    Number(productById(id)?.boxSize) ||
    40
  );
}

function productGroup(id) {
  return (
    productById(id)?.group ||
    "croissant"
  );
}

/* =========================================================
   NAVIGATION
========================================================= */

function navigate(view) {
  $$(".view").forEach(viewElement => {
    viewElement.classList.toggle(
      "active",
      viewElement.id === `view-${view}`
    );
  });

  $$(".nav-item").forEach(item => {
    item.classList.toggle(
      "active",
      item.dataset.nav === view
    );
  });

  if (view === "home") {
    renderHome();
  }

  if (view === "records") {
    renderRecords();
  }

  if (view === "reports") {
    renderReportPreview();
  }

  if (view === "settings") {
    loadSettingsForm();
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

$$("[data-nav]").forEach(button => {
  button.addEventListener("click", () => {
    navigate(button.dataset.nav);
  });
});

/* =========================================================
   DAY NAVIGATION
========================================================= */

function changeDay(amount) {
  const date = new Date(
    `${selectedDate}T12:00:00`
  );

  date.setDate(
    date.getDate() + amount
  );

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

$("#previousDay").addEventListener(
  "click",
  () => changeDay(-1)
);

$("#nextDay").addEventListener(
  "click",
  () => changeDay(1)
);

$("#selectedDate").addEventListener(
  "change",
  event => {
    setSelectedDate(
      event.target.value
    );
  }
);

$("#goToday").addEventListener(
  "click",
  () => {
    selectedDate = todayKey();

    updateFormDate();
    renderHome();
    renderRecords();
  }
);

function updateFormDate() {
  $("#formDateLabel").textContent =
    formatBusinessDate(selectedDate);
}

/* =========================================================
   PRODUCT OPTIONS
========================================================= */

function productOptions(selected = "") {
  return settings.products
    .map(product => `
      <option
        value="${esc(product.id)}"
        ${
          product.id === selected
            ? "selected"
            : ""
        }
      >
        ${esc(product.name)}
      </option>
    `)
    .join("");
}

/* =========================================================
   BOX BUILDER
========================================================= */

function addBoxItem(
  boxElement,
  productId = "",
  quantity = ""
) {
  const row =
    document.createElement("div");

  row.className =
    "box-item-row";

  row.innerHTML = `
    <select class="box-product">
      <option value="">
        اختر النوع
      </option>

      ${productOptions(productId)}
    </select>

    <input
      class="box-quantity"
      type="number"
      min="1"
      step="1"
      inputmode="numeric"
      placeholder="العدد"
      value="${esc(quantity)}"
    >

    <button
      type="button"
      class="remove-box-item"
      aria-label="حذف"
    >
      ×
    </button>
  `;

  row
    .querySelector(".box-product")
    .addEventListener(
      "change",
      () => {
        validateBoxes();
      }
    );

  row
    .querySelector(".box-quantity")
    .addEventListener(
      "input",
      () => {
        validateBoxes();
      }
    );

  row
    .querySelector(".remove-box-item")
    .addEventListener(
      "click",
      () => {
        row.remove();
        validateBoxes();
      }
    );

  boxElement
    .querySelector(".box-items")
    .appendChild(row);
}

function addBox(boxData = null) {
  const box =
    document.createElement("div");

  box.className =
    "mixed-box";

  const boxNumber =
    $("#mixedBoxes").children.length + 1;

  box.innerHTML = `
    <div class="mixed-box-header">

      <div>
        <span class="box-eyebrow">
          صندوق
        </span>

        <strong class="box-number">
          ${boxNumber}
        </strong>
      </div>

      <div class="box-header-actions">

        <button
          type="button"
          class="duplicate-box"
        >
          نسخ
        </button>

        <button
          type="button"
          class="remove-box"
        >
          حذف
        </button>

      </div>

    </div>

    <div class="box-items"></div>

    <button
      type="button"
      class="add-box-item"
    >
      ＋ إضافة نوع
    </button>

    <div class="box-total-row">

      <div>
        <span>
          مجموع الصندوق
        </span>

        <small class="box-status">
          أدخل المحتوى
        </small>
      </div>

      <strong>
        <span class="box-total">
          0
        </span>
        /
        <span class="box-max">
          40
        </span>
        حبة
      </strong>

    </div>
  `;

  $("#mixedBoxes").appendChild(box);

  box
    .querySelector(".remove-box")
    .addEventListener(
      "click",
      () => {
        box.remove();

        renumberBoxes();
        validateBoxes();
      }
    );

  box
    .querySelector(".duplicate-box")
    .addEventListener(
      "click",
      () => {
        const source =
          readSingleBox(box);

        addBox({
          items: source.items
        });
      }
    );

  box
    .querySelector(".add-box-item")
    .addEventListener(
      "click",
      () => {
        addBoxItem(box);
        validateBoxes();
      }
    );

  if (
    boxData &&
    Array.isArray(boxData.items) &&
    boxData.items.length
  ) {
    boxData.items.forEach(item => {
      addBoxItem(
        box,
        item.productId,
        item.quantity
      );
    });
  } else {
    addBoxItem(box);
  }

  updateBoxUI(box);
  validateBoxes();
}

function renumberBoxes() {
  $$("#mixedBoxes .mixed-box")
    .forEach((box, index) => {
      box.querySelector(
        ".box-number"
      ).textContent = index + 1;
    });
}

function readSingleBox(box) {
  const items = [];

  box
    .querySelectorAll(".box-item-row")
    .forEach(row => {
      const productId =
        row.querySelector(
          ".box-product"
        ).value;

      const quantity =
        Math.max(
          0,
          Number(
            row.querySelector(
              ".box-quantity"
            ).value
          ) || 0
        );

      if (
        productId &&
        quantity > 0
      ) {
        items.push({
          productId,
          quantity
        });
      }
    });

  return {
    items
  };
}

function getBoxData() {
  return $$("#mixedBoxes .mixed-box")
    .map(box => {
      const data =
        readSingleBox(box);

      const firstProduct =
        data.items[0]?.productId || null;

      return {
        id: uid("box"),
        productId: firstProduct,
        boxSize: firstProduct
          ? productBoxSize(firstProduct)
          : 40,
        items: data.items,
        total: data.items.reduce(
          (sum, item) =>
            sum +
            Number(item.quantity || 0),
          0
        )
      };
    });
}

function calculateBoxTotal(box) {
  return [
    ...box.querySelectorAll(
      ".box-quantity"
    )
  ].reduce(
    (sum, input) =>
      sum +
      Math.max(
        0,
        Number(input.value) || 0
      ),
    0
  );
}

function maxBoxSizeForBox(box) {
  const selectedProducts = [
    ...box.querySelectorAll(
      ".box-product"
    )
  ]
    .map(select => select.value)
    .filter(Boolean);

  if (!selectedProducts.length) {
    return 40;
  }

  const groups = [
    ...new Set(
      selectedProducts.map(
        productGroup
      )
    )
  ];

  if (groups.length > 1) {
    return null;
  }

  return productBoxSize(
    selectedProducts[0]
  );
}

function updateBoxUI(box) {
  const total =
    calculateBoxTotal(box);

  const max =
    maxBoxSizeForBox(box);

  const totalElement =
    box.querySelector(
      ".box-total"
    );

  const maxElement =
    box.querySelector(
      ".box-max"
    );

  const statusElement =
    box.querySelector(
      ".box-status"
    );

  totalElement.textContent =
    total.toLocaleString("ar-LB");

  if (max) {
    maxElement.textContent =
      max.toLocaleString("ar-LB");
  } else {
    maxElement.textContent =
      "—";
  }

  if (!total) {
    statusElement.textContent =
      "أدخل المحتوى";
  } else if (max === null) {
    statusElement.textContent =
      "منتجات غير متوافقة";
  } else if (total > max) {
    statusElement.textContent =
      `تجاوز الحد بـ ${total - max}`;
  } else if (total === max) {
    statusElement.textContent =
      "صندوق ممتلئ";
  } else {
    statusElement.textContent =
      `متبقي ${max - total} حبة`;
  }
}

function validateBoxes() {
  let total = 0;
  let valid = true;
  let message = "";

  $$("#mixedBoxes .mixed-box")
    .forEach(box => {
      const boxTotal =
        calculateBoxTotal(box);

      const max =
        maxBoxSizeForBox(box);

      const selectedProducts = [
        ...box.querySelectorAll(
          ".box-product"
        )
      ]
        .map(select => select.value)
        .filter(Boolean);

      const duplicateProducts =
        selectedProducts.filter(
          (id, index) =>
            selectedProducts.indexOf(id) !==
            index
        );

      if (
        duplicateProducts.length
      ) {
        valid = false;

        message =
          "لا تكرر نفس النوع داخل الصندوق.";
      }

      if (max === null) {
        valid = false;

        message =
          "لا يمكن خلط الكرواسون والدونات في نفس الصندوق.";
      }

      if (
        max &&
        boxTotal > max
      ) {
        valid = false;

        message =
          `الصندوق يحتوي ${boxTotal} حبة، والحد الأقصى ${max} حبة.`;
      }

      total += boxTotal;

      updateBoxUI(box);

      box.classList.toggle(
        "box-invalid",
        Boolean(
          duplicateProducts.length ||
          max === null ||
          (
            max &&
            boxTotal > max
          )
        )
      );
    });

  $$("#looseProducts .loose-product-row")
    .forEach(row => {
      const quantity =
        Math.max(
          0,
          Number(
            row.querySelector(
              ".loose-quantity"
            ).value
          ) || 0
        );

      total += quantity;
    });

  $("#orderTotal").textContent =
    total.toLocaleString("ar-LB");

  $("#boxValidationMessage")
    .textContent = message;

  $("#boxValidationMessage")
    .hidden = !message;

  return {
    valid,
    total,
    message
  };
}

/* =========================================================
   LOOSE PRODUCTS
========================================================= */

function addLooseProduct(
  productId = "",
  quantity = ""
) {
  const row =
    document.createElement("div");

  row.className =
    "loose-product-row";

  row.innerHTML = `
    <select class="loose-product">

      <option value="">
        اختر النوع
      </option>

      ${productOptions(productId)}

    </select>

    <input
      class="loose-quantity"
      type="number"
      min="1"
      step="1"
      inputmode="numeric"
      placeholder="عدد الحبات"
      value="${esc(quantity)}"
    >

    <button
      type="button"
      class="remove-loose-product"
    >
      ×
    </button>
  `;

  row
    .querySelector(
      ".loose-product"
    )
    .addEventListener(
      "change",
      () => {
        validateLooseProducts();
      }
    );

  row
    .querySelector(
      ".loose-quantity"
    )
    .addEventListener(
      "input",
      () => {
        validateLooseProducts();
      }
    );

  row
    .querySelector(
      ".remove-loose-product"
    )
    .addEventListener(
      "click",
      () => {
        row.remove();
        validateLooseProducts();
      }
    );

  $("#looseProducts")
    .appendChild(row);

  validateLooseProducts();
}

function validateLooseProducts() {
  const selected = [];

  $$("#looseProducts .loose-product-row")
    .forEach(row => {
      const product =
        row.querySelector(
          ".loose-product"
        ).value;

      if (product) {
        selected.push(product);
      }
    });

  const duplicates =
    selected.filter(
      (id, index) =>
        selected.indexOf(id) !==
        index
    );

  if (duplicates.length) {
    $("#looseValidationMessage")
      .textContent =
      "لا تكرر نفس النوع في الحبات المفردة.";

    $("#looseValidationMessage")
      .hidden = false;

    return false;
  }

  $("#looseValidationMessage")
    .hidden = true;

  validateBoxes();

  return true;
}

/* =========================================================
   NEW RECORD
========================================================= */

function openNewRecord() {
  editingId = null;

  $("#formTitle").textContent =
    "تسجيل خروج";

  $("#formEyebrow").textContent =
    "عملية جديدة";

  $("#saveRecordBtn").textContent =
    "حفظ العملية";

  resetForm();

  addBox();

  navigate("new");
}

/*
  THIS WAS MISSING.
  It connects all buttons with data-new-record
  to openNewRecord().
*/

$$("[data-new-record]")
  .forEach(button => {
    button.addEventListener(
      "click",
      openNewRecord
    );
  });

/* =========================================================
   EDIT RECORD
========================================================= */

function openEditRecord(id) {
  const record =
    records.find(
      record => record.id === id
    );

  if (!record) return;

  editingId = id;

  selectedDate =
    record.businessDate;

  $("#formTitle").textContent =
    "تعديل العملية";

  $("#formEyebrow").textContent =
    "تعديل محفوظ";

  $("#saveRecordBtn").textContent =
    "حفظ التعديل";

  $(
    'input[name="type"][value="customer"]'
  ).checked =
    record.type === "customer";

  $(
    'input[name="type"][value="hall"]'
  ).checked =
    record.type === "hall";

  $("#partyName").value =
    record.type === "hall"
      ? "صالة"
      : record.partyName || "";

  $("#mixedBoxes").innerHTML =
    "";

  if (
    Array.isArray(record.boxes) &&
    record.boxes.length
  ) {
    record.boxes.forEach(box => {
      addBox(box);
    });
  }

  $("#looseProducts").innerHTML =
    "";

  if (
    Array.isArray(record.loose) &&
    record.loose.length
  ) {
    record.loose.forEach(item => {
      addLooseProduct(
        item.productId,
        item.quantity
      );
    });
  }

  if (record.payment) {
    const payment =
      $(
        `input[name="payment"][value="${record.payment}"]`
      );

    if (payment) {
      payment.checked = true;
    }
  }

  $("#amount").value =
    record.amount || "";

  $("#notes").value =
    record.notes || "";

  updatePartyType();
  updateFormDate();
  validateBoxes();

  navigate("new");
}

/* =========================================================
   ADD BOX / LOOSE BUTTONS
========================================================= */

$("#addBoxBtn").addEventListener(
  "click",
  () => {
    addBox();
  }
);

$("#addLooseProductBtn")
  .addEventListener(
    "click",
    () => {
      addLooseProduct();
    }
  );

/* =========================================================
   FORM SUBMIT
========================================================= */

$("#recordForm").addEventListener(
  "submit",
  event => {
    event.preventDefault();

    const type =
      $(
        'input[name="type"]:checked'
      ).value;

    const partyName =
      type === "hall"
        ? "صالة"
        : $("#partyName")
            .value
            .trim();

    if (
      type === "customer" &&
      !partyName
    ) {
      toast("أدخل اسم الزبون");

      $("#partyName").focus();

      return;
    }

    const validation =
      validateBoxes();

    if (!validation.valid) {
      toast(
        validation.message ||
        "صحح محتوى الصناديق أولاً"
      );

      return;
    }

    if (
      !validateLooseProducts()
    ) {
      toast(
        "صحح الحبات المفردة أولاً"
      );

      return;
    }

    const boxes =
      getBoxData();

    const loose = [];

    $$("#looseProducts .loose-product-row")
      .forEach(row => {
        const productId =
          row.querySelector(
            ".loose-product"
          ).value;

        const quantity =
          Math.max(
            0,
            Number(
              row.querySelector(
                ".loose-quantity"
              ).value
            ) || 0
          );

        if (
          productId &&
          quantity > 0
        ) {
          loose.push({
            id: uid("loose"),
            productId,
            quantity
          });
        }
      });

    const hasBoxItems =
      boxes.some(
        box =>
          box.items.length > 0
      );

    const hasLooseItems =
      loose.length > 0;

    if (
      !hasBoxItems &&
      !hasLooseItems
    ) {
      toast(
        "أدخل المنتجات والكمية"
      );

      return;
    }

    const payment =
      type === "customer"
        ? $(
            'input[name="payment"]:checked'
          ).value
        : null;

    const amount =
      type === "customer" &&
      payment !== "unpaid"
        ? $("#amount").value
        : "";

    const now =
      new Date().toISOString();

    if (editingId) {
      const record =
        records.find(
          record =>
            record.id ===
            editingId
        );

      if (!record) {
        toast(
          "لم يتم العثور على العملية"
        );

        return;
      }

      record.businessDate =
        selectedDate;

      record.type =
        type;

      record.partyName =
        partyName;

      record.boxes =
        boxes;

      record.loose =
        loose;

      record.total =
        validation.total;

      record.payment =
        payment;

      record.amount =
        amount;

      record.notes =
        $("#notes")
          .value
          .trim();

      record.updatedAt =
        now;

      toast(
        "تم تعديل العملية"
      );
    } else {
      records.unshift({
        id: uid("record"),

        businessDate:
          selectedDate,

        createdAt:
          now,

        type,

        partyName,

        boxes,

        loose,

        total:
          validation.total,

        payment,

        amount,

        notes:
          $("#notes")
            .value
            .trim()
      });

      toast(
        "تم حفظ العملية"
      );
    }

    saveRecords();

    editingId = null;

    resetForm();

    navigate("home");
  }
);

/* =========================================================
   PARTY TYPE
========================================================= */

function updatePartyType() {
  const selectedType =
    $(
      'input[name="type"]:checked'
    );

  if (!selectedType) {
    return;
  }

  const type =
    selectedType.value;

  const isHall =
    type === "hall";

  $("#customerNameField")
    .hidden = isHall;

  $("#hallSelected")
    .hidden = !isHall;

  $("#paymentSection")
    .hidden = isHall;

  if (isHall) {
    $("#partyName").value =
      "صالة";

    $("#partyName")
      .removeAttribute(
        "required"
      );
  } else {
    if (!editingId) {
      $("#partyName").value =
        "";
    }

    $("#partyName")
      .setAttribute(
        "required",
        ""
      );
  }

  const payment =
    $(
      'input[name="payment"]:checked'
    )?.value || "cash";

  $("#amountField")
    .hidden =
    payment === "unpaid";
}

$$('input[name="type"]')
  .forEach(input => {
    input.addEventListener(
      "change",
      updatePartyType
    );
  });

$$('input[name="payment"]')
  .forEach(input => {
    input.addEventListener(
      "change",
      () => {
        $("#amountField")
          .hidden =
          input.value ===
          "unpaid";
      }
    );
  });

/* =========================================================
   RESET FORM
========================================================= */

function resetForm() {
  $("#recordForm").reset();

  $("#mixedBoxes").innerHTML =
    "";

  $("#looseProducts")
    .innerHTML = "";

  $(
    'input[name="type"][value="customer"]'
  ).checked = true;

  $(
    'input[name="payment"][value="cash"]'
  ).checked = true;

  $("#amount").value =
    "";

  $("#notes").value =
    "";

  updatePartyType();
  updateFormDate();

  $("#formTitle").textContent =
    "تسجيل خروج";

  $("#formEyebrow").textContent =
    "عملية جديدة";

  $("#saveRecordBtn").textContent =
    "حفظ العملية";

  $("#orderTotal").textContent =
    "0";

  $("#boxValidationMessage")
    .hidden = true;

  $("#looseValidationMessage")
    .hidden = true;
}

/* =========================================================
   RECORD DISPLAY
========================================================= */

function boxDetailsText(box) {
  if (
    !box ||
    !Array.isArray(
      box.items
    ) ||
    !box.items.length
  ) {
    return "فارغ";
  }

  return box.items
    .map(
      item =>
        `${productName(
          item.productId
        )}: ${Number(
          item.quantity || 0
        )}`
    )
    .join(" · ");
}

function looseDetailsText(record) {
  if (
    !Array.isArray(
      record.loose
    ) ||
    !record.loose.length
  ) {
    return "";
  }

  return record.loose
    .map(
      item =>
        `${productName(
          item.productId
        )}: ${Number(
          item.quantity || 0
        )}`
    )
    .join(" · ");
}

function orderCompositionText(record) {
  const totals = {};

  (
    record.boxes || []
  ).forEach(box => {
    (
      box.items || []
    ).forEach(item => {
      totals[item.productId] =
        (
          totals[item.productId] ||
          0
        ) +
        Number(
          item.quantity || 0
        );
    });
  });

  (
    record.loose || []
  ).forEach(item => {
    totals[item.productId] =
      (
        totals[item.productId] ||
        0
      ) +
      Number(
        item.quantity || 0
      );
  });

  return Object.entries(
    totals
  )
    .map(
      ([productId, quantity]) =>
        `${productName(
          productId
        )}: ${quantity}`
    )
    .join(" · ");
}

function paymentText(payment) {
  if (payment === "cash") {
    return "نقداً";
  }

  if (payment === "whish") {
    return "Whish Money";
  }

  if (payment === "unpaid") {
    return "غير مدفوع";
  }

  return "—";
}

function card(record) {
  const boxes =
    record.boxes || [];

  const loose =
    record.loose || [];

  return `
    <article class="record-card">

      <div class="record-top">

        <div>

          <div class="record-name">

            ${esc(
              record.partyName
            )}

            <span class="pill">

              ${
                record.type ===
                "customer"
                  ? "زبون"
                  : "صالة"
              }

            </span>

          </div>

          <div class="record-meta">

            ${formatTime(
              record.createdAt
            )}

            ·

            ${formatShortDate(
              record.businessDate
            )}

          </div>

        </div>

        <div class="record-total">

          ${Number(
            record.total || 0
          ).toLocaleString(
            "ar-LB"
          )}

          <small>
            حبة
          </small>

        </div>

      </div>

      <div class="record-details">

        <div class="composition-summary">

          <b>الطلب:</b>

          ${esc(
            orderCompositionText(
              record
            ) || "—"
          )}

        </div>

        ${
          boxes.length
            ? `
              <div class="record-boxes">

                <b>
                  الصناديق:
                </b>

                ${boxes
                  .map(
                    (
                      box,
                      index
                    ) => `
                      <div class="saved-box">

                        <strong>
                          صندوق ${
                            index + 1
                          }
                        </strong>

                        <span>
                          ${esc(
                            boxDetailsText(
                              box
                            )
                          )}
                        </span>

                      </div>
                    `
                  )
                  .join("")}

              </div>
            `
            : ""
        }

        ${
          loose.length
            ? `
              <div class="saved-loose">

                <b>
                  حبات خارج الصندوق:
                </b>

                ${esc(
                  looseDetailsText(
                    record
                  )
                )}

              </div>
            `
            : ""
        }

        ${
          record.type ===
          "customer"
            ? `
              <div>

                <b>
                  الدفع:
                </b>

                ${paymentText(
                  record.payment
                )}

                ${
                  record.amount
                    ? ` · ${money(
                        record.amount
                      )}`
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

                <b>
                  ملاحظات:
                </b>

                ${esc(
                  record.notes
                )}

              </div>
            `
            : ""
        }

        <div class="record-actions">

          <button
            type="button"
            class="edit-record"
            data-edit-id="${esc(
              record.id
            )}"
          >
            تعديل
          </button>

          <button
            type="button"
            class="delete-record"
            data-delete-id="${esc(
              record.id
            )}"
          >
            حذف
          </button>

        </div>

      </div>

    </article>
  `;
}

/* =========================================================
   HOME
========================================================= */

function dayRecords(
  date = selectedDate
) {
  return records
    .filter(
      record =>
        record.businessDate ===
        date
    )
    .sort(
      (a, b) =>
        new Date(
          b.createdAt
        ) -
        new Date(
          a.createdAt
        )
    );
}

function renderHome() {
  const list =
    dayRecords();

  $("#selectedDate").value =
    selectedDate;

  $("#dayLabel").textContent =
    formatBusinessDate(
      selectedDate
    );

  $("#todayTotal").textContent =
    list
      .reduce(
        (sum, record) =>
          sum +
          Number(
            record.total || 0
          ),
        0
      )
      .toLocaleString(
        "ar-LB"
      );

  $("#todayCount")
    .textContent =
    list.length.toLocaleString(
      "ar-LB"
    );

  $("#todayCustomers")
    .textContent =
    list
      .filter(
        record =>
          record.type ===
          "customer"
      )
      .length
      .toLocaleString(
        "ar-LB"
      );

  $("#todayHalls")
    .textContent =
    list
      .filter(
        record =>
          record.type ===
          "hall"
      )
      .length
      .toLocaleString(
        "ar-LB"
      );

  $("#recentRecords")
    .innerHTML =
    list
      .slice(0, 5)
      .map(card)
      .join("") ||
    `
      <div class="empty">
        لا توجد عمليات في هذا اليوم.
      </div>
    `;
}

/* =========================================================
   RECORDS
========================================================= */

function renderRecords() {
  const query =
    $("#searchInput")
      .value
      .trim()
      .toLowerCase();

  const type =
    $("#typeFilter").value;

  const list =
    dayRecords().filter(
      record => {
        const searchText =
          [
            record.partyName,
            record.notes,
            orderCompositionText(
              record
            )
          ]
            .join(" ")
            .toLowerCase();

        const matchesSearch =
          !query ||
          searchText.includes(
            query
          );

        const matchesType =
          type === "all" ||
          record.type === type;

        return (
          matchesSearch &&
          matchesType
        );
      }
    );

  $("#recordsDateLabel")
    .textContent =
    formatBusinessDate(
      selectedDate
    );

  $("#recordsList")
    .innerHTML =
    list
      .map(card)
      .join("") ||
    `
      <div class="empty">
        لا توجد نتائج لهذا اليوم.
      </div>
    `;
}

$("#searchInput").addEventListener(
  "input",
  renderRecords
);

$("#typeFilter").addEventListener(
  "change",
  renderRecords
);

/* =========================================================
   EDIT / DELETE
========================================================= */

document.addEventListener(
  "click",
  event => {
    const editButton =
      event.target.closest(
        "[data-edit-id]"
      );

    if (editButton) {
      openEditRecord(
        editButton.dataset.editId
      );

      return;
    }

    const deleteButton =
      event.target.closest(
        "[data-delete-id]"
      );

    if (!deleteButton) {
      return;
    }

    const record =
      records.find(
        record =>
          record.id ===
          deleteButton.dataset
            .deleteId
      );

    if (!record) {
      return;
    }

    const confirmed =
      confirm(
        `حذف عملية ${
          record.partyName
        } — ${
          record.total
        } حبة؟\n\nلا يمكن التراجع عن هذا الحذف.`
      );

    if (!confirmed) {
      return;
    }

    records =
      records.filter(
        record =>
          record.id !==
          deleteButton.dataset
            .deleteId
      );

    saveRecords();

    renderHome();
    renderRecords();
    renderReportPreview();

    toast(
      "تم حذف العملية"
    );
  }
);

/* =========================================================
   REPORTS
========================================================= */

function filteredReport(
  from,
  to,
  type
) {
  return records
    .filter(record => {
      const date =
        record.businessDate;

      return (
        (!from ||
          date >= from) &&
        (!to ||
          date <= to) &&
        (
          type === "all" ||
          record.type === type
        )
      );
    })
    .sort(
      (a, b) =>
        a.businessDate.localeCompare(
          b.businessDate
        ) ||
        new Date(
          a.createdAt
        ) -
        new Date(
          b.createdAt
        )
    );
}

function setDailyReport() {
  $("#fromDate").value =
    selectedDate;

  $("#toDate").value =
    selectedDate;

  renderReportPreview();
}

function renderReportPreview() {
  const from =
    $("#fromDate").value;

  const to =
    $("#toDate").value;

  const type =
    $("#reportType").value;

  const list =
    filteredReport(
      from,
      to,
      type
    );

  const total =
    list.reduce(
      (sum, record) =>
        sum +
        Number(
          record.total || 0
        ),
      0
    );

  const customers =
    list.filter(
      record =>
        record.type ===
        "customer"
    );

  const halls =
    list.filter(
      record =>
        record.type ===
        "hall"
    );

  const customerTotal =
    customers.reduce(
      (sum, record) =>
        sum +
        Number(
          record.total || 0
        ),
      0
    );

  const hallTotal =
    halls.reduce(
      (sum, record) =>
        sum +
        Number(
          record.total || 0
        ),
      0
    );

  const productTotals =
    {};

  list.forEach(record => {
    (
      record.boxes || []
    ).forEach(box => {
      (
        box.items || []
      ).forEach(item => {
        productTotals[
          item.productId
        ] =
          (
            productTotals[
              item.productId
            ] || 0
          ) +
          Number(
            item.quantity || 0
          );
      });
    });

    (
      record.loose || []
    ).forEach(item => {
      productTotals[
        item.productId
      ] =
        (
          productTotals[
            item.productId
          ] || 0
        ) +
        Number(
          item.quantity || 0
        );
    });
  });

  const title =
    from &&
    to &&
    from === to
      ? "تقرير يومي"
      : "تقرير فترة";

  let dateText =
    "—";

  if (
    from &&
    to &&
    from === to
  ) {
    dateText =
      formatBusinessDate(
        from
      );
  } else if (
    from &&
    to
  ) {
    dateText =
      `${formatShortDate(
        from
      )} — ${formatShortDate(
        to
      )}`;
  } else if (from) {
    dateText =
      `من ${formatShortDate(
        from
      )}`;
  } else if (to) {
    dateText =
      `حتى ${formatShortDate(
        to
      )}`;
  }

  $("#reportPreview")
    .innerHTML = `

    <div class="print-header">

      <h2>
        ${esc(
          settings.factoryName
        )}
      </h2>

      <h3>
        ${title}
      </h3>

      <p>
        ${dateText}
      </p>

    </div>

    <div class="report-summary-grid">

      <div>
        <span>
          العمليات
        </span>

        <strong>
          ${list.length}
        </strong>
      </div>

      <div>
        <span>
          إجمالي الحبات
        </span>

        <strong>
          ${total.toLocaleString(
            "ar-LB"
          )}
        </strong>
      </div>

      <div>
        <span>
          الزبائن
        </span>

        <strong>
          ${customerTotal.toLocaleString(
            "ar-LB"
          )}
        </strong>
      </div>

      <div>
        <span>
          الصالة
        </span>

        <strong>
          ${hallTotal.toLocaleString(
            "ar-LB"
          )}
        </strong>
      </div>

    </div>

    <div class="report-products">

      <h3>
        إجمالي المنتجات
      </h3>

      ${
        Object.entries(
          productTotals
        )
          .map(
            ([id, quantity]) => `
              <div
                class="report-product-row"
              >

                <span>
                  ${esc(
                    productName(id)
                  )}
                </span>

                <strong>
                  ${Number(
                    quantity
                  ).toLocaleString(
                    "ar-LB"
                  )}
                  حبة
                </strong>

              </div>
            `
          )
          .join("") ||
        `
          <div class="empty">
            لا توجد منتجات.
          </div>
        `
      }

    </div>

    <table class="report-table">

      <thead>

        <tr>
          <th>
            التاريخ
          </th>

          <th>
            الجهة
          </th>

          <th>
            النوع
          </th>

          <th>
            الصناديق
          </th>

          <th>
            الكمية
          </th>

          <th>
            المنتجات
          </th>

          <th>
            الدفع
          </th>
        </tr>

      </thead>

      <tbody>

        ${
          list
            .map(
              record => `
                <tr>

                  <td>
                    ${formatShortDate(
                      record.businessDate
                    )}
                  </td>

                  <td>
                    ${esc(
                      record.partyName
                    )}
                  </td>

                  <td>
                    ${
                      record.type ===
                      "customer"
                        ? "زبون"
                        : "صالة"
                    }
                  </td>

                  <td>
                    ${
                      (
                        record.boxes ||
                        []
                      ).length
                    }
                  </td>

                  <td>
                    ${Number(
                      record.total || 0
                    ).toLocaleString(
                      "ar-LB"
                    )}
                  </td>

                  <td>
                    ${esc(
                      orderCompositionText(
                        record
                      ) || "—"
                    )}
                  </td>

                  <td>
                    ${
                      record.type ===
                      "customer"
                        ? paymentText(
                            record.payment
                          )
                        : "—"
                    }
                  </td>

                </tr>
              `
            )
            .join("") ||
          `
            <tr>

              <td colspan="7">
                لا توجد عمليات.
              </td>

            </tr>
          `
        }

      </tbody>

    </table>

    ${
      list.length
        ? `
          <div class="report-box-details">

            <h3>
              تفاصيل الصناديق
            </h3>

            ${list
              .map(
                record => `
                  <div
                    class="report-record-detail"
                  >

                    <strong>
                      ${esc(
                        record.partyName
                      )}
                    </strong>

                    <span>
                      ${formatShortDate(
                        record.businessDate
                      )}
                    </span>

                    <div>
                      ${
                        (
                          record.boxes ||
                          []
                        )
                          .map(
                            (
                              box,
                              index
                            ) => `
                              <div>
                                صندوق ${
                                  index + 1
                                }:
                                ${esc(
                                  boxDetailsText(
                                    box
                                  )
                                )}
                              </div>
                            `
                          )
                          .join("")
                      }
                    </div>

                  </div>
                `
              )
              .join("")}

          </div>
        `
        : ""
    }

    <div class="report-footer">

      إجمالي الحبات:

      <strong>
        ${total.toLocaleString(
          "ar-LB"
        )}
      </strong>

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

/* =========================================================
   SETTINGS
========================================================= */

function loadSettingsForm() {
  $("#factoryName").value =
    settings.factoryName;
}

$("#saveSettings").addEventListener(
  "click",
  () => {
    settings.factoryName =
      $("#factoryName")
        .value
        .trim() ||
      "سجل المصنع";

    saveSettings();

    toast(
      "تم حفظ الإعدادات"
    );

    renderHome();
    renderRecords();
    renderReportPreview();
  }
);

$("#clearData").addEventListener(
  "click",
  () => {
    const confirmed =
      confirm(
        "هل أنت متأكد؟ سيتم حذف جميع العمليات نهائياً من هذا الجهاز."
      );

    if (!confirmed) {
      return;
    }

    records = [];

    saveRecords();

    renderHome();
    renderRecords();
    renderReportPreview();

    toast(
      "تم حذف جميع العمليات"
    );
  }
);

/* =========================================================
   PWA
========================================================= */

let deferredPrompt = null;

window.addEventListener(
  "beforeinstallprompt",
  event => {
    event.preventDefault();

    deferredPrompt =
      event;

    $("#installBtn").hidden =
      false;
  }
);

$("#installBtn").addEventListener(
  "click",
  async () => {
    if (!deferredPrompt) {
      return;
    }

    deferredPrompt.prompt();

    await deferredPrompt.userChoice;

    deferredPrompt = null;

    $("#installBtn").hidden =
      true;
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

/* =========================================================
   START
========================================================= */

$("#fromDate").value =
  selectedDate;

$("#toDate").value =
  selectedDate;

loadSettingsForm();

updatePartyType();

updateFormDate();

renderHome();

renderRecords();

renderReportPreview();