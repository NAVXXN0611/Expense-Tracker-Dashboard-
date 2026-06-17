const form = document.querySelector("#transactionForm");
const table = document.querySelector("#transactionTable");
const chart = document.querySelector("#categoryChart");
const filterType = document.querySelector("#filterType");
const searchInput = document.querySelector("#searchInput");
const formMessage = document.querySelector("#formMessage");
const dateInput = document.querySelector("#transactionDate");
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

const currency = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
});

let transactions = [];
let budget = { month: getCurrentMonth(), amount: 0 };
let recurringItems = [];
let selectedTrendMonth = getCurrentMonth();

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
    const query = searchInput.value.trim().toLowerCase();
    const selectedType = filterType.value;
    const filtered = transactions.filter((transaction) => {
        const matchesType = selectedType === "all" || transaction.type === selectedType;
        const searchable = `${transaction.title} ${transaction.category} ${transaction.note}`.toLowerCase();
        return matchesType && searchable.includes(query);
    });

    renderSummary();
    renderWelcomeSummary();
    renderBudget();
    renderTable(filtered);
    renderChart(filtered);
    renderDonutChart();
    renderTrendChart();
    renderActivityTimeline();
    renderRecurringExpenses();
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
        table.innerHTML = `<tr><td colspan="6" class="empty-state">No transactions found</td></tr>`;
        return;
    }

    table.innerHTML = items.map((transaction) => `
        <tr>
            <td>${escapeHtml(transaction.title)}</td>
            <td>${escapeHtml(transaction.category)}</td>
            <td><span class="pill ${transaction.type}">${transaction.type}</span></td>
            <td>${currency.format(transaction.amount)}</td>
            <td>${formatDate(transaction.transaction_date)}</td>
            <td><button class="delete-btn" data-id="${transaction.id}">Delete</button></td>
        </tr>
    `).join("");
}

function renderChart(items) {
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

    const expenseTotals = transactions
        .filter((transaction) => transaction.type === "expense")
        .reduce((groups, transaction) => {
            groups[transaction.category] = (groups[transaction.category] || 0) + transaction.amount;
            return groups;
        }, {});
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

    const payload = {
        title: document.querySelector("#title").value,
        amount: document.querySelector("#amount").value,
        type: document.querySelector("#type").value,
        category: document.querySelector("#category").value,
        transaction_date: dateInput.value,
        note: document.querySelector("#note").value,
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
    const button = event.target.closest(".delete-btn");
    if (!button) return;

    await fetch(`/api/transactions/${button.dataset.id}`, { method: "DELETE" });
    await loadTransactions();
});

filterType.addEventListener("change", render);
searchInput.addEventListener("input", render);
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
