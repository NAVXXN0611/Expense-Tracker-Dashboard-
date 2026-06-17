const form = document.querySelector("#transactionForm");
const table = document.querySelector("#transactionTable");
const chart = document.querySelector("#categoryChart");
const filterType = document.querySelector("#filterType");
const filterCategory = document.querySelector("#filterCategory");
const filterDateFrom = document.querySelector("#filterDateFrom");
const filterDateTo = document.querySelector("#filterDateTo");
const filterMinAmount = document.querySelector("#filterMinAmount");
const filterMaxAmount = document.querySelector("#filterMaxAmount");
const clearFiltersBtn = document.querySelector("#clearFiltersBtn");
const exportCsvBtn = document.querySelector("#exportCsvBtn");
const chartFilterLabel = document.querySelector("#chartFilterLabel");
const searchInput = document.querySelector("#searchInput");
const formMessage = document.querySelector("#formMessage");
const dateInput = document.querySelector("#transactionDate");
const receiptFile = document.querySelector("#receiptFile");
const receiptFileName = document.querySelector("#receiptFileName");
const welcomeDate = document.querySelector("#welcomeDate");
const welcomeMessage = document.querySelector("#welcomeMessage");
const cashFlowStatus = document.querySelector("#cashFlowStatus");
const topCategoryValue = document.querySelector("#topCategoryValue");
const latestActivityValue = document.querySelector("#latestActivityValue");
const budgetForm = document.querySelector("#budgetForm");
const budgetAmount = document.querySelector("#budgetAmount");
const budgetMessage = document.querySelector("#budgetMessage");
const budgetTitle = document.querySelector("#budgetTitle");
const budgetHint = document.querySelector("#budgetHint");
const budgetSpentValue = document.querySelector("#budgetSpentValue");
const budgetRemainingValue = document.querySelector("#budgetRemainingValue");
const budgetPercentValue = document.querySelector("#budgetPercentValue");
const budgetFill = document.querySelector("#budgetFill");
const categoryDonut = document.querySelector("#categoryDonut");
const donutLegend = document.querySelector("#donutLegend");
const donutTotalLabel = document.querySelector("#donutTotalLabel");
const trendChart = document.querySelector("#trendChart");
const trendRangeLabel = document.querySelector("#trendRangeLabel");
const trendMonthPicker = document.querySelector("#trendMonthPicker");
const activityTimeline = document.querySelector("#activityTimeline");
const activityCount = document.querySelector("#activityCount");
const recurringForm = document.querySelector("#recurringForm");
const recurringList = document.querySelector("#recurringList");
const recurringCount = document.querySelector("#recurringCount");
const recurringDueDate = document.querySelector("#recurringDueDate");
const recurringMessage = document.querySelector("#recurringMessage");
const themeToggle = document.querySelector("#themeToggle");
const currencySelector = document.querySelector("#currencySelector");
const smartInsights = document.querySelector("#smartInsights");
const financeTips = document.querySelector("#financeTips");
const insightStatus = document.querySelector("#insightStatus");

const categoryColors = [
    "#0b63ff",
    "#14b8a6",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#22c55e",
    "#06b6d4",
    "#f97316",
];

let selectedCurrency = localStorage.getItem("fintrack-currency") || "USD";
let currency = createCurrencyFormatter(selectedCurrency);
const maxReceiptSize = 650 * 1024;
const allowedReceiptTypes = ["image/png", "image/jpeg", "image/webp"];

let transactions = [];
let budget = { month: getCurrentMonth(), amount: 0 };
let recurringItems = [];
let selectedTrendMonth = getCurrentMonth();
let currentFilteredTransactions = [];

applySavedTheme();
applySavedCurrency();
dateInput.valueAsDate = new Date();
if (recurringDueDate) {
    recurringDueDate.valueAsDate = new Date();
}
if (trendMonthPicker) {
    trendMonthPicker.value = selectedTrendMonth;
    trendMonthPicker.max = getCurrentMonth();
}
renderWelcomeDate();

