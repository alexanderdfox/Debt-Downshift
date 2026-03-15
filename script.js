const debtList = document.getElementById("debt-list");
const addDebtButton = document.getElementById("add-debt");
const incomeInput = document.getElementById("income");
const essentialsInput = document.getElementById("essentials");

const surplusEl = document.getElementById("surplus");
const orderEl = document.getElementById("order");
const monthsEl = document.getElementById("months");
const interestEl = document.getElementById("interest");
const planEl = document.getElementById("plan");
const minimumsEl = document.getElementById("minimums");
const extraEl = document.getElementById("extra");
const extraInlineEl = document.getElementById("extra-inline");
const applyPaymentsButton = document.getElementById("apply-payments");
const resetButton = document.getElementById("reset-data");
const exportCsvButton = document.getElementById("export-csv");
const importCsvInput = document.getElementById("import-csv");

const debtTemplate = document.getElementById("debt-row");

const formatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function createDebtRow(seed = {}) {
  const node = debtTemplate.content.firstElementChild.cloneNode(true);
  const name = node.querySelector(".name");
  const balance = node.querySelector(".balance");
  const apr = node.querySelector(".apr");
  const min = node.querySelector(".min");
  const remove = node.querySelector(".remove");

  name.value = seed.name || "";
  balance.value = seed.balance ?? "";
  apr.value = seed.apr ?? "";
  min.value = seed.min ?? "";

  [name, balance, apr, min].forEach((input) =>
    input.addEventListener("input", () => {
      updatePlan();
      saveState();
    })
  );
  remove.addEventListener("click", () => {
    node.remove();
    updatePlan();
    saveState();
  });

  debtList.appendChild(node);
}

function parseDebts() {
  return Array.from(document.querySelectorAll(".debt-row")).map((row) => {
    const name = row.querySelector(".name").value.trim() || "Debt";
    const balance = Number(row.querySelector(".balance").value) || 0;
    const apr = Number(row.querySelector(".apr").value) || 0;
    const min = Number(row.querySelector(".min").value) || 0;
    return { name, balance, apr, min };
  });
}

function computeSurplus(income, essentials) {
  return Math.max(income - essentials, 0);
}

function pickOrder(debts, strategy) {
  const sorted = debts.slice().sort((a, b) => {
    if (strategy === "snowball") {
      return a.balance - b.balance;
    }
    return b.apr - a.apr;
  });
  return sorted.filter((debt) => debt.balance > 0);
}

function simulatePlan(debts, strategy, extraPayment) {
  const working = debts.map((debt) => ({
    ...debt,
    balance: Math.max(debt.balance, 0),
  }));

  let totalInterest = 0;
  let month = 0;
  const plan = [];

  while (working.some((debt) => debt.balance > 0) && month < 600) {
    month += 1;

    const ordered = pickOrder(working, strategy);
    let extra = extraPayment;

    for (const debt of ordered) {
      if (debt.balance <= 0) continue;
      const monthlyRate = debt.apr / 100 / 12;
      const interest = debt.balance * monthlyRate;
      totalInterest += interest;
      debt.balance += interest;

      const payment = Math.min(debt.balance, debt.min + extra);
      debt.balance -= payment;
      extra = Math.max(extra - (payment - debt.min), 0);
    }

    if (month % 6 === 0 || month === 1) {
      const snapshot = ordered
        .filter((debt) => debt.balance > 0)
        .map((debt) => `${debt.name}: ${formatter.format(debt.balance)}`)
        .join(", ");
      plan.push(`Month ${month}: ${snapshot || "All paid"}`);
    }
  }

  return { months: month, totalInterest, plan };
}

function updatePlan() {
  const income = Number(incomeInput.value) || 0;
  const essentials = Number(essentialsInput.value) || 0;
  const debts = parseDebts();
  const strategy =
    document.querySelector("input[name='strategy']:checked")?.value ||
    "avalanche";

  const minPayments = debts.reduce((sum, debt) => sum + debt.min, 0);
  const surplus = computeSurplus(income, essentials);
  const extraPayment = Math.max(surplus - minPayments, 0);

  surplusEl.textContent = formatter.format(surplus);
  minimumsEl.textContent = formatter.format(minPayments);
  extraEl.textContent = formatter.format(extraPayment);
  extraInlineEl.textContent = formatter.format(extraPayment);
  orderEl.textContent =
    pickOrder(debts, strategy)
      .map((debt) => debt.name)
      .join(" -> ") || "Add debts to see order";

  if (debts.every((debt) => debt.balance <= 0)) {
    monthsEl.textContent = "0";
    interestEl.textContent = formatter.format(0);
    planEl.innerHTML = "";
    return;
  }

  const { months, totalInterest, plan } = simulatePlan(
    debts,
    strategy,
    extraPayment
  );

  monthsEl.textContent = months.toString();
  interestEl.textContent = formatter.format(totalInterest);
  planEl.innerHTML = plan
    .map((item) => `<div class="plan-item"><strong>${item}</strong></div>`)
    .join("");
}

