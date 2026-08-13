// =====================================================================
// Dashboard Finance — frontend em JavaScript puro (sem framework).
//
// Ideia geral do arquivo:
//   1) Configuração (URL do backend, estado da paginação)
//   2) Funções utilitárias (formatação de número BR, requisição fetch)
//   3) Funções que "desenham" cada pedaço da tela (ledger, gráfico, tabelas)
//   4) Orquestração: o que roda quando a página carrega e quando cada
//      formulário é enviado
// =====================================================================

// --- 1) CONFIGURAÇÃO ---------------------------------------------------

// Endereço do backend Go. Em desenvolvimento local ele roda em 8080
// (veja docker-compose.yml / .env.example). Se você hospedar o backend
// em outro lugar, troque só esta linha.
const API_BASE = 'http://localhost:8080';

// Referência ao gráfico do Chart.js (guardamos aqui para poder destruir
// e recriar quando o usuário consulta de novo, senão os gráficos
// antigos ficam "empilhados" por baixo).
let despesasChartInstance = null;

// Estado de paginação. A API do governo pagina por número de página
// (despesas / documentos) ou por offset (custos do Tesouro), então
// guardamos os dois formatos.
const state = {
  despesasPagina: 1,
  documentosPagina: 1,
  custosOffset: 0,
  custosLimit: 20,
};


// --- 2) UTILITÁRIOS ------------------------------------------------------

/**
 * A API do governo devolve valores como string no formato brasileiro,
 * ex: "1.234.567,89". Esta função converte isso para um número JS.
 */
function parseBRNumber(value) {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const normalized = String(value).replace(/\./g, '').replace(',', '.');
  const n = parseFloat(normalized);
  return Number.isNaN(n) ? 0 : n;
}