async function loadTransactions() {
    const [transactionsResponse, budgetResponse, recurringResponse] = await Promise.all([
        fetch("/api/transactions"),
        fetch(`/api/budget?month=${getCurrentMonth()}`),
        fetch("/api/recurring"),
    ]);

    transactions = await transactionsResponse.json();
    budget = await budgetResponse.json();
    recurringItems = await recurringResponse.json();
    render();
}

function render() {
    const filtered = getFilteredTransactions();
    currentFilteredTransactions = filtered;

    renderSummary();
    renderWelcomeSummary();
    renderBudget();
    renderTable(filtered);
    renderChart(filtered);
    renderDonutChart();
    renderTrendChart();
    renderActivityTimeline();
    renderRecurringExpenses();
    renderSmartInsights();
    renderFinanceTips();
}

function renderSummary() {
    const income = transactions
        .filter((transaction) => transaction.type === "income")
        .reduce((sum, transaction) => sum + transaction.amount, 0);
    const expense = transactions
        .filter((transaction) => transaction.type === "expense")
        .reduce((sum, transaction) => sum + transaction.amount, 0);

    document.querySelector("#incomeValue").textContent = currency.format(income);
    document.querySelector("#expenseValue").textContent = currency.format(expense);
    document.querySelector("#balanceValue").textContent = currency.format(income - expense);
    document.querySelector("#countValue").textContent = transactions.length;
}

function getFilteredTransactions() {
    const query = searchInput.value.trim().toLowerCase();
    const selectedType = filterType.value;
    const selectedCategory = filterCategory.value;
    const minAmount = Number.parseFloat(filterMinAmount.value);
    const maxAmount = Number.parseFloat(filterMaxAmount.value);
    const fromDate = filterDateFrom.value;
    const toDate = filterDateTo.value;

    return transactions.filter((transaction) => {
        const matchesType = selectedType === "all" || transaction.type === selectedType;
        const matchesCategory = selectedCategory === "all" || transaction.category === selectedCategory;
        const searchable = `${transaction.title} ${transaction.category} ${transaction.note} ${transaction.receipt_name}`.toLowerCase();
        const matchesSearch = !query || searchable.includes(query);
        const matchesFrom = !fromDate || transaction.transaction_date >= fromDate;
        const matchesTo = !toDate || transaction.transaction_date <= toDate;
        const matchesMin = Number.isNaN(minAmount) || transaction.amount >= minAmount;
        const matchesMax = Number.isNaN(maxAmount) || transaction.amount <= maxAmount;

        return matchesType && matchesCategory && matchesSearch && matchesFrom && matchesTo && matchesMin && matchesMax;
    });
}

function renderSmartInsights() {
    if (!smartInsights || !insightStatus) return;

    const insights = buildInsights();
    insightStatus.textContent = transactions.length ? `${insights.length} insights` : "Waiting for data";
    smartInsights.innerHTML = insights.map((insight) => `
        <article class="insight-item ${insight.tone}">
            <strong>${escapeHtml(insight.title)}</strong>
            <p>${escapeHtml(insight.body)}</p>
        </article>
    `).join("");
}

