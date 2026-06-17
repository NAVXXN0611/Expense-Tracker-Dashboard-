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

const currency = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
});

let transactions = [];

dateInput.valueAsDate = new Date();
renderWelcomeDate();

async function loadTransactions() {
    const response = await fetch("/api/transactions");
    transactions = await response.json();
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
    renderTable(filtered);
    renderChart(filtered);
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

table.addEventListener("click", async (event) => {
    const button = event.target.closest(".delete-btn");
    if (!button) return;

    await fetch(`/api/transactions/${button.dataset.id}`, { method: "DELETE" });
    await loadTransactions();
});

filterType.addEventListener("change", render);
searchInput.addEventListener("input", render);

function formatDate(value) {
    return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
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
