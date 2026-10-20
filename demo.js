// Demo ao vivo do simulador de renda fixa (github.com/Bugvoid/simulador-renda-fixa).
// Vazio enquanto a API não está publicada: a demo mostra a mensagem de indisponível.
export const API_URL = "";
export const UNAVAILABLE = "Demo indisponível no momento — veja o código";

const MAX_AMOUNT = 10_000_000;
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const pct = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rate = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

/** Aceita "1000", "1000,50", "1.000,50" e "R$ 1.000,50". Fora de (0, 10 mi] ou inválido → null. */
export function parseAmount(text) {
  const clean = String(text).replace(/R\$|\s/g, "").replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const n = Number(clean);
  return n > 0 && n <= MAX_AMOUNT ? n : null;
}

export const brl = (n) => money.format(n);

export async function simulate(payload, fetchImpl = fetch, timeoutMs = 8000, apiUrl = API_URL) {
  if (!apiUrl) return { ok: false, message: UNAVAILABLE };
  const controller = new AbortController();
  const timeout = new Promise((resolve) =>
    setTimeout(() => { controller.abort(); resolve(null); }, timeoutMs));
  try {
    const resp = await Promise.race([
      fetchImpl(`${apiUrl}/simulate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      }),
      timeout,
    ]);
    if (!resp) return { ok: false, message: UNAVAILABLE };
    const data = await resp.json().catch(() => null);
    if (resp.status === 400 && data?.error) return { ok: false, message: data.error };
    if (!resp.ok || !data) return { ok: false, message: UNAVAILABLE };
    return { ok: true, data };
  } catch {
    return { ok: false, message: UNAVAILABLE };
  }
}

const LABELS = { CDB: "CDB", LCI: "LCI" };

function renderTable(data) {
  const rows = data.results.map((r) => `
      <tr>
        <td>${LABELS[r.product] ?? r.product} ${rate.format(r.rate)}% do CDI</td>
        <td class="money">${brl(r.net)}</td>
        <td>${brl(r.ir)}</td>
        <td>${pct.format(r.net_annual)}%</td>
      </tr>`).join("");
  return `
    <table>
      <caption>Valor líquido no fim do prazo, com CDI de ${pct.format(data.assumptions.cdi)}% e ${data.assumptions.business_days} dias úteis.</caption>
      <thead><tr><th scope="col">Investimento</th><th scope="col">Líquido</th><th scope="col">IR pago</th><th scope="col">Rentab. a.a.</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function wire() {
  const form = document.getElementById("demo-form");
  const result = document.getElementById("demo-result");
  const error = document.getElementById("amount-error");
  const button = document.getElementById("demo-submit");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (button.disabled) return;

    const field = (id) => document.getElementById(id);
    const amount = parseAmount(field("amount").value);
    const days = Number(field("days").value);
    const cdb = Number(field("cdb-rate").value.replace(",", "."));
    const lci = Number(field("lci-rate").value.replace(",", "."));

    const problems = [
      [amount === null, "amount", "Informe um valor entre R$ 1 e R$ 10.000.000, por exemplo 10.000."],
      [!Number.isInteger(days) || days < 1 || days > 12000, "days", "Informe o prazo em dias inteiros, de 1 a 12.000."],
      [!(cdb > 0), "cdb-rate", "Informe a taxa do CDB em % do CDI, por exemplo 110."],
      [!(lci > 0), "lci-rate", "Informe a taxa da LCI em % do CDI, por exemplo 92."],
    ];
    for (const [, id] of problems) field(id).removeAttribute("aria-invalid");
    const first = problems.find(([bad]) => bad);
    if (first) {
      field(first[1]).setAttribute("aria-invalid", "true");
      field(first[1]).focus();
      error.textContent = first[2];
      return;
    }
    error.textContent = "";

    button.disabled = true;
    button.textContent = "Calculando…";
    const r = await simulate({
      amount, days,
      investments: [
        { product: "CDB", indexer: "POS", rate: cdb },
        { product: "LCI", indexer: "POS", rate: lci },
      ],
    });
    result.innerHTML = r.ok
      ? renderTable(r.data)
      : `<p class="unavailable"></p>`;
    if (!r.ok) {
      result.firstChild.textContent = `${r.message} `;
      if (r.message === UNAVAILABLE) {
        const link = document.createElement("a");
        link.href = "https://github.com/Bugvoid/simulador-renda-fixa";
        link.textContent = "no GitHub";
        result.firstChild.append(link, ".");
      }
    }
    button.disabled = false;
    button.textContent = "Calcular rendimento líquido";
  });
}

if (typeof document !== "undefined") wire();