function buildInsights() {
    if (!transactions.length) {
        return [{
            tone: "neutral",
            title: "Start with one transaction",
            body: "Add income and expenses to unlock spending patterns, budget pressure, and category warnings.",
        }];
    }

    const currentMonth = getCurrentMonth();
    const previousMonth = getRecentMonths(2, currentMonth)[0];
    const currentExpenses = sumTransactionsByMonth(currentMonth, "expense");
    const previousExpenses = sumTransactionsByMonth(previousMonth, "expense");
    const currentIncome = sumTransactionsByMonth(currentMonth, "income");
    const insights = [];

    if (previousExpenses > 0) {
        const change = ((currentExpenses - previousExpenses) / previousExpenses) * 100;
        if (change >= 15) {
            insights.push({
                tone: "warning",
                title: "Expenses are rising",
                body: `This month's expenses are ${Math.round(change)}% higher than last month.`,
            });
        } else if (change <= -15) {
            insights.push({
                tone: "positive",
                title: "Spending is improving",
                body: `This month's expenses are ${Math.abs(Math.round(change))}% lower than last month.`,
            });
        }
    }

    const categoryTotals = getExpenseCategoryTotals(transactions.filter((transaction) => transaction.transaction_date.startsWith(currentMonth)));
    const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
    if (topCategory && currentExpenses > 0) {
        const share = (topCategory[1] / currentExpenses) * 100;
        insights.push({
            tone: share > 45 ? "warning" : "neutral",
            title: `${topCategory[0]} is your top spend`,
            body: `${topCategory[0]} is ${Math.round(share)}% of this month's expenses.`,
        });
    }

    if (budget.amount > 0 && currentExpenses > budget.amount) {
        insights.push({
            tone: "warning",
            title: "Budget crossed",
            body: `You are ${currency.format(currentExpenses - budget.amount)} above this month's budget.`,
        });
    } else if (budget.amount > 0 && currentExpenses >= budget.amount * 0.8) {
        insights.push({
            tone: "neutral",
            title: "Budget is getting tight",
            body: `You have used ${Math.round((currentExpenses / budget.amount) * 100)}% of this month's budget.`,
        });
    }

    if (currentIncome > currentExpenses && currentIncome > 0) {
        insights.push({
            tone: "positive",
            title: "Positive monthly cash flow",
            body: `You are ahead by ${currency.format(currentIncome - currentExpenses)} this month.`,
        });
    }

    if (!insights.length) {
        insights.push({
            tone: "neutral",
            title: "Spending looks stable",
            body: "No major warning signs yet. Keep logging transactions to improve the analysis.",
        });
    }

    return insights.slice(0, 4);
}

function renderFinanceTips() {
    if (!financeTips) return;

    const tips = buildFinanceTips();
    financeTips.innerHTML = tips.map((tip) => `
        <article class="tip-item">
            <strong>${escapeHtml(tip.title)}</strong>
            <p>${escapeHtml(tip.body)}</p>
        </article>
    `).join("");
}

function buildFinanceTips() {
    const currentMonth = getCurrentMonth();
    const monthlyExpenses = sumTransactionsByMonth(currentMonth, "expense");
    const categoryTotals = getExpenseCategoryTotals(transactions.filter((transaction) => transaction.transaction_date.startsWith(currentMonth)));
    const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
    const tips = [];

    if (topCategory) {
        tips.push({
            title: `Review ${topCategory[0]}`,
            body: `Set a small weekly cap for ${topCategory[0]} to control your highest spending area.`,
        });
    }

    if (recurringItems.length) {
        tips.push({
            title: "Check upcoming bills",
            body: `You have ${recurringItems.length} recurring bill${recurringItems.length === 1 ? "" : "s"} saved. Post due bills before reviewing your real balance.`,
        });
    }

    if (budget.amount > 0 && monthlyExpenses < budget.amount) {
        tips.push({
            title: "Move unused budget",
            body: `If this month stays under budget, move part of the remaining ${currency.format(budget.amount - monthlyExpenses)} into savings.`,
        });
    }

    if (!tips.length) {
        tips.push({
            title: "Build your baseline",
            body: "Add a week of transactions first. FinTrack will then suggest better category-level actions.",
        });
    }

    tips.push({
        title: "Keep receipts attached",
        body: "Attach receipts for larger expenses so tax, warranty, and reimbursement checks are easier later.",
    });

    return tips.slice(0, 3);
}

function renderWelcomeDate() {
    if (!welcomeDate) return;

    welcomeDate.textContent = new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
    });
}

