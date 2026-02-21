function apiBase() {
  return document.getElementById("apiBase").value.trim();
}

function operatorToken() {
  return document.getElementById("operatorToken").value.trim();
}

async function callApi(path, options = {}) {
  const headers = options.headers || {};
  const response = await fetch(`${apiBase()}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.detail || JSON.stringify(body));
  }
  return body;
}

async function loadPools() {
  const pools = await callApi("/pools");
  const body = document.getElementById("poolsBody");
  body.innerHTML = "";
  pools.forEach((pool) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${pool.country}</td><td>${pool.balance_minor}</td><td>${pool.currency}</td>`;
    body.appendChild(tr);
  });
}

async function loadForecast() {
  const country = document.getElementById("forecastCountry").value;
  const forecast = await callApi(`/forecast?country=${country}`);
  document.getElementById("forecastOutput").textContent = JSON.stringify(forecast, null, 2);
}

async function loadSettlements() {
  const settlements = await callApi("/settlements");
  const body = document.getElementById("settlementsBody");
  body.innerHTML = "";
  settlements.forEach((s) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${s.id}</td>
      <td>${s.period}</td>
      <td>${s.from_country}</td>
      <td>${s.to_country}</td>
      <td>${s.recommended_minor}</td>
      <td>${s.status}</td>
      <td><button data-id="${s.id}" ${s.status === "executed" ? "disabled" : ""}>Execute</button></td>
    `;
    tr.querySelector("button").addEventListener("click", async (e) => {
      const id = e.target.dataset.id;
      await callApi(`/settlements/${id}/execute`, {
        method: "POST",
        headers: { "X-Operator-Token": operatorToken() },
      });
      await refreshAll();
    });
    body.appendChild(tr);
  });
}

async function refreshAll() {
  await loadPools();
  await loadSettlements();
  await loadForecast();
}

document.getElementById("paymentForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = {
    country: document.getElementById("country").value,
    company_id: document.getElementById("companyId").value,
    amount_minor: Number(document.getElementById("amountMinor").value),
    currency: document.getElementById("currency").value,
    service_type: document.getElementById("serviceType").value,
  };
  const idemKey = `idem-${Date.now()}`;
  try {
    const payment = await callApi("/payments", {
      method: "POST",
      headers: { "Idempotency-Key": idemKey },
      body: JSON.stringify(payload),
    });
    document.getElementById("paymentStatus").textContent = `Created payment #${payment.id} (${payment.stripe_payment_intent_id})`;
    document.getElementById("simPi").value = payment.stripe_payment_intent_id;
  } catch (err) {
    document.getElementById("paymentStatus").textContent = `Error: ${err.message}`;
  }
});

document.getElementById("simulateSuccess").addEventListener("click", async () => {
  const pi = document.getElementById("simPi").value.trim();
  try {
    await callApi("/stripe/webhook", {
      method: "POST",
      body: JSON.stringify({
        type: "payment_intent.succeeded",
        data: { object: { id: pi } },
      }),
    });
    document.getElementById("webhookStatus").textContent = `Marked ${pi} as succeeded`;
    await refreshAll();
  } catch (err) {
    document.getElementById("webhookStatus").textContent = `Error: ${err.message}`;
  }
});

document.getElementById("runSettlement").addEventListener("click", async () => {
  await callApi("/settlements/run", {
    method: "POST",
    headers: { "X-Operator-Token": operatorToken() },
  });
  await refreshAll();
});

document.getElementById("loadSettlements").addEventListener("click", loadSettlements);
document.getElementById("loadForecast").addEventListener("click", loadForecast);
document.getElementById("refreshAll").addEventListener("click", refreshAll);

refreshAll().catch((err) => {
  document.getElementById("paymentStatus").textContent = `Startup error: ${err.message}`;
});
