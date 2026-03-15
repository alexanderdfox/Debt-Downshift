const debtList = document.getElementById("debt-list");
const addDebtButton = document.getElementById("add-debt");
const incomeInput = document.getElementById("income");
const essentialsInput = document.getElementById("essentials");
const incomeGrowthInput = document.getElementById("income-growth");
const annualBonusInput = document.getElementById("annual-bonus");
const targetDateInput = document.getElementById("target-date");
const searchInput = document.getElementById("search-debts");
const filterCategory = document.getElementById("filter-category");
const smallWinInput = document.getElementById("small-win");
const billList = document.getElementById("bill-list");
const addBillButton = document.getElementById("add-bill");

const surplusEl = document.getElementById("surplus");
const orderEl = document.getElementById("order");
const monthsEl = document.getElementById("months");
const interestEl = document.getElementById("interest");
const planEl = document.getElementById("plan");
const minimumsEl = document.getElementById("minimums");
const extraEl = document.getElementById("extra");
const extraInlineEl = document.getElementById("extra-inline");
const shortfallEl = document.getElementById("shortfall");
const targetMessageEl = document.getElementById("target-message");

const avalancheMonthsEl = document.getElementById("avalanche-months");
const avalancheInterestEl = document.getElementById("avalanche-interest");
const snowballMonthsEl = document.getElementById("snowball-months");
const snowballInterestEl = document.getElementById("snowball-interest");
const compareSummaryEl = document.getElementById("compare-summary");

const timelineCanvas = document.getElementById("timeline");
const timelineSlider = document.getElementById("timeline-slider");
const timelineMonthEl = document.getElementById("timeline-month");
const applyPaymentsButton = document.getElementById("apply-payments");
const resetButton = document.getElementById("reset-data");
const exportCsvButton = document.getElementById("export-csv");
const importCsvInput = document.getElementById("import-csv");
const printSummaryButton = document.getElementById("print-summary");

const levelEl = document.getElementById("level");
const xpEl = document.getElementById("xp");
const streakEl = document.getElementById("streak");
const progressEl = document.getElementById("progress");
const progressFill = document.getElementById("progress-fill");
const achievementsEl = document.getElementById("achievements");
const nextWinEl = document.getElementById("next-win");
const markReviewButton = document.getElementById("mark-review");
const setBaselineButton = document.getElementById("set-baseline");

const debtTemplate = document.getElementById("debt-row");
const billTemplate = document.getElementById("bill-row");

const formatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});


const META_KEY = "debt-downshift-meta";
let debtIdCounter = 1;

function loadMeta() {
  const raw = localStorage.getItem(META_KEY);
  if (!raw) return { baselineTotal: null, lastReview: null, streak: 0 };
  try {
    return JSON.parse(raw);
  } catch (err) {
    return { baselineTotal: null, lastReview: null, streak: 0 };
  }
}

function saveMeta(meta) {
  localStorage.setItem(META_KEY, JSON.stringify(meta));
}

function createDebtRow(seed = {}) {
  const node = debtTemplate.content.firstElementChild.cloneNode(true);
  const name = node.querySelector(".name");
  const balance = node.querySelector(".balance");
  const apr = node.querySelector(".apr");
  const refi = node.querySelector(".refi");
  const min = node.querySelector(".min");
  const category = node.querySelector(".category");
  const notes = node.querySelector(".notes");
  const remove = node.querySelector(".remove");

  const id = seed.id || `debt-${debtIdCounter++}`;
  node.dataset.id = id;

  name.value = seed.name || "";
  balance.value = seed.balance ?? "";
  apr.value = seed.apr ?? "";
  refi.value = seed.refiApr ?? "";
  min.value = seed.min ?? "";
  category.value = seed.category || "credit";
  notes.value = seed.notes || "";

  [name, balance, apr, refi, min, category, notes].forEach((input) =>
    input.addEventListener("input", () => {
      updatePlan();
      saveState();
      applyFilters();
    })
  );
  remove.addEventListener("click", () => {
    node.remove();
    updatePlan();
    saveState();
    applyFilters();
  });

  debtList.appendChild(node);
}