/** Formata um número como moeda brasileira (R$). */
function formatBRL(value) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Converte "2024-01-15" (input type=date) para "15/01/2024" (formato que a API espera). */
function toBRDate(isoDate) {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Wrapper em torno do fetch nativo.
 * Sempre devolve { ok, status, data } em vez de lançar exceção,
 * assim quem chama não precisa ficar espalhando try/catch por toda parte.
 */
async function apiGet(path) {
  try {
    const res = await fetch(`${API_BASE}${path}`);
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    // Erro de rede (backend fora do ar, CORS bloqueado, etc.)
    return { ok: false, status: 0, data: null, networkError: err.message };
  }
}

/** Pequeno helper para não repetir document.getElementById toda hora. */
const $ = (id) => document.getElementById(id);


// --- 3) FUNÇÕES DE DESENHO -----------------------------------------------

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

/**
 * Tenta extrair um "nome legível" de um item de despesa por órgão.
 * A API pública às vezes muda um pouco o formato da resposta,
 * então checamos algumas variações conhecidas em vez de assumir uma única.
 */
function extractOrgaoNome(item) {
  if (item.orgao && typeof item.orgao === 'object') {
    return item.orgao.nome || item.orgao.sigla || item.orgao.codigo || 'Órgão sem nome';
  }
  return item.orgao || item.nomeOrgao || item.descricaoOrgao || 'Órgão sem nome';
}

/** Renderiza o "ledger" (cartões de resumo) a partir da lista de despesas por órgão. */
function renderLedger(despesas) {
  const totals = despesas.reduce(
    (acc, item) => {
      acc.empenhado += parseBRNumber(item.empenhado);
      acc.liquidado += parseBRNumber(item.liquidado);
      acc.pago += parseBRNumber(item.pago);
      return acc;
    },
    { empenhado: 0, liquidado: 0, pago: 0 }
  );

  $('kpiEmpenhado').textContent = formatBRL(totals.empenhado);
  $('kpiLiquidado').textContent = formatBRL(totals.liquidado);
  $('kpiPago').textContent = formatBRL(totals.pago);
  $('kpiOrgaos').textContent = despesas.length.toString();
}

function resetLedger() {
  ['kpiEmpenhado', 'kpiLiquidado', 'kpiPago', 'kpiOrgaos'].forEach((id) => {
    $(id).textContent = '—';
  });
}

/** Desenha o gráfico de barras (empenhado / liquidado / pago por órgão). */
function renderChart(despesas) {
  const canvas = $('despesasChart');
  const empty = $('chartEmpty');

  if (!despesas || despesas.length === 0) {
    canvas.hidden = true;
    empty.hidden = false;
    if (despesasChartInstance) despesasChartInstance.destroy();
    return;
  }
  canvas.hidden = false;
  empty.hidden = true;

  // Para não poluir o gráfico, mostramos só os 8 órgãos com maior valor pago
  // desta página. Se quiser ver outros órgãos, use a paginação.
  const top = [...despesas]
    .sort((a, b) => parseBRNumber(b.pago) - parseBRNumber(a.pago))
    .slice(0, 8);

  const labels = top.map(extractOrgaoNome);
  const empenhado = top.map((i) => parseBRNumber(i.empenhado));
  const liquidado = top.map((i) => parseBRNumber(i.liquidado));
  const pago = top.map((i) => parseBRNumber(i.pago));

  if (despesasChartInstance) despesasChartInstance.destroy();

  despesasChartInstance = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Empenhado', data: empenhado, backgroundColor: '#2c4a86' },
        { label: 'Liquidado', data: liquidado, backgroundColor: '#4f86f7' },
        { label: 'Pago', data: pago, backgroundColor: '#d1a441' },
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

/** Renderiza a tabela de custos do Tesouro Nacional. */
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
    const valor = typeof item.va_custo === 'number' ? item.va_custo : parseBRNumber(item.va_custo);

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

/** Renderiza a tabela de documentos de despesa (empenho/liquidação/pagamento). */
function renderDocumentosTable(items) {
  const tbody = $('documentosTbody');
  const empty = $('documentosEmpty');
  tbody.innerHTML = '';

  if (!items || items.length === 0) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  items.forEach((item) => {
    const tr = document.createElement('tr');
    const data = item.data ?? '—';
    const documento = item.documentoResumido || item.documento || '—';
    const funcao = item.funcao ?? '—';
    const programa = item.programa ?? '—';
    const favorecido = item.favorecido?.nome || item.favorecido || '—';

    tr.innerHTML = `
      <td>${data}</td>
      <td>${documento}</td>
      <td>${funcao}</td>
      <td>${programa}</td>
      <td>${favorecido}</td>
    `;
    tbody.appendChild(tr);
  });
}


// --- 4) ORQUESTRAÇÃO -------------------------------------------------------

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

/** Busca despesas por órgão (gráfico + ledger), respeitando a página atual. */
async function loadDespesas() {
  const ano = $('ano').value;
  const orgaoSuperior = $('orgaoSuperior').value;

  const { ok, data, networkError, status } = await apiGet(
    `/api/v1/despesas/por-orgao?ano=${encodeURIComponent(ano)}&orgaoSuperior=${encodeURIComponent(orgaoSuperior)}&pagina=${state.despesasPagina}`
  );

  if (networkError) {
    showFormError('Não foi possível falar com o backend. Ele está rodando em http://localhost:8080?');
    resetLedger();
    renderChart([]);
    return;
  }

  if (!ok) {
    resetLedger();
    renderChart([]);
    const msg = (data && (data.error || data['Erro na API'])) || `erro HTTP ${status}`;
    showFormError(
      String(msg).includes('TRANSPARENCIA_API_KEY')
        ? 'Falta configurar TRANSPARENCIA_API_KEY no backend/.env (cadastre em portaldatransparencia.gov.br) — o gráfico depende dessa fonte.'
        : `Portal da Transparência: ${msg}`
    );
    return;
  }

  showFormError(null);
  const despesas = Array.isArray(data) ? data : [];
  renderLedger(despesas);
  renderChart(despesas);
  $('despesasPageLabel').textContent = `página ${state.despesasPagina}`;
  $('despesasPrev').disabled = state.despesasPagina <= 1;
  // A API não informa o total de páginas; desabilitamos "próxima" só quando a página vem vazia.
  $('despesasNext').disabled = despesas.length === 0;
}

/** Busca custos do Tesouro (tabela), com "carregar mais" via offset. */
async function loadCustos(append = false) {
  const ano = $('ano').value;
  const mes = $('mes').value;

  const { ok, data, networkError } = await apiGet(
    `/api/v1/custos?ano=${encodeURIComponent(ano)}&mes=${encodeURIComponent(mes)}&limit=${state.custosLimit}&offset=${state.custosOffset}`
  );

  if (networkError || !ok) {
    if (!append) renderTesouroTable([], false);
    $('tesouroLoadMore').disabled = true;
    return;
  }

  const items = data?.items || [];
  renderTesouroTable(items, append);
  $('tesouroLoadMore').disabled = !data?.hasMore;
}

/** Busca documentos de despesa a partir do formulário próprio da seção. */
async function loadDocumentos(event) {
  event.preventDefault();

  const dataEmissao = toBRDate($('docData').value);
  const fase = $('docFase').value;
  const unidadeGestora = $('docUnidadeGestora').value.trim();
  const button = event.target.querySelector('button[type="submit"]');

  if (!$('docData').value || !unidadeGestora) {
    showDocumentosError('Preencha a data e a unidade gestora.');
    return;
  }

  button.disabled = true;
  button.textContent = 'Buscando…';
  showDocumentosError(null);

  const { ok, data, networkError } = await apiGet(
    `/api/v1/despesas/documentos?dataEmissao=${encodeURIComponent(dataEmissao)}&fase=${fase}&unidadeGestora=${encodeURIComponent(unidadeGestora)}&pagina=${state.documentosPagina}`
  );

  button.disabled = false;
  button.textContent = 'Buscar documentos';

  if (networkError || !ok) {
    const msg = (data && (data.error || data['Erro na API'])) || 'não foi possível consultar';
    showDocumentosError(`Documentos: ${msg}`);
    renderDocumentosTable([]);
    return;
  }

  const items = Array.isArray(data) ? data : [];
  renderDocumentosTable(items);
  $('documentosPageLabel').textContent = `página ${state.documentosPagina}`;
}

function showDocumentosError(message) {
  const el = $('documentosError');
  if (!message) {
    el.hidden = true;
    el.textContent = '';
    return;
  }
  el.hidden = false;
  el.textContent = message;
}

async function loadDashboard() {
  const button = document.querySelector('#filtersForm .btn-primary');
  button.disabled = true;
  button.textContent = 'Consultando…';

  state.despesasPagina = 1;
  state.custosOffset = 0;

  await Promise.all([loadDespesas(), loadCustos(false)]);

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

  $('despesasPrev').addEventListener('click', () => {
    if (state.despesasPagina <= 1) return;
    state.despesasPagina -= 1;
    loadDespesas();
  });
  $('despesasNext').addEventListener('click', () => {
    state.despesasPagina += 1;
    loadDespesas();
  });

  $('tesouroLoadMore').addEventListener('click', () => {
    state.custosOffset += state.custosLimit;
    loadCustos(true);
  });

  $('documentosForm').addEventListener('submit', loadDocumentos);
});
