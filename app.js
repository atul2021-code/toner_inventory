"use strict";

/* ==========================================================================
   Storage layer
   All data lives in localStorage under one key. Shape:
   { toners: [...], transactions: [...], nextTonerId: N, nextTxId: N }
   ========================================================================== */
const STORAGE_KEY = "tonerLedger.v1";

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { toners: [], transactions: [], nextTonerId: 1, nextTxId: 1 };
    const parsed = JSON.parse(raw);
    return {
      toners: Array.isArray(parsed.toners) ? parsed.toners : [],
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      nextTonerId: parsed.nextTonerId || 1,
      nextTxId: parsed.nextTxId || 1,
    };
  } catch (e) {
    console.error("Could not read saved data, starting fresh.", e);
    return { toners: [], transactions: [], nextTonerId: 1, nextTxId: 1 };
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DB));
}

let DB = loadData();

/* ==========================================================================
   Helpers
   ========================================================================== */
function nowStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function money(n) {
  return (Number(n) || 0).toFixed(2);
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function toastMsg(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastMsg._t);
  toastMsg._t = setTimeout(() => { el.hidden = true; }, 2600);
}

function flashRow(id) {
  requestAnimationFrame(() => {
    const row = document.querySelector(`tr[data-id="${id}"]`);
    if (row) {
      row.classList.remove("row-flash");
      void row.offsetWidth; // restart animation
      row.classList.add("row-flash");
    }
  });
}

const COLOR_HEX = {
  Black: "#16191C", Cyan: "#0E6E86", Magenta: "#B01358", Yellow: "#C8940A", Other: "#8A8F94",
};

/* ==========================================================================
   Data operations (mirrors the desktop app's TonerInventory class)
   ========================================================================== */
function activeToners() {
  return DB.toners.filter((t) => t.is_active);
}

function getToner(id) {
  return DB.toners.find((t) => t.id === id) || null;
}

function addToner(fields) {
  const toner = {
    id: DB.nextTonerId++,
    name: fields.name,
    brand: fields.brand || "",
    model_number: fields.model_number || "",
    color: fields.color || "Black",
    printer_compatible: fields.printer_compatible || "",
    quantity: fields.quantity || 0,
    min_threshold: fields.min_threshold || 0,
    unit_price: fields.unit_price || 0,
    supplier: fields.supplier || "",
    location: fields.location || "",
    date_added: nowStamp(),
    is_active: true,
  };
  DB.toners.push(toner);
  if (toner.quantity) {
    logTransaction(toner.id, "IN", toner.quantity, "Initial stock on creation");
  }
  saveData();
  return toner;
}

function updateToner(id, fields) {
  const t = getToner(id);
  if (!t) throw new Error("Toner not found.");
  Object.assign(t, fields);
  saveData();
}

function deleteToner(id) {
  const t = getToner(id);
  if (!t) throw new Error("Toner not found.");
  t.is_active = false;
  saveData();
}

function restock(id, qty, notes) {
  const t = getToner(id);
  if (!t) throw new Error("Toner not found.");
  if (qty <= 0) throw new Error("Restock quantity must be positive.");
  t.quantity += qty;
  logTransaction(id, "IN", qty, notes || "Restock");
  saveData();
}

function useToner(id, qty, notes) {
  const t = getToner(id);
  if (!t) throw new Error("Toner not found.");
  if (qty <= 0) throw new Error("Usage quantity must be positive.");
  if (t.quantity < qty) throw new Error(`Not enough stock. Available: ${t.quantity}, requested: ${qty}`);
  t.quantity -= qty;
  logTransaction(id, "OUT", qty, notes || "Usage");
  saveData();
}

function logTransaction(tonerId, txType, qty, notes) {
  DB.transactions.push({
    id: DB.nextTxId++,
    toner_id: tonerId,
    tx_type: txType,
    quantity: qty,
    tx_date: nowStamp(),
    notes: notes || "",
  });
}

function lowStock() {
  return activeToners().filter((t) => t.quantity <= t.min_threshold)
    .sort((a, b) => a.quantity - b.quantity);
}

function outOfStock() {
  return activeToners().filter((t) => t.quantity <= 0);
}

function searchToners(kw) {
  const k = kw.trim().toLowerCase();
  if (!k) return activeToners();
  return activeToners().filter((t) =>
    [t.name, t.brand, t.model_number, t.printer_compatible, t.color]
      .some((f) => (f || "").toLowerCase().includes(k))
  );
}