function parseDebts() {
  return Array.from(document.querySelectorAll(".debt-row")).map((row) => {
    const name = row.querySelector(".name").value.trim() || "Debt";
    const balance = Number(row.querySelector(".balance").value) || 0;
    const apr = Number(row.querySelector(".apr").value) || 0;
    const refiApr = Number(row.querySelector(".refi").value) || 0;
    const min = Number(row.querySelector(".min").value) || 0;
    const category = row.querySelector(".category").value || "other";
    const notes = row.querySelector(".notes").value.trim();
    return {
      id: row.dataset.id,
      name,
      balance,
      apr,
      refiApr,
      min,
      category,
      notes,
    };
  });
}

function createBillRow(seed = {}) {
  const node = billTemplate.content.firstElementChild.cloneNode(true);
  const name = node.querySelector(".bill-name");
  const amount = node.querySelector(".bill-amount");
  const remove = node.querySelector(".remove");

  name.value = seed.name || "";
  amount.value = seed.amount ?? "";

  [name, amount].forEach((input) =>
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

  billList.appendChild(node);
}

function parseBills() {
  return Array.from(document.querySelectorAll(".bill-row")).map((row) => ({
    name: row.querySelector(".bill-name").value.trim() || "Bill",
    amount: Number(row.querySelector(".bill-amount").value) || 0,
  }));
}

function computeSurplus(income, essentials) {
  return Math.max(income - essentials, 0);
}

function getEffectiveApr(debt) {
  if (debt.refiApr > 0 && debt.refiApr < debt.apr) return debt.refiApr;
  return debt.apr;
}

function pickOrder(debts, strategy) {
  if (strategy === "hybrid") {
    const active = debts.filter((debt) => debt.balance > 0);
    if (!active.length) return [];
    const balances = active.map((debt) => debt.balance);
    const aprs = active.map((debt) => getEffectiveApr(debt));
    const minBalance = Math.min(...balances);
    const maxBalance = Math.max(...balances);
    const minApr = Math.min(...aprs);
    const maxApr = Math.max(...aprs);
    const balanceRange = Math.max(maxBalance - minBalance, 1);
    const aprRange = Math.max(maxApr - minApr, 1);
    const score = (debt) => {
      const balanceScore = (debt.balance - minBalance) / balanceRange;
      const aprScore = (maxApr - getEffectiveApr(debt)) / aprRange;
      return balanceScore * 0.5 + aprScore * 0.5;
    };
    return debts
      .slice()
      .sort((a, b) => score(a) - score(b))
      .filter((debt) => debt.balance > 0);
  }

  const sorted = debts.slice().sort((a, b) => {
    if (strategy === "snowball") {
      return a.balance - b.balance;
    }
    return getEffectiveApr(b) - getEffectiveApr(a);
  });
  return sorted.filter((debt) => debt.balance > 0);
}

function computeMonthlyIncome(baseIncome, growthRate, annualBonus, bonusMonth, month) {
  const growth = Math.pow(1 + growthRate, month - 1);
  let income = baseIncome * growth;
  if (annualBonus > 0 && bonusMonth && ((month - 1) % 12) + 1 === bonusMonth) {
    income += annualBonus;
  }
  return income;
}

function simulatePlan(debts, strategy, options) {
  const working = debts.map((debt) => ({
    ...debt,
    balance: Math.max(debt.balance, 0),
    apr: getEffectiveApr(debt),
  }));

  let totalInterest = 0;
  let month = 0;
  const plan = [];
  const timeline = [];

  while (working.some((debt) => debt.balance > 0) && month < 600) {
    month += 1;

    const ordered = pickOrder(working, strategy);
    const income = computeMonthlyIncome(
      options.income,
      options.growthRate,
      options.annualBonus,
      options.bonusMonth,
      month
    );
    const minPayments = ordered.reduce(
      (sum, debt) => sum + (debt.balance > 0 ? debt.min : 0),
      0
    );
    const surplus = computeSurplus(income, options.essentials);
    const available = Math.max(surplus, 0) + (options.extraBoost || 0);
    const minScale = minPayments > 0 ? Math.min(1, available / minPayments) : 1;
    let extra = Math.max(available - minPayments, 0);

    for (const debt of ordered) {
      if (debt.balance <= 0) continue;
      const monthlyRate = debt.apr / 100 / 12;
      const interest = debt.balance * monthlyRate;
      totalInterest += interest;
      debt.balance += interest;

      const minPayment = debt.min * minScale;
      const payment = Math.min(debt.balance, minPayment + extra);
      debt.balance -= payment;
      extra = Math.max(extra - (payment - minPayment), 0);

    }

    const totalBalance = working.reduce(
      (sum, debt) => sum + Math.max(debt.balance, 0),
      0
    );
    timeline.push(totalBalance);

    if (month % 6 === 0 || month === 1) {
      const snapshot = ordered
        .filter((debt) => debt.balance > 0)
        .map((debt) => `${debt.name}: ${formatter.format(debt.balance)}`)
        .join(", ");
      plan.push(`Month ${month}: ${snapshot || "All paid"}`);
    }
  }

  return { months: month, totalInterest, plan, timeline };
}

function monthsUntil(targetDate) {
  if (!targetDate) return null;
  const target = new Date(targetDate);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  if (target <= now) return 0;
  let months =
    (target.getFullYear() - now.getFullYear()) * 12 +
    (target.getMonth() - now.getMonth());
  if (target.getDate() < now.getDate()) months -= 1;
  return Math.max(months, 0) + 1;
}

function estimateExtraForTarget(debts, strategy, options, targetMonths) {
  const totalBalance = debts.reduce((sum, debt) => sum + debt.balance, 0);
  if (totalBalance <= 0) return 0;

  let low = 0;
  let high = Math.max(200, totalBalance);
  let attempt = simulatePlan(debts, strategy, { ...options, extraBoost: high });
  while (attempt.months > targetMonths && high < totalBalance * 10) {
    high *= 2;
    attempt = simulatePlan(debts, strategy, { ...options, extraBoost: high });
  }
  if (attempt.months > targetMonths) return null;

  for (let i = 0; i < 24; i += 1) {
    const mid = (low + high) / 2;
    const trial = simulatePlan(debts, strategy, { ...options, extraBoost: mid });
    if (trial.months <= targetMonths) {
      high = mid;
    } else {
      low = mid;
    }
  }
  return Math.max(0, high);
}

function drawTimeline(timeline, highlightMonth = 1) {
  if (!timelineCanvas) return;
  const ctx = timelineCanvas.getContext("2d");
  const width = timelineCanvas.clientWidth;
  const height = timelineCanvas.height;
  timelineCanvas.width = width;
  ctx.clearRect(0, 0, width, height);

  if (!timeline.length) {
    ctx.fillStyle = "#a7a19a";
    ctx.font = "14px Source Sans 3, sans-serif";
    ctx.fillText("Add debts to see the timeline.", 20, 40);
    return;
  }

  const padding = 24;
  const maxValue = Math.max(...timeline);
  const minValue = Math.min(...timeline);
  const range = Math.max(maxValue - minValue, 1);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, height - padding);
  ctx.lineTo(width - padding, height - padding);
  ctx.stroke();

  ctx.strokeStyle = "#5dd9c1";
  ctx.lineWidth = 3;
  ctx.beginPath();
  const points = timeline.map((value, index) => {
    const x =
      padding + (index / Math.max(timeline.length - 1, 1)) * (width - padding * 2);
    const y =
      height - padding - ((value - minValue) / range) * (height - padding * 2);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    return { x, y, value, month: index + 1 };
  });
  ctx.stroke();

  ctx.fillStyle = "#5dd9c1";
  ctx.font = "10px Source Sans 3, sans-serif";
  points.forEach((point) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    const label = formatter.format(point.value);
    ctx.fillStyle = "rgba(248, 244, 236, 0.8)";
    ctx.fillText(label, point.x - 12, point.y - 10);
    ctx.fillStyle = "#5dd9c1";
  });

  const highlightIndex = Math.min(
    Math.max(highlightMonth - 1, 0),
    points.length - 1
  );
  const highlight = points[highlightIndex];
  if (highlight) {
    ctx.beginPath();
    ctx.arc(highlight.x, highlight.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = "#f2c14e";
    ctx.fill();
    ctx.strokeStyle = "#ff7c6b";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#f8f4ec";
    ctx.font = "12px Source Sans 3, sans-serif";
    ctx.fillText(
      `Month ${highlight.month}: ${formatter.format(highlight.value)}`,
      Math.min(highlight.x + 12, width - 200),
      Math.max(highlight.y - 12, 16)
    );
  }
}

