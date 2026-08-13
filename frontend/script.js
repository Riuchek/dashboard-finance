const API_BASE = 'http://localhost:8080';

let custosChartInstance = null;

const state = {
  custosOffset: 0,
  custosLimit: 20,
  allItems: [],
};

function parseBRNumber(value) {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const normalized = String(value).replace(/\./g, '').replace(',', '.');
  const n = parseFloat(normalized);
  return Number.isNaN(n) ? 0 : n;
}

function formatBRL(value) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

async function apiGet(path) {
  try {
    const res = await fetch(`${API_BASE}${path}`);
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, data: null, networkError: err.message };
  }
}

const $ = (id) => document.getElementById(id);

function setStatus(kind, text) {
  const dot = $('statusDot');
  dot.classList.remove('ok', 'error');
  if (kind === 'ok' || kind === 'error') dot.classList.add(kind);
  $('statusText').textContent = text;
}

async function checkHealth() {
  const { ok, data } = await apiGet('/health');
  if (ok && data && data.status === 'ok') {
    setStatus('ok', 'backend online');
  } else {
    setStatus('error', 'backend indisponível — verifique se o Go está rodando na porta 8080');
  }
}

function itemValor(item) {
  return typeof item.va_custo === 'number' ? item.va_custo : parseBRNumber(item.va_custo);
}

function renderLedger(items) {
  const total = items.reduce((acc, item) => acc + itemValor(item), 0);
  const orgaos = new Set(items.map((i) => i.ds_siorg_n05).filter(Boolean));

  const porNatureza = new Map();
  items.forEach((item) => {
    const key = item.no_natureza_despesa_deta || '—';
    porNatureza.set(key, (porNatureza.get(key) || 0) + itemValor(item));
  });

  let topNatureza = '—';
  let topValor = 0;
  porNatureza.forEach((valor, nome) => {
    if (valor > topValor) {
      topValor = valor;
      topNatureza = nome;
    }
  });

  $('kpiTotal').textContent = formatBRL(total);
  $('kpiItens').textContent = items.length.toString();
  $('kpiOrgaos').textContent = orgaos.size.toString();
  $('kpiNatureza').textContent = topNatureza;
}

function resetLedger() {
  ['kpiTotal', 'kpiItens', 'kpiOrgaos', 'kpiNatureza'].forEach((id) => {
    $(id).textContent = '—';
  });
}

function aggregateByOrgao(items) {
  const map = new Map();
  items.forEach((item) => {
    const key = item.ds_siorg_n05 || 'Órgão sem nome';
    map.set(key, (map.get(key) || 0) + itemValor(item));
  });
  return [...map.entries()]
    .map(([nome, valor]) => ({ nome, valor }))
    .sort((a, b) => b.valor - a.valor);
}

function renderChart(items) {
  const canvas = $('custosChart');
  const empty = $('chartEmpty');
  const ranked = aggregateByOrgao(items).slice(0, 8);

  if (ranked.length === 0) {
    canvas.hidden = true;
    empty.hidden = false;
    if (custosChartInstance) custosChartInstance.destroy();
    return;
  }

  canvas.hidden = false;
  empty.hidden = true;

  if (custosChartInstance) custosChartInstance.destroy();

  custosChartInstance = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: ranked.map((r) => r.nome),
      datasets: [
        {
          label: 'Custo',
          data: ranked.map((r) => r.valor),
          backgroundColor: '#2c4a86',
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: '#93a1bd' } },
      },
      scales: {
        x: { ticks: { color: '#93a1bd' }, grid: { color: '#263452' } },
        y: {
          ticks: {
            color: '#93a1bd',
            callback: (v) => v.toLocaleString('pt-BR', { notation: 'compact' }),
          },
          grid: { color: '#263452' },
        },
      },
    },
  });
}

function renderTesouroTable(items, append) {
  const tbody = $('tesouroTbody');
  const empty = $('tesouroEmpty');

  if (!append) tbody.innerHTML = '';

  if ((!items || items.length === 0) && tbody.children.length === 0) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  items.forEach((item) => {
    const tr = document.createElement('tr');
    const orgao = item.ds_siorg_n05 ?? '—';
    const unidade = item.ds_siorg_n06 || item.ds_siorg_n07 || '—';
    const mes = item.sg_mes_completo ?? '—';
    const natureza = item.no_natureza_despesa_deta ?? '—';
    const valor = itemValor(item);

    tr.innerHTML = `
      <td>${orgao}</td>
      <td>${unidade}</td>
      <td>${mes}</td>
      <td>${natureza}</td>
      <td class="num">${formatBRL(valor)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function showFormError(message) {
  const el = $('formError');
  if (!message) {
    el.hidden = true;
    el.textContent = '';
    return;
  }
  el.hidden = false;
  el.textContent = message;
}

async function loadCustos(append = false) {
  const ano = $('ano').value;
  const mes = $('mes').value;

  const { ok, data, networkError, status } = await apiGet(
    `/api/v1/custos?ano=${encodeURIComponent(ano)}&mes=${encodeURIComponent(mes)}&limit=${state.custosLimit}&offset=${state.custosOffset}`
  );

  if (networkError) {
    showFormError('Não foi possível falar com o backend. Ele está rodando em http://localhost:8080?');
    if (!append) {
      state.allItems = [];
      resetLedger();
      renderChart([]);
      renderTesouroTable([], false);
    }
    $('tesouroLoadMore').disabled = true;
    return;
  }

  if (!ok) {
    const msg = (data && data.error) || `erro HTTP ${status}`;
    showFormError(`Tesouro Nacional: ${msg}`);
    if (!append) {
      state.allItems = [];
      resetLedger();
      renderChart([]);
      renderTesouroTable([], false);
    }
    $('tesouroLoadMore').disabled = true;
    return;
  }

  showFormError(null);
  const items = data?.items || [];

  if (append) {
    state.allItems = state.allItems.concat(items);
  } else {
    state.allItems = items;
  }

  renderLedger(state.allItems);
  renderChart(state.allItems);
  renderTesouroTable(items, append);
  $('tesouroLoadMore').disabled = !data?.hasMore;
}

async function loadDashboard() {
  const button = document.querySelector('#filtersForm .btn-primary');
  button.disabled = true;
  button.textContent = 'Consultando…';

  state.custosOffset = 0;
  state.allItems = [];
  await loadCustos(false);

  button.disabled = false;
  button.textContent = 'Consultar';
}

document.addEventListener('DOMContentLoaded', () => {
  checkHealth();
  loadDashboard();

  $('filtersForm').addEventListener('submit', (event) => {
    event.preventDefault();
    loadDashboard();
  });

  $('tesouroLoadMore').addEventListener('click', () => {
    state.custosOffset += state.custosLimit;
    loadCustos(true);
  });
});