function renderWelcomeSummary() {
    if (!welcomeMessage || !cashFlowStatus || !topCategoryValue || !latestActivityValue) {
        return;
    }

    const income = transactions
        .filter((transaction) => transaction.type === "income")
        .reduce((sum, transaction) => sum + transaction.amount, 0);
    const expense = transactions
        .filter((transaction) => transaction.type === "expense")
        .reduce((sum, transaction) => sum + transaction.amount, 0);
    const balance = income - expense;

    if (!transactions.length) {
        welcomeMessage.textContent = "Add your first transaction to unlock a personalized financial snapshot.";
        cashFlowStatus.textContent = "Getting started";
        topCategoryValue.textContent = "None yet";
        latestActivityValue.textContent = "No activity";
        return;
    }

    if (balance > 0) {
        welcomeMessage.textContent = `You are ahead by ${currency.format(balance)}. Keep the positive cash flow moving.`;
        cashFlowStatus.textContent = "Positive";
    } else if (balance < 0) {
        welcomeMessage.textContent = `You are over by ${currency.format(Math.abs(balance))}. Review your highest categories today.`;
        cashFlowStatus.textContent = "Needs review";
    } else {
        welcomeMessage.textContent = "Income and expenses are balanced. A little extra buffer would strengthen your month.";
        cashFlowStatus.textContent = "Balanced";
    }

    const categoryTotals = transactions
        .filter((transaction) => transaction.type === "expense")
        .reduce((totals, transaction) => {
            totals[transaction.category] = (totals[transaction.category] || 0) + transaction.amount;
            return totals;
        }, {});
    const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
    topCategoryValue.textContent = topCategory
        ? `${topCategory[0]} (${currency.format(topCategory[1])})`
        : "No expenses";

    const latest = [...transactions].sort((a, b) => {
        if (a.transaction_date === b.transaction_date) return b.id - a.id;
        return b.transaction_date.localeCompare(a.transaction_date);
    })[0];
    latestActivityValue.textContent = latest
        ? `${latest.title} ${currency.format(latest.amount)}`
        : "No activity";
}

function renderBudget() {
    if (!budgetTitle || !budgetFill) return;

    const monthlyExpenses = transactions
        .filter((transaction) => {
            return transaction.type === "expense"
                && transaction.transaction_date.startsWith(getCurrentMonth());
        })
        .reduce((sum, transaction) => sum + transaction.amount, 0);

    const budgetAmountValue = Number(budget.amount || 0);
    const remaining = budgetAmountValue - monthlyExpenses;
    const percentage = budgetAmountValue > 0
        ? Math.min((monthlyExpenses / budgetAmountValue) * 100, 100)
        : 0;

    if (budgetAmountValue > 0) {
        budgetTitle.textContent = `${formatMonthLabel(budget.month)} Budget`;
        budgetHint.textContent = `${currency.format(budgetAmountValue)} monthly limit for expenses.`;
        budgetAmount.value = budgetAmountValue.toFixed(2);
        budgetSpentValue.textContent = `${currency.format(monthlyExpenses)} spent`;
        budgetRemainingValue.textContent = remaining >= 0
            ? `${currency.format(remaining)} remaining`
            : `${currency.format(Math.abs(remaining))} over`;
        budgetPercentValue.textContent = `${Math.round(percentage)}% of budget used`;
        budgetFill.style.width = `${percentage}%`;
        budgetFill.classList.toggle("over-budget", remaining < 0);
    } else {
        budgetTitle.textContent = "Set this month's spending goal";
        budgetHint.textContent = "Track how much of your monthly expense budget has been used.";
        budgetSpentValue.textContent = `${currency.format(monthlyExpenses)} spent`;
        budgetRemainingValue.textContent = "No budget set";
        budgetPercentValue.textContent = "No budget set yet";
        budgetFill.style.width = "0%";
        budgetFill.classList.remove("over-budget");
    }
}

function renderTable(items) {
    if (!items.length) {
        table.innerHTML = `<tr><td colspan="7" class="empty-state">No transactions found</td></tr>`;
        return;
    }

    table.innerHTML = items.map((transaction) => `
        <tr>
            <td>${escapeHtml(transaction.title)}</td>
            <td>${escapeHtml(transaction.category)}</td>
            <td><span class="pill ${transaction.type}">${transaction.type}</span></td>
            <td>${currency.format(transaction.amount)}</td>
            <td>${formatDate(transaction.transaction_date)}</td>
            <td>${transaction.receipt_data ? `<button type="button" class="receipt-btn" data-id="${transaction.id}">View</button>` : `<span class="muted-cell">None</span>`}</td>
            <td><button class="delete-btn" data-id="${transaction.id}">Delete</button></td>
        </tr>
    `).join("");
}