function transactionsFor(tonerId, startDate, endDate) {
  let rows = DB.transactions.map((tx) => ({
    ...tx,
    toner_name: (getToner(tx.toner_id) || {}).name || "(removed toner)",
  }));
  if (tonerId) rows = rows.filter((r) => r.toner_id === tonerId);
  if (startDate) rows = rows.filter((r) => r.tx_date >= `${startDate} 00:00:00`);
  if (endDate) rows = rows.filter((r) => r.tx_date <= `${endDate} 23:59:59`);
  return rows.sort((a, b) => (a.tx_date < b.tx_date ? 1 : -1));
}

function totals() {
  const toners = activeToners();
  const totalUnits = toners.reduce((s, t) => s + t.quantity, 0);
  const totalValue = toners.reduce((s, t) => s + t.quantity * t.unit_price, 0);
  return { totalSkus: toners.length, totalUnits, totalValue };
}

/* ==========================================================================
   CSV export
   ========================================================================== */
function toCsv(headers, rows) {
  const esc1 = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.map(esc1).join(","), ...rows.map((r) => r.map(esc1).join(","))].join("\r\n");
}

function downloadBlob(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function downloadCsv(filename, csv) {
  downloadBlob(filename, csv, "text/csv;charset=utf-8;");
}

function todayStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function exportInventoryCsv() {
  const rows = activeToners();
  const headers = ["ID", "Name", "Brand", "Model", "Color", "Printer(s)", "Qty On Hand",
    "Reorder Threshold", "Unit Price", "Total Value", "Supplier", "Location", "Date Added"];
  const data = rows.map((r) => [r.id, r.name, r.brand, r.model_number, r.color,
    r.printer_compatible, r.quantity, r.min_threshold, money(r.unit_price),
    money(r.quantity * r.unit_price), r.supplier, r.location, r.date_added]);
  downloadCsv(`full_inventory_${todayStr()}.csv`, toCsv(headers, data));
  toastMsg(`Exported ${rows.length} item(s).`);
}

function exportLowStockCsv() {
  const rows = lowStock();
  const headers = ["ID", "Name", "Brand", "Model", "Color", "Printer(s)", "Qty On Hand",
    "Reorder Threshold", "Unit Price", "Supplier", "Location"];
  const data = rows.map((r) => [r.id, r.name, r.brand, r.model_number, r.color,
    r.printer_compatible, r.quantity, r.min_threshold, money(r.unit_price), r.supplier, r.location]);
  downloadCsv(`low_stock_report_${todayStr()}.csv`, toCsv(headers, data));
  toastMsg(`Exported ${rows.length} low-stock item(s).`);
}

function exportHistoryCsv(tonerId, start, end) {
  const rows = transactionsFor(tonerId, start, end);
  const headers = ["Tx ID", "Toner", "Type", "Quantity", "Date", "Notes"];
  const data = rows.map((r) => [r.id, r.toner_name, r.tx_type, r.quantity, r.tx_date, r.notes]);
  downloadCsv(`usage_history_${todayStr()}.csv`, toCsv(headers, data));
  toastMsg(`Exported ${rows.length} record(s).`);
}

/* ---- Full backup (JSON) — captures everything exactly, for restore ---- */
function exportBackupJson() {
  const payload = {
    app: "toner-ledger",
    version: 1,
    exportedAt: nowStamp(),
    toners: DB.toners,
    transactions: DB.transactions,
    nextTonerId: DB.nextTonerId,
    nextTxId: DB.nextTxId,
  };
  downloadBlob(`toner_ledger_backup_${todayStr()}.json`, JSON.stringify(payload, null, 2), "application/json");
  toastMsg(`Backup saved: ${DB.toners.length} toner(s), ${DB.transactions.length} transaction(s).`);
}

function maxId(list) {
  return list.reduce((m, item) => Math.max(m, Number(item.id) || 0), 0);
}

function handleRestoreFileChange(e) {
  const file = e.target.files && e.target.files[0];
  e.target.value = ""; // allow re-selecting the same file later
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    let parsed;
    try {
      parsed = JSON.parse(reader.result);
    } catch (err) {
      toastMsg("That file isn't valid JSON.");
      return;
    }
    if (!parsed || !Array.isArray(parsed.toners) || !Array.isArray(parsed.transactions)) {
      toastMsg("That doesn't look like a Toner Ledger backup file.");
      return;
    }

    openConfirm({
      title: "Restore from backup?",
      body: `This will replace everything currently in this browser with the backup ` +
        `(${parsed.toners.length} toner(s), ${parsed.transactions.length} transaction(s)) ` +
        `saved ${parsed.exportedAt || "at an unknown date"}. This can't be undone.`,
      confirmLabel: "Restore",
      onConfirm: () => {
        DB = {
          toners: parsed.toners,
          transactions: parsed.transactions,
          nextTonerId: parsed.nextTonerId || (maxId(parsed.toners) + 1),
          nextTxId: parsed.nextTxId || (maxId(parsed.transactions) + 1),
        };
        saveData();
        renderAll();
        toastMsg("Backup restored.");
      },
    });
  };
  reader.onerror = () => toastMsg("Could not read that file.");
  reader.readAsText(file);
}