addDebtButton.addEventListener("click", () => createDebtRow());
[incomeInput, essentialsInput].forEach((input) =>
  input.addEventListener("input", updatePlan)
);
document
  .querySelectorAll("input[name='strategy']")
  .forEach((input) => input.addEventListener("change", updatePlan));

function saveState() {
  const payload = {
    income: Number(incomeInput.value) || 0,
    essentials: Number(essentialsInput.value) || 0,
    strategy:
      document.querySelector("input[name='strategy']:checked")?.value ||
      "avalanche",
    debts: parseDebts(),
  };
  localStorage.setItem("debt-downshift", JSON.stringify(payload));
}

function loadState() {
  const raw = localStorage.getItem("debt-downshift");
  if (!raw) return false;
  try {
    const payload = JSON.parse(raw);
    incomeInput.value = payload.income || "";
    essentialsInput.value = payload.essentials || "";
    document
      .querySelectorAll("input[name='strategy']")
      .forEach((input) => {
        input.checked = input.value === payload.strategy;
      });
    debtList.innerHTML = "";
    (payload.debts || []).forEach((debt) => createDebtRow(debt));
    return true;
  } catch (err) {
    return false;
  }
}

function applyOneTimePayments() {
  const debts = parseDebts();
  let changed = false;
  const updated = debts.map((debt) => {
    const paymentRaw = window.prompt(
      `One-time payment for ${debt.name} (leave blank for none):`,
      ""
    );
    if (!paymentRaw) return debt;
    const payment = Math.max(Number(paymentRaw) || 0, 0);
    if (payment > 0) changed = true;
    return { ...debt, balance: Math.max(debt.balance - payment, 0) };
  });

  if (changed) {
    debtList.innerHTML = "";
    updated.forEach((debt) => createDebtRow(debt));
    updatePlan();
    saveState();
  }
}

function resetAll() {
  if (!window.confirm("Clear all data and start fresh?")) return;
  localStorage.removeItem("debt-downshift");
  incomeInput.value = "";
  essentialsInput.value = "";
  debtList.innerHTML = "";
  createDebtRow();
  updatePlan();
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function exportCsv() {
  const debts = parseDebts();
  const rows = [
    ["name", "balance", "apr", "min"],
    ...debts.map((debt) => [
      debt.name,
      debt.balance,
      debt.apr,
      debt.min,
    ]),
  ];
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "debts.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(current);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      current = "";
      continue;
    }
    current += char;
  }
  row.push(current);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);

  return rows;
}

function importCsv(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const text = String(reader.result || "");
    const rows = parseCsv(text);
    if (!rows.length) return;
    const header = rows[0].map((cell) => cell.trim().toLowerCase());
    const nameIdx = header.indexOf("name");
    const balanceIdx = header.indexOf("balance");
    const aprIdx = header.indexOf("apr");
    const minIdx = header.indexOf("min");
    if ([nameIdx, balanceIdx, aprIdx, minIdx].some((i) => i < 0)) {
      window.alert("CSV must include: name, balance, apr, min");
      return;
    }
    const debts = rows
      .slice(1)
      .map((row) => ({
        name: row[nameIdx] || "Debt",
        balance: Number(row[balanceIdx]) || 0,
        apr: Number(row[aprIdx]) || 0,
        min: Number(row[minIdx]) || 0,
      }))
      .filter((debt) => debt.name || debt.balance || debt.apr || debt.min);

    debtList.innerHTML = "";
    debts.forEach((debt) => createDebtRow(debt));
    updatePlan();
    saveState();
  };
  reader.readAsText(file);
}

addDebtButton.addEventListener("click", () => {
  createDebtRow();
  saveState();
});
[incomeInput, essentialsInput].forEach((input) =>
  input.addEventListener("input", () => {
    updatePlan();
    saveState();
  })
);
document.querySelectorAll("input[name='strategy']").forEach((input) =>
  input.addEventListener("change", () => {
    updatePlan();
    saveState();
  })
);
applyPaymentsButton.addEventListener("click", applyOneTimePayments);
resetButton.addEventListener("click", resetAll);
exportCsvButton.addEventListener("click", exportCsv);
importCsvInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (file) importCsv(file);
  event.target.value = "";
});

if (!loadState()) {
  createDebtRow({ name: "Credit card", balance: 1200, apr: 21.5, min: 45 });
  createDebtRow({ name: "Car loan", balance: 8600, apr: 6.1, min: 210 });
}
updatePlan();