function renderBadges(progress, streak) {
  const badges = [
    { label: "First dent (1%)", unlocked: progress >= 0.01 },
    { label: "Quarter down (25%)", unlocked: progress >= 0.25 },
    { label: "Halfway hero (50%)", unlocked: progress >= 0.5 },
    { label: "Final stretch (75%)", unlocked: progress >= 0.75 },
    { label: "Debt free (100%)", unlocked: progress >= 1 },
    { label: "3-month streak", unlocked: streak >= 3 },
    { label: "6-month streak", unlocked: streak >= 6 },
  ];
  achievementsEl.innerHTML = badges
    .map(
      (badge) =>
        `<div class="badge ${badge.unlocked ? "" : "locked"}">${badge.label}</div>`
    )
    .join("");
}

function updateGame(debts) {
  const meta = loadMeta();
  const totalBalance = debts.reduce((sum, debt) => sum + debt.balance, 0);
  if (meta.baselineTotal === null) {
    meta.baselineTotal = totalBalance;
    saveMeta(meta);
  }
  const progress =
    meta.baselineTotal > 0
      ? (meta.baselineTotal - totalBalance) / meta.baselineTotal
      : 0;
  const xp = Math.max(0, Math.round(progress * 1000 + meta.streak * 25));
  const level = Math.floor(xp / 250) + 1;

  levelEl.textContent = level.toString();
  xpEl.textContent = xp.toString();
  streakEl.textContent = meta.streak.toString();
  progressEl.textContent = `${Math.round(progress * 100)}%`;
  progressFill.style.width = `${Math.min(Math.max(progress, 0), 1) * 100}%`;
  renderBadges(progress, meta.streak);
}