/* ==========================================================================
   Rendering
   ========================================================================== */
function renderStats() {
  const { totalSkus, totalUnits, totalValue } = totals();
  document.getElementById("statSkus").textContent = totalSkus;
  document.getElementById("statUnits").textContent = totalUnits;
  document.getElementById("statValue").textContent = money(totalValue);
  document.getElementById("statLow").textContent = lowStock().length;
}

function rowClass(t) {
  if (t.quantity <= 0) return "row-out";
  if (t.quantity <= t.min_threshold) return "row-low";
  return "";
}

function renderRow(t) {
  const swatch = `<span class="color-swatch" style="background:${COLOR_HEX[t.color] || COLOR_HEX.Other}"></span>`;
  return `
    <tr data-id="${t.id}" class="${rowClass(t)}">
      <td class="name-cell">${swatch}${esc(t.name)}</td>
      <td>${esc(t.brand)}</td>
      <td>${esc(t.model_number)}</td>
      <td>${esc(t.color)}</td>
      <td>${esc(t.printer_compatible)}</td>
      <td class="ar">${t.quantity}</td>
      <td class="ar">${t.min_threshold}</td>
      <td class="ar">${money(t.unit_price)}</td>
      <td>${esc(t.supplier)}</td>
      <td>${esc(t.location)}</td>
      <td class="actions-col">
        <div class="row-actions">
          <button class="btn-text" data-action="restock" data-id="${t.id}">Restock</button>
          <button class="btn-text" data-action="use" data-id="${t.id}">Use</button>
          <button class="btn-text" data-action="edit" data-id="${t.id}">Edit</button>
          <button class="btn-text danger" data-action="remove" data-id="${t.id}">Remove</button>
        </div>
      </td>
    </tr>`;
}

let currentSearch = "";

function renderStockTable() {
  const rows = currentSearch ? searchToners(currentSearch) : activeToners();
  const body = document.getElementById("stockTableBody");
  body.innerHTML = rows.map(renderRow).join("");
  document.getElementById("stockEmpty").hidden = rows.length !== 0;
}

function renderLowTable() {
  const rows = lowStock();
  const body = document.getElementById("lowTableBody");
  body.innerHTML = rows.map(renderRow).join("");
  document.getElementById("lowEmpty").hidden = rows.length !== 0;
}

function renderHistoryTonerFilter() {
  const sel = document.getElementById("historyTonerFilter");
  const current = sel.value;
  sel.innerHTML = '<option value="">All toners</option>' +
    activeToners().map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join("");
  sel.value = current;
}

function renderHistoryTable() {
  const tonerId = document.getElementById("historyTonerFilter").value;
  const start = document.getElementById("historyStart").value;
  const end = document.getElementById("historyEnd").value;
  const rows = transactionsFor(tonerId ? Number(tonerId) : null, start || null, end || null);
  const body = document.getElementById("historyTableBody");
  body.innerHTML = rows.map((r) => `
    <tr>
      <td class="ar">${r.id}</td>
      <td>${esc(r.toner_name)}</td>
      <td><span class="badge ${r.tx_type === "IN" ? "badge-in" : "badge-out"}">${r.tx_type}</span></td>
      <td class="ar">${r.quantity}</td>
      <td>${esc(r.tx_date)}</td>
      <td>${esc(r.notes)}</td>
    </tr>`).join("");
  document.getElementById("historyEmpty").hidden = rows.length !== 0;
}

function renderAll() {
  renderStats();
  renderStockTable();
  renderLowTable();
  renderHistoryTonerFilter();
  renderHistoryTable();
}

/* ==========================================================================
   Tabs
   ========================================================================== */
function activateTab(name) {
  document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("is-active", b.dataset.tab === name));
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("is-active", v.id === `view-${name}`));
}

