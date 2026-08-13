# API do backend

Base URL (local): `http://localhost:8080`

Todas as rotas são `GET`. Respostas em JSON.

Fonte de dados: **Tesouro Nacional** (API pública de custos). Não exige API key.

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

## `GET /api/v1/custos`

Consulta itens de custo no **Tesouro Nacional** (endpoint `demais`).

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

## Erros comuns

| Situação | O que acontece |
| --- | --- |
| Sem `ano` | `400` com `{"error":"ano is required (YYYY)"}` |
| Fonte externa fora do ar | `502` com mensagem do client HTTP |