function highlightNextDebt(nextId) {
  document.querySelectorAll(".debt-row").forEach((row) => {
    row.classList.toggle("highlight", row.dataset.id === nextId);
  });
}

function applyFilters() {
  const search = (searchInput.value || "").toLowerCase();
  const category = filterCategory.value;
  document.querySelectorAll(".debt-row").forEach((row) => {
    const name = row.querySelector(".name").value.toLowerCase();
    const notes = row.querySelector(".notes").value.toLowerCase();
    const rowCategory = row.querySelector(".category").value;
    const matchesSearch =
      !search || name.includes(search) || notes.includes(search);
    const matchesCategory = category === "all" || rowCategory === category;
    row.style.display = matchesSearch && matchesCategory ? "" : "none";
  });
}

function updatePlan() {
  const income = Number(incomeInput.value) || 0;
  const baseEssentials = Number(essentialsInput.value) || 0;
  const growthRate = (Number(incomeGrowthInput.value) || 0) / 100;
  const annualBonus = Number(annualBonusInput.value) || 0;
  const debts = parseDebts();
  const bills = parseBills();
  const strategy =
    document.querySelector("input[name='strategy']:checked")?.value ||
    "avalanche";
  const smallWinMode = smallWinInput.checked;

  const billTotal = bills.reduce((sum, bill) => sum + bill.amount, 0);
  const essentials = baseEssentials + billTotal;
  const minPayments = debts.reduce(
    (sum, debt) => sum + (debt.balance > 0 ? debt.min : 0),
    0
  );
  const surplus = computeSurplus(income, essentials);
  const extraPayment = Math.max(surplus - minPayments, 0);
  const shortfall = Math.max(minPayments - surplus, 0);

  surplusEl.textContent = formatter.format(surplus);
  minimumsEl.textContent = formatter.format(minPayments);
  extraEl.textContent = formatter.format(extraPayment);
  extraInlineEl.textContent = formatter.format(extraPayment);
  shortfallEl.textContent = formatter.format(shortfall);
  orderEl.textContent =
    pickOrder(debts, strategy)
      .map((debt) => debt.name)
      .join(" -> ") || "Add debts to see order";

  if (debts.every((debt) => debt.balance <= 0)) {
    monthsEl.textContent = "0";
    interestEl.textContent = formatter.format(0);
    planEl.innerHTML = "";
    compareSummaryEl.textContent = "All debts are paid off. Nice work.";
    targetMessageEl.textContent =
      "Debt-free already. Set a new goal if you want to keep momentum.";
    nextWinEl.textContent = "Next win: debt-free achieved.";
    highlightNextDebt(null);
    drawTimeline([]);
    updateGame(debts);
    return;
  }

  const options = {
    income,
    essentials,
    growthRate,
    annualBonus,
    bonusMonth: 12,
    extraBoost: 0,
  };

  const current = simulatePlan(debts, strategy, options);
  const avalanche = simulatePlan(debts, "avalanche", options);
  const snowball = simulatePlan(debts, "snowball", options);

  monthsEl.textContent = current.months.toString();
  interestEl.textContent = formatter.format(current.totalInterest);
  planEl.innerHTML = current.plan
    .map((item) => `<div class="plan-item"><strong>${item}</strong></div>`)
    .join("");

  avalancheMonthsEl.textContent = avalanche.months.toString();
  avalancheInterestEl.textContent = formatter.format(avalanche.totalInterest);
  snowballMonthsEl.textContent = snowball.months.toString();
  snowballInterestEl.textContent = formatter.format(snowball.totalInterest);

  if (debts.length) {
    const interestDiff = snowball.totalInterest - avalanche.totalInterest;
    const faster =
      avalanche.months === snowball.months
        ? "Both finish around the same time."
        : avalanche.months < snowball.months
        ? "Avalanche finishes sooner."
        : "Snowball finishes sooner.";
    const interestLine =
      interestDiff > 0
        ? `Avalanche saves about ${formatter.format(interestDiff)} in interest.`
        : interestDiff < 0
        ? `Snowball saves about ${formatter.format(Math.abs(interestDiff))} in interest.`
        : "Interest cost is about the same.";
    compareSummaryEl.textContent = `${faster} ${interestLine}`;
  } else {
    compareSummaryEl.textContent = "Add debts to compare strategies.";
  }

  const nextDebt = pickOrder(debts, smallWinMode ? "snowball" : strategy)[0];
  if (nextDebt) {
    highlightNextDebt(nextDebt.id);
    nextWinEl.textContent = `Next win: Pay off ${nextDebt.name} (${formatter.format(
      nextDebt.balance
    )} left).`;
  } else {
    highlightNextDebt(null);
    nextWinEl.textContent = "Next win: add debts to see your first target.";
  }

  if (timelineSlider) {
    timelineSlider.max = String(Math.max(current.timeline.length, 1));
    timelineSlider.value = String(
      Math.min(Number(timelineSlider.value) || 1, current.timeline.length)
    );
    if (timelineMonthEl) {
      timelineMonthEl.textContent = `Month ${timelineSlider.value}`;
    }
  }
  drawTimeline(current.timeline, Number(timelineSlider?.value || 1));

  const targetMonths = monthsUntil(targetDateInput.value);
  if (shortfall > 0) {
    targetMessageEl.textContent = `You're short ${formatter.format(
      shortfall
    )} to cover minimums. Try reducing essentials or increasing income.`;
  } else if (targetMonths === null) {
    targetMessageEl.textContent =
      "Set a target date to see the required extra payment.";
  } else if (targetMonths === 0) {
    targetMessageEl.textContent =
      "Target date is in the past. Pick a future date.";
  } else {
    const requiredExtra = estimateExtraForTarget(
      debts,
      strategy,
      options,
      targetMonths
    );
    if (requiredExtra === null) {
      targetMessageEl.textContent =
        "That target is very aggressive. Try a later date or a bigger monthly extra.";
    } else {
      const totalNeeded = extraPayment + requiredExtra;
      const gap = Math.max(totalNeeded - extraPayment, 0);
      targetMessageEl.textContent = `To finish in ${targetMonths} months, target about ${formatter.format(
        totalNeeded
      )} extra per month. Gap: ${formatter.format(gap)}.`;
    }
  }

  updateGame(debts);
}