document.getElementById("tabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".tab");
  if (!btn) return;
  activateTab(btn.dataset.tab);
});

/* ==========================================================================
   Toner modal (Add / Edit)
   ========================================================================== */
const tonerScrim = document.getElementById("tonerScrim");
const tonerForm = document.getElementById("tonerForm");

function openAddToner() {
  tonerForm.reset();
  document.getElementById("tonerId").value = "";
  document.getElementById("tonerModalTitle").textContent = "Add new toner";
  document.getElementById("f_qty_wrap").hidden = false;
  document.getElementById("f_qty").disabled = false;
  document.getElementById("f_min").value = 2;
  document.getElementById("f_price").value = 0;
  document.getElementById("f_qty").value = 0;
  tonerScrim.hidden = false;
  document.getElementById("f_name").focus();
}

function openEditToner(id) {
  const t = getToner(id);
  if (!t) return;
  tonerForm.reset();
  document.getElementById("tonerId").value = t.id;
  document.getElementById("tonerModalTitle").textContent = `Edit toner — ${t.name}`;
  document.getElementById("f_name").value = t.name;
  document.getElementById("f_brand").value = t.brand;
  document.getElementById("f_model").value = t.model_number;
  document.getElementById("f_color").value = t.color;
  document.getElementById("f_printer").value = t.printer_compatible;
  document.getElementById("f_min").value = t.min_threshold;
  document.getElementById("f_price").value = t.unit_price;
  document.getElementById("f_supplier").value = t.supplier;
  document.getElementById("f_location").value = t.location;
  // quantity is changed only via Restock/Use, not directly editable here
  document.getElementById("f_qty_wrap").hidden = true;
  tonerScrim.hidden = false;
  document.getElementById("f_name").focus();
}

function closeTonerModal() { tonerScrim.hidden = true; }

document.getElementById("btnAddToner").addEventListener("click", openAddToner);
document.getElementById("tonerCancel").addEventListener("click", closeTonerModal);
tonerScrim.addEventListener("click", (e) => { if (e.target === tonerScrim) closeTonerModal(); });

tonerForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const id = document.getElementById("tonerId").value;
  const fields = {
    name: document.getElementById("f_name").value.trim(),
    brand: document.getElementById("f_brand").value.trim(),
    model_number: document.getElementById("f_model").value.trim(),
    color: document.getElementById("f_color").value,
    printer_compatible: document.getElementById("f_printer").value.trim(),
    min_threshold: parseInt(document.getElementById("f_min").value, 10) || 0,
    unit_price: parseFloat(document.getElementById("f_price").value) || 0,
    supplier: document.getElementById("f_supplier").value.trim(),
    location: document.getElementById("f_location").value.trim(),
  };
  if (!fields.name) { toastMsg("Toner name is required."); return; }

  try {
    if (id) {
      updateToner(Number(id), fields);
      toastMsg(`Updated '${fields.name}'.`);
      closeTonerModal();
      renderAll();
      flashRow(Number(id));
    } else {
      fields.quantity = parseInt(document.getElementById("f_qty").value, 10) || 0;
      const t = addToner(fields);
      toastMsg(`Added '${fields.name}'.`);
      closeTonerModal();
      renderAll();
      flashRow(t.id);
    }
  } catch (err) {
    toastMsg(err.message);
  }
});

/* ==========================================================================
   Restock / Use modal
   ========================================================================== */
const qtyScrim = document.getElementById("qtyScrim");
const qtyForm = document.getElementById("qtyForm");

function openQtyModal(id, mode) {
  const t = getToner(id);
  if (!t) return;
  document.getElementById("q_tonerId").value = id;
  document.getElementById("q_mode").value = mode;
  document.getElementById("qtyModalTitle").textContent = mode === "restock" ? "Restock toner" : "Record toner usage";
  document.getElementById("qtySubmit").textContent = "Save";
  document.getElementById("q_tonerName").textContent =
    `${t.name}  —  currently ${t.quantity} in stock`;
  document.getElementById("q_qty").value = 1;
  document.getElementById("q_notes").value = "";
  qtyScrim.hidden = false;
  document.getElementById("q_qty").focus();
}

function closeQtyModal() { qtyScrim.hidden = true; }

document.getElementById("qtyCancel").addEventListener("click", closeQtyModal);
qtyScrim.addEventListener("click", (e) => { if (e.target === qtyScrim) closeQtyModal(); });

qtyForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const id = Number(document.getElementById("q_tonerId").value);
  const mode = document.getElementById("q_mode").value;
  const qty = parseInt(document.getElementById("q_qty").value, 10);
  const notes = document.getElementById("q_notes").value.trim();

  try {
    if (mode === "restock") {
      restock(id, qty, notes);
      toastMsg(`Restocked ${qty} unit(s).`);
    } else {
      useToner(id, qty, notes);
      toastMsg(`Recorded usage of ${qty} unit(s).`);
    }
    closeQtyModal();
    renderAll();
    flashRow(id);

    if (mode === "use") {
      const t = getToner(id);
      if (t.quantity <= t.min_threshold) {
        setTimeout(() => toastMsg(`Low stock: '${t.name}' is at ${t.quantity} (threshold ${t.min_threshold}).`), 2700);
      }
    }
  } catch (err) {
    toastMsg(err.message);
  }
});

/* ==========================================================================
   Confirm (remove) modal
   ========================================================================== */
const confirmScrim = document.getElementById("confirmScrim");
let pendingConfirmAction = null;

function openConfirm({ title, body, confirmLabel = "Confirm", onConfirm }) {
  document.getElementById("confirmTitle").textContent = title;
  document.getElementById("confirmBody").textContent = body;
  document.getElementById("confirmOk").textContent = confirmLabel;
  pendingConfirmAction = onConfirm;
  confirmScrim.hidden = false;
}

function closeConfirm() {
  confirmScrim.hidden = true;
  pendingConfirmAction = null;
}

function openConfirmDelete(id) {
  const t = getToner(id);
  if (!t) return;
  openConfirm({
    title: "Remove toner",
    body: `Remove '${t.name}' from the ledger? Usage history is kept for records.`,
    confirmLabel: "Remove",
    onConfirm: () => {
      deleteToner(id);
      toastMsg(`Removed '${t.name}'.`);
      renderAll();
    },
  });
}

document.getElementById("confirmCancel").addEventListener("click", closeConfirm);
confirmScrim.addEventListener("click", (e) => { if (e.target === confirmScrim) closeConfirm(); });
document.getElementById("confirmOk").addEventListener("click", () => {
  const action = pendingConfirmAction;
  closeConfirm();
  if (action) action();
});

/* ==========================================================================
   Row action delegation (works for both All Stock and Low Stock tables)
   ========================================================================== */
function handleTableClick(e) {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const id = Number(btn.dataset.id);
  const action = btn.dataset.action;
  if (action === "restock") openQtyModal(id, "restock");
  else if (action === "use") openQtyModal(id, "use");
  else if (action === "edit") openEditToner(id);
  else if (action === "remove") openConfirmDelete(id);
}
document.getElementById("stockTableBody").addEventListener("click", handleTableClick);
document.getElementById("lowTableBody").addEventListener("click", handleTableClick);

/* ==========================================================================
   Search
   ========================================================================== */
document.getElementById("searchInput").addEventListener("input", (e) => {
  currentSearch = e.target.value;
  renderStockTable();
});

/* ==========================================================================
   Exports
   ========================================================================== */
document.getElementById("btnExportInventory").addEventListener("click", exportInventoryCsv);
document.getElementById("btnExportLowStock").addEventListener("click", exportLowStockCsv);
document.getElementById("btnExportLowStock2").addEventListener("click", exportLowStockCsv);
document.getElementById("btnApplyHistoryFilter").addEventListener("click", renderHistoryTable);
document.getElementById("btnExportHistory").addEventListener("click", () => {
  const tonerId = document.getElementById("historyTonerFilter").value;
  const start = document.getElementById("historyStart").value;
  const end = document.getElementById("historyEnd").value;
  exportHistoryCsv(tonerId ? Number(tonerId) : null, start || null, end || null);
});
document.getElementById("btnDownloadBackup").addEventListener("click", exportBackupJson);
document.getElementById("btnRestoreBackup").addEventListener("click", () => {
  document.getElementById("restoreFileInput").click();
});
document.getElementById("restoreFileInput").addEventListener("change", handleRestoreFileChange);

/* ==========================================================================
   Keyboard: Esc closes any open modal
   ========================================================================== */
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!tonerScrim.hidden) closeTonerModal();
  if (!qtyScrim.hidden) closeQtyModal();
  if (!confirmScrim.hidden) closeConfirm();
});

/* ==========================================================================
   Init
   ========================================================================== */
renderAll();
