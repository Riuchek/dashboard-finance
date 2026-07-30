# API do backend

Base URL (local): `http://localhost:8080`

Todas as rotas são `GET`. Respostas em JSON.

---

## `GET /health`

Verifica se o servidor está no ar.

```bash
curl -s http://localhost:8080/health | jq
```

**Resposta**

```json
{ "status": "ok" }
```

---

## `GET /api/v1/despesas/por-orgao`

Consulta despesas agregadas por órgão no **Portal da Transparência**.

### Query params

| Param | Obrigatório | Exemplo | Descrição |
| --- | --- | --- | --- |
| `ano` | Sim | `2024` | Ano da despesa (AAAA) |
| `pagina` | Não | `1` | Página (default `1`) |
| `orgaoSuperior` | Condicional | `26000` | Código SIAFI do órgão superior |
| `orgao` | Condicional | `26298` | Código SIAFI do órgão/entidade |

A API do governo exige **ao menos um** entre `orgaoSuperior` e `orgao`.

### Exemplos

```bash
# Ministério da Educação (órgão superior 26000)
curl -s "http://localhost:8080/api/v1/despesas/por-orgao?ano=2024&pagina=1&orgaoSuperior=26000" | jq

# Só um órgão específico
curl -s "http://localhost:8080/api/v1/despesas/por-orgao?ano=2024&pagina=1&orgao=26298" | jq
```

### Códigos SIAFI úteis (órgão superior)

| Código | Órgão |
| --- | --- |
| `20000` | Presidência da República |
| `25000` | Ministério da Fazenda |
| `26000` | Ministério da Educação |
| `36000` | Ministério da Saúde |

### Campos comuns na resposta

Lista de objetos com, entre outros:

- `orgao` / `codigoOrgao`
- `orgaoSuperior` / `codigoOrgaoSuperior`
- `empenhado`, `liquidado`, `pago` (valores em string formatada BR)

---

## `GET /api/v1/despesas/documentos`

Consulta documentos de despesa (empenho, liquidação ou pagamento) no **Portal da Transparência**.

### Query params

| Param | Obrigatório | Exemplo | Descrição |
| --- | --- | --- | --- |
| `dataEmissao` | Sim | `15/01/2024` | Data no formato DD/MM/AAAA |
| `fase` | Sim | `3` | `1` empenho · `2` liquidação · `3` pagamento |
| `pagina` | Não | `1` | Página (default `1`) |
| `unidadeGestora` | Condicional | `153173` | Código SIAFI da UG |
| `gestao` | Condicional | — | Código de gestão (alternativa à UG) |

A API do governo exige **ao menos um** entre `unidadeGestora` e `gestao`.

### Exemplo

```bash
curl -s "http://localhost:8080/api/v1/despesas/documentos?dataEmissao=15/01/2024&fase=3&pagina=1&unidadeGestora=153173" | jq
```

### Campos comuns na resposta

Lista de documentos com, entre outros:

- `data`, `documento`, `documentoResumido`
- `funcao`, `subfuncao`, `programa`, `acao`
- valores e favorecido (quando presentes)

---

## `GET /api/v1/custos`

Consulta itens de custo no **Tesouro Nacional** (endpoint `demais`).

Não precisa de API key.

### Query params

| Param | Obrigatório | Exemplo | Descrição |
| --- | --- | --- | --- |
| `ano` | Sim | `2024` | Ano de referência |
| `mes` | Não | `1` | Mês (1–12) |
| `limit` | Não | `50` | Itens por página (default `50`) |
| `offset` | Não | `0` | Offset da paginação (default `0`) |

### Exemplo

```bash
curl -s "http://localhost:8080/api/v1/custos?ano=2024&mes=1&limit=5" | jq
```

### Campos comuns na resposta

Envelope ORDS do Tesouro:

```json
{
  "items": [ ... ],
  "hasMore": true,
  "limit": 5,
  "offset": 0,
  "count": 5
}
```

Cada item inclui, entre outros:

- `ds_siorg_n05` — ministério/órgão
- `ds_siorg_n06` / `ds_siorg_n07` — unidade
- `sg_mes_completo` — ex.: `JAN/2024`
- `no_natureza_despesa_deta` — natureza da despesa
- `va_custo` — valor do custo (número)

---

## `GET /api/v1/gastos`

Bate nas **duas fontes** e devolve o status de cada uma.

### Query params

| Param | Obrigatório | Default | Descrição |
| --- | --- | --- | --- |
| `ano` | Não | `2024` | Ano |
| `mes` | Não | `1` | Mês (Tesouro) |
| `orgaoSuperior` | Não | `26000` (MEC) | Órgão superior SIAFI (Transparência) |

### Exemplo

```bash
curl -s "http://localhost:8080/api/v1/gastos?ano=2024&mes=1" | jq
curl -s "http://localhost:8080/api/v1/gastos?ano=2024&mes=1&orgaoSuperior=36000" | jq
```

### Formato da resposta

```json
{
  "ano": "2024",
  "mes": "1",
  "sources": [
    {
      "source": "portal_transparencia",
      "ok": true,
      "data": [ ... ]
    },
    {
      "source": "tesouro_custos",
      "ok": true,
      "data": { "items": [ ... ] }
    }
  ]
}
```

Se uma fonte falhar, `ok` vem `false` e o campo `error` traz a mensagem (a outra fonte ainda pode ter sucesso).

---

## Erros comuns

| Situação | O que acontece |
| --- | --- |
| Sem `TRANSPARENCIA_API_KEY` | `502` / `error` pedindo o cadastro da key |
| Transparência sem `orgaoSuperior`/`orgao` | JSON `{"Erro na API":"Filtros mínimos..."}` |
| Documentos sem UG/gestão | JSON `{"Erro na API":"Filtros mínimos..."}` |
| Fonte externa fora do ar | `502` com mensagem do client HTTP |