function saveState() {
  const payload = {
    income: Number(incomeInput.value) || 0,
    essentials: Number(essentialsInput.value) || 0,
    incomeGrowth: Number(incomeGrowthInput.value) || 0,
    annualBonus: Number(annualBonusInput.value) || 0,
    targetDate: targetDateInput.value || "",
    strategy:
      document.querySelector("input[name='strategy']:checked")?.value ||
      "avalanche",
    smallWinMode: smallWinInput.checked,
    debts: parseDebts(),
    bills: parseBills(),
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
    incomeGrowthInput.value = payload.incomeGrowth || "";
    annualBonusInput.value = payload.annualBonus || "";
    targetDateInput.value = payload.targetDate || "";
    smallWinInput.checked = Boolean(payload.smallWinMode);
    document
      .querySelectorAll("input[name='strategy']")
      .forEach((input) => {
        input.checked = input.value === payload.strategy;
      });
    debtList.innerHTML = "";
    (payload.debts || []).forEach((debt) => createDebtRow(debt));
    billList.innerHTML = "";
    (payload.bills || []).forEach((bill) => createBillRow(bill));
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
  localStorage.removeItem(META_KEY);
  incomeInput.value = "";
  essentialsInput.value = "";
  incomeGrowthInput.value = "";
  annualBonusInput.value = "";
  targetDateInput.value = "";
  debtList.innerHTML = "";
  billList.innerHTML = "";
  createDebtRow();
  createBillRow();
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
    ["name", "balance", "apr", "refi_apr", "min", "category", "notes"],
    ...debts.map((debt) => [
      debt.name,
      debt.balance,
      debt.apr,
      debt.refiApr,
      debt.min,
      debt.category,
      debt.notes,
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
    const refiIdx = header.indexOf("refi_apr");
    const minIdx = header.indexOf("min");
    const categoryIdx = header.indexOf("category");
    const notesIdx = header.indexOf("notes");
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
        refiApr: Number(row[refiIdx]) || 0,
        min: Number(row[minIdx]) || 0,
        category: row[categoryIdx] || "other",
        notes: row[notesIdx] || "",
      }))
      .filter((debt) => debt.name || debt.balance || debt.apr || debt.min);

    debtList.innerHTML = "";
    debts.forEach((debt) => createDebtRow(debt));
    updatePlan();
    saveState();
  };
  reader.readAsText(file);
}