function renderChart(items) {
    if (chartFilterLabel) {
        chartFilterLabel.textContent = `${items.length} filtered transactions`;
    }

    const totals = items.reduce((groups, transaction) => {
        groups[transaction.category] = (groups[transaction.category] || 0) + transaction.amount;
        return groups;
    }, {});

    const rows = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    if (!rows.length) {
        chart.innerHTML = `<div class="empty-state">Add transactions to see category totals</div>`;
        return;
    }

    const max = Math.max(...rows.map(([, amount]) => amount));
    chart.innerHTML = rows.map(([category, amount]) => {
        const width = Math.max((amount / max) * 100, 4);
        return `
            <div class="bar-row">
                <span class="bar-label">${escapeHtml(category)}</span>
                <span class="bar-track"><span class="bar-fill" style="width:${width}%"></span></span>
                <span class="bar-value">${currency.format(amount)}</span>
            </div>
        `;
    }).join("");
}

function renderDonutChart() {
    if (!categoryDonut || !donutLegend || !donutTotalLabel) return;

    const expenseTotals = getExpenseCategoryTotals(transactions);
    const rows = Object.entries(expenseTotals).sort((a, b) => b[1] - a[1]);
    const total = rows.reduce((sum, [, amount]) => sum + amount, 0);

    donutTotalLabel.textContent = currency.format(total);

    if (!rows.length || total <= 0) {
        categoryDonut.style.background = "#e8eef7";
        donutLegend.innerHTML = `<div class="empty-state compact-empty">Add expenses to build your category donut</div>`;
        return;
    }

    let cursor = 0;
    const slices = rows.map(([category, amount], index) => {
        const start = cursor;
        const size = (amount / total) * 100;
        cursor += size;
        const color = categoryColors[index % categoryColors.length];
        return `${color} ${start}% ${cursor}%`;
    });

    categoryDonut.style.background = `conic-gradient(${slices.join(", ")})`;
    donutLegend.innerHTML = rows.map(([category, amount], index) => {
        const color = categoryColors[index % categoryColors.length];
        const percent = Math.round((amount / total) * 100);
        return `
            <div class="donut-legend-row">
                <span class="legend-color" style="background:${color}"></span>
                <span>${escapeHtml(category)}</span>
                <strong>${currency.format(amount)} · ${percent}%</strong>
            </div>
        `;
    }).join("");
}

function renderTrendChart() {
    if (!trendChart || !trendRangeLabel) return;

    const months = getRecentMonths(6, selectedTrendMonth);
    const monthlyTotals = months.map((month) => {
        const label = formatShortMonthLabel(month);
        const income = transactions
            .filter((transaction) => transaction.type === "income" && transaction.transaction_date.startsWith(month))
            .reduce((sum, transaction) => sum + transaction.amount, 0);
        const expense = transactions
            .filter((transaction) => transaction.type === "expense" && transaction.transaction_date.startsWith(month))
            .reduce((sum, transaction) => sum + transaction.amount, 0);
        return { month, label, income, expense };
    });

    const max = Math.max(
        1,
        ...monthlyTotals.flatMap((item) => [item.income, item.expense]),
    );

    trendRangeLabel.textContent = `${formatRangeMonthLabel(monthlyTotals[0].month)} - ${formatRangeMonthLabel(monthlyTotals[monthlyTotals.length - 1].month)}`;
    trendChart.innerHTML = monthlyTotals.map((item) => {
        const incomeHeight = Math.max((item.income / max) * 100, item.income > 0 ? 6 : 0);
        const expenseHeight = Math.max((item.expense / max) * 100, item.expense > 0 ? 6 : 0);
        return `
            <div class="trend-month">
                <div class="trend-bars">
                    <span class="trend-bar income-bar" style="height:${incomeHeight}%" title="Income ${currency.format(item.income)}"></span>
                    <span class="trend-bar expense-bar" style="height:${expenseHeight}%" title="Expenses ${currency.format(item.expense)}"></span>
                </div>
                <strong>${item.label}</strong>
            </div>
        `;
    }).join("");
}

