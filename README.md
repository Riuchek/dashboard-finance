# Dashboard Finance - Despesas Federais do Brasil

## Proposta de Projeto

### Integrantes
- **João Paulo Marinho Correia** - riuchek@gmail.com
- **Leonardo Celano Lentini** - leocelaano@gmail.com

---

## Descrição do Projeto

Dashboard interativo que exibe e analisa custos da administração pública federal, consumindo a **API pública do Tesouro Nacional**.

O projeto permite visualizar gastos do governo e compreender melhor como o dinheiro público está sendo utilizado.

---

## Funcionalidades Propostas

1. **Visualização de Custos**
   - Dashboard com resumo, gráfico por órgão e tabela detalhada

2. **Fonte de Dados**
   - Consumo da API pública de custos do Tesouro Nacional

---

## Tecnologias e Pré-requisitos

### Frontend
- **HTML5**
- **CSS3**
- **JavaScript (ES6+)**

### Backend
- **Go 1.21+**

### Infraestrutura
- **Docker**

### Dependências Externas
- **Tesouro Nacional (custos)** - `https://apidatalake.tesouro.gov.br/ords/custos/tt/demais`

---

## Como rodar

```bash
cp backend/.env.example backend/.env
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8080

Documentação da API: [docs/api.md](docs/api.md)