function markMonthlyReview() {
  const meta = loadMeta();
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
  if (meta.lastReview === monthKey) return;
  if (!meta.lastReview) {
    meta.streak = 1;
  } else {
    const [year, month] = meta.lastReview.split("-").map(Number);
    const previous = new Date(year, month - 1, 1);
    const expected = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    meta.streak = previous.getTime() === expected.getTime() ? meta.streak + 1 : 1;
  }
  meta.lastReview = monthKey;
  saveMeta(meta);
  updatePlan();
}

function setBaseline() {
  const debts = parseDebts();
  const meta = loadMeta();
  meta.baselineTotal = debts.reduce((sum, debt) => sum + debt.balance, 0);
  saveMeta(meta);
  updatePlan();
}

addDebtButton.addEventListener("click", () => {
  createDebtRow();
  saveState();
});
addBillButton.addEventListener("click", () => {
  createBillRow();
  saveState();
});
[incomeInput, essentialsInput, incomeGrowthInput, annualBonusInput].forEach(
  (input) =>
    input.addEventListener("input", () => {
      updatePlan();
      saveState();
    })
);
targetDateInput.addEventListener("change", () => {
  updatePlan();
  saveState();
});
document.querySelectorAll("input[name='strategy']").forEach((input) =>
  input.addEventListener("change", () => {
    updatePlan();
    saveState();
  })
);
smallWinInput.addEventListener("change", () => {
  updatePlan();
  saveState();
});
searchInput.addEventListener("input", applyFilters);
filterCategory.addEventListener("change", applyFilters);
applyPaymentsButton.addEventListener("click", applyOneTimePayments);
resetButton.addEventListener("click", resetAll);
exportCsvButton.addEventListener("click", exportCsv);
importCsvInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (file) importCsv(file);
  event.target.value = "";
});
printSummaryButton.addEventListener("click", () => window.print());
markReviewButton.addEventListener("click", markMonthlyReview);
setBaselineButton.addEventListener("click", setBaseline);
window.addEventListener("resize", () => updatePlan());
timelineSlider?.addEventListener("input", () => {
  if (timelineMonthEl) {
    timelineMonthEl.textContent = `Month ${timelineSlider.value}`;
  }
  updatePlan();
});

if (!loadState()) {
  createDebtRow({
    name: "Credit card",
    balance: 1200,
    apr: 21.5,
    refiApr: "",
    min: 45,
    category: "credit",
    notes: "Autopay on 15th",
  });
  createDebtRow({
    name: "Car loan",
    balance: 8600,
    apr: 6.1,
    refiApr: "",
    min: 210,
    category: "loan",
    notes: "Check refinance in June",
  });
  createBillRow({ name: "Internet", amount: 65 });
  createBillRow({ name: "Phone", amount: 55 });
}
applyFilters();
updatePlan();