function renderActivityTimeline() {
    if (!activityTimeline || !activityCount) return;

    const recent = [...transactions]
        .sort((a, b) => new Date(`${b.transaction_date}T00:00:00`) - new Date(`${a.transaction_date}T00:00:00`))
        .slice(0, 5);

    activityCount.textContent = recent.length ? `${recent.length} latest items` : "No activity yet";

    if (!recent.length) {
        activityTimeline.innerHTML = `
            <div class="empty-state compact-empty">
                Add your first income or expense to build a live activity timeline.
            </div>
        `;
        return;
    }

    activityTimeline.innerHTML = recent.map((transaction) => {
        const isIncome = transaction.type === "income";
        const signedAmount = `${isIncome ? "+" : "-"}${currency.format(transaction.amount)}`;
        return `
            <article class="activity-item ${transaction.type}">
                <span class="activity-dot" aria-hidden="true"></span>
                <div>
                    <div class="activity-topline">
                        <strong>${escapeHtml(transaction.title)}</strong>
                        <span>${signedAmount}</span>
                    </div>
                    <p>${escapeHtml(transaction.category)} &middot; ${formatDate(transaction.transaction_date)}</p>
                    ${transaction.note ? `<small>${escapeHtml(transaction.note)}</small>` : ""}
                </div>
            </article>
        `;
    }).join("");
}

function renderRecurringExpenses() {
    if (!recurringList || !recurringCount) return;

    recurringCount.textContent = recurringItems.length
        ? `${recurringItems.length} saved bills`
        : "No saved bills";

    if (!recurringItems.length) {
        recurringList.innerHTML = `
            <div class="empty-state compact-empty">
                Save bills like rent, subscriptions, internet, or EMI to post them quickly each cycle.
            </div>
        `;
        return;
    }

    recurringList.innerHTML = recurringItems.map((item) => `
        <article class="recurring-item">
            <div>
                <strong>${escapeHtml(item.title)}</strong>
                <p>${escapeHtml(item.category)} &middot; ${capitalize(item.frequency)} &middot; Due ${formatDate(item.next_due_date)}</p>
                ${item.note ? `<small>${escapeHtml(item.note)}</small>` : ""}
            </div>
            <div class="recurring-actions">
                <span>${currency.format(item.amount)}</span>
                <button type="button" class="secondary-btn apply-recurring-btn" data-id="${item.id}">Post</button>
                <button type="button" class="delete-btn delete-recurring-btn" data-id="${item.id}">Delete</button>
            </div>
        </article>
    `).join("");
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    formMessage.textContent = "";

    let receipt = null;
    try {
        receipt = await readReceiptFile();
    } catch (error) {
        formMessage.textContent = error.message;
        return;
    }

    const payload = {
        title: document.querySelector("#title").value,
        amount: document.querySelector("#amount").value,
        type: document.querySelector("#type").value,
        category: document.querySelector("#category").value,
        transaction_date: dateInput.value,
        note: document.querySelector("#note").value,
        receipt,
    };

    const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const error = await response.json();
        formMessage.textContent = error.error || "Could not save transaction";
        return;
    }

    form.reset();
    dateInput.valueAsDate = new Date();
    receiptFileName.textContent = "Optional PNG, JPEG, or WebP under 650 KB";
    await loadTransactions();
});

budgetForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    budgetMessage.textContent = "";

    const response = await fetch("/api/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            month: getCurrentMonth(),
            amount: budgetAmount.value,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        budgetMessage.textContent = error.error || "Could not save budget";
        return;
    }

    budget = await response.json();
    budgetMessage.textContent = "Budget saved";
    renderBudget();
});

recurringForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    recurringMessage.textContent = "";

    const payload = {
        title: document.querySelector("#recurringTitle").value,
        amount: document.querySelector("#recurringAmount").value,
        category: document.querySelector("#recurringCategory").value,
        frequency: document.querySelector("#recurringFrequency").value,
        next_due_date: recurringDueDate.value,
        note: document.querySelector("#recurringNote").value,
    };

    const response = await fetch("/api/recurring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const error = await response.json();
        recurringMessage.textContent = error.error || "Could not save recurring bill";
        return;
    }

    recurringForm.reset();
    recurringDueDate.valueAsDate = new Date();
    recurringMessage.textContent = "Recurring bill saved";
    await loadTransactions();
});

recurringList?.addEventListener("click", async (event) => {
    const applyButton = event.target.closest(".apply-recurring-btn");
    const deleteButton = event.target.closest(".delete-recurring-btn");

    if (applyButton) {
        const response = await fetch(`/api/recurring/${applyButton.dataset.id}/apply`, { method: "POST" });
        if (!response.ok) {
            const error = await response.json();
            recurringMessage.textContent = error.error || "Could not post recurring bill";
            return;
        }
        recurringMessage.textContent = "Recurring bill posted to transactions";
        await loadTransactions();
        return;
    }

    if (deleteButton) {
        await fetch(`/api/recurring/${deleteButton.dataset.id}`, { method: "DELETE" });
        recurringMessage.textContent = "Recurring bill deleted";
        await loadTransactions();
    }
});

table.addEventListener("click", async (event) => {
    const receiptButton = event.target.closest(".receipt-btn");
    if (receiptButton) {
        const transaction = transactions.find((item) => String(item.id) === receiptButton.dataset.id);
        if (transaction?.receipt_data) {
            window.open(transaction.receipt_data, "_blank", "noopener");
        }
        return;
    }

    const button = event.target.closest(".delete-btn");
    if (!button) return;

    await fetch(`/api/transactions/${button.dataset.id}`, { method: "DELETE" });
    await loadTransactions();
});

receiptFile?.addEventListener("change", () => {
    const file = receiptFile.files[0];
    receiptFileName.textContent = file ? `${file.name} selected` : "Optional PNG, JPEG, or WebP under 650 KB";
});

filterType.addEventListener("change", render);
filterCategory.addEventListener("change", render);
filterDateFrom.addEventListener("change", render);
filterDateTo.addEventListener("change", render);
filterMinAmount.addEventListener("input", render);
filterMaxAmount.addEventListener("input", render);
searchInput.addEventListener("input", render);
clearFiltersBtn?.addEventListener("click", () => {
    searchInput.value = "";
    filterType.value = "all";
    filterCategory.value = "all";
    filterDateFrom.value = "";
    filterDateTo.value = "";
    filterMinAmount.value = "";
    filterMaxAmount.value = "";
    render();
});
exportCsvBtn?.addEventListener("click", exportTransactionsCsv);
themeToggle?.addEventListener("click", () => {
    const isLight = document.body.classList.toggle("light-theme");
    localStorage.setItem("fintrack-theme", isLight ? "light" : "dark");
    updateThemeToggle();
});
currencySelector?.addEventListener("change", () => {
    selectedCurrency = currencySelector.value;
    localStorage.setItem("fintrack-currency", selectedCurrency);
    currency = createCurrencyFormatter(selectedCurrency);
    render();
});
trendMonthPicker?.addEventListener("change", () => {
    selectedTrendMonth = trendMonthPicker.value || getCurrentMonth();
    renderTrendChart();
});

function formatDate(value) {
    return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function getCurrentMonth() {
    return new Date().toISOString().slice(0, 7);
}

function formatMonthLabel(value) {
    return new Date(`${value}-01T00:00:00`).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
    });
}

function formatShortMonthLabel(value) {
    return new Date(`${value}-01T00:00:00`).toLocaleDateString("en-US", {
        month: "short",
    });
}

function formatRangeMonthLabel(value) {
    return new Date(`${value}-01T00:00:00`).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
    });
}

function sumTransactionsByMonth(month, type) {
    return transactions
        .filter((transaction) => transaction.type === type && transaction.transaction_date.startsWith(month))
        .reduce((sum, transaction) => sum + transaction.amount, 0);
}

function getExpenseCategoryTotals(items) {
    return items
        .filter((transaction) => transaction.type === "expense")
        .reduce((groups, transaction) => {
            groups[transaction.category] = (groups[transaction.category] || 0) + transaction.amount;
            return groups;
        }, {});
}

function exportTransactionsCsv() {
    const rows = currentFilteredTransactions.length ? currentFilteredTransactions : getFilteredTransactions();
    const printedAt = new Date();
    const headers = ["Bill/Expense", "Category", "Due Date", "Budgeted Amount", "Actual Amount", "Status", "Notes"];
    const csv = [
        csvCell("FinTrack"),
        csvCell(`Bill printed: ${printedAt.toLocaleString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        })}`),
        "",
        headers.join(","),
        ...rows.map((transaction) => billCsvRow(transaction)),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `fintrack-bill-${printedAt.toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
}

function billCsvRow(transaction) {
    const recurringMatch = recurringItems.find((item) => (
        item.title.toLowerCase() === transaction.title.toLowerCase()
        && item.category === transaction.category
    ));
    const budgetedAmount = recurringMatch?.amount ?? transaction.amount;
    const notes = [
        transaction.note || "",
        transaction.receipt_name ? `Receipt: ${transaction.receipt_name}` : "",
    ].filter(Boolean).join(" | ");

    return [
        transaction.title,
        transaction.category,
        formatCsvDate(transaction.transaction_date),
        formatCsvMoney(budgetedAmount),
        formatCsvMoney(transaction.amount),
        transaction.type === "expense" ? "Paid" : "Received",
        notes || "-",
    ].map(csvCell).join(",");
}

function formatCsvDate(value) {
    return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

function formatCsvMoney(value) {
    return currency.format(Number(value) || 0);
}

function createCurrencyFormatter(code) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: code,
    });
}

function applySavedCurrency() {
    if (!currencySelector) return;
    currencySelector.value = selectedCurrency;
}

function csvCell(value) {
    return `"${String(value).replaceAll('"', '""')}"`;
}

function applySavedTheme() {
    const savedTheme = localStorage.getItem("fintrack-theme");
    document.body.classList.toggle("light-theme", savedTheme === "light");
    updateThemeToggle();
}

function updateThemeToggle() {
    if (!themeToggle) return;
    const nextTheme = document.body.classList.contains("light-theme") ? "Dark" : "Light";
    themeToggle.innerHTML = `<span>Theme</span><strong>${nextTheme}</strong>`;
}

function readReceiptFile() {
    return new Promise((resolve, reject) => {
        const file = receiptFile?.files[0];
        if (!file) {
            resolve(null);
            return;
        }

        if (!allowedReceiptTypes.includes(file.type)) {
            reject(new Error("Receipt must be a PNG, JPEG, or WebP image"));
            return;
        }

        if (file.size > maxReceiptSize) {
            reject(new Error("Receipt image must be smaller than 650 KB"));
            return;
        }

        const reader = new FileReader();
        reader.addEventListener("load", () => {
            resolve({
                name: file.name,
                type: file.type,
                data: reader.result,
            });
        });
        reader.addEventListener("error", () => reject(new Error("Could not read receipt image")));
        reader.readAsDataURL(file);
    });
}

function capitalize(value) {
    return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function getRecentMonths(count, endMonth = getCurrentMonth()) {
    const months = [];
    const [year, month] = endMonth.split("-").map(Number);
    const date = new Date(year, month - 1, 1);

    for (let index = count - 1; index >= 0; index -= 1) {
        const item = new Date(date.getFullYear(), date.getMonth() - index, 1);
        months.push(item.toISOString().slice(0, 7));
    }

    return months;
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

loadTransactions();
