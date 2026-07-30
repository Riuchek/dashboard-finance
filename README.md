# Dashboard Finance - Despesas Federais do Brasil

## Proposta de Projeto

### Integrantes
- **João Paulo Marinho Correia** - riuchek@gmail.com

---

## Descrição do Projeto

Dashboard interativo que exibe e analisa despesas do governo federal brasileiro, consumindo dados públicos da **API Portal da Transparência do Governo Federal**.

O projeto permite visualizar gastos por período, filtrar por órgão/ministério, e compreender melhor como o dinheiro público está sendo utilizado.

---

## Funcionalidades Propostas

1. **Seletor de Período**
   - Filtro por ano e mês
   - Botão "Buscar" para atualizar dados

2. **Visualização de Despesas**
   - Gráfico de pizza (top 10 órgãos)
   - Tabela com listagem de despesas
   - Cards com métricas (total gasto, quantidade de órgãos)

3. **Interatividade**
   - Filtro por órgão/ministério
   - Busca por nome
   - Ordenação por valor
   - Responsividade (mobile, tablet, desktop)

4. **Fonte de Dados**
   - Consumo da API Portal da Transparência

---

## Tecnologias e Pré-requisitos

### Frontend
- **HTML5**
- **CSS3**
- **JavaScript (ES6+)**

### Backend
- **Go 1.21+**

### Infraestrutura
- **Docker** - Containerização

### Pré-requisitos do Sistema
- Docker 20.10+
- Docker Compose 2.0+
- Git
- **Hardware mínimo:** 2GB RAM, 1GB disco
- **Conexão com internet** (para consumir API externa)

### Dependências Externas
- **Portal da Transparência API** - https://api.portaldatransparencia.gov.br/
  - Público, sem autenticação
  - Rate limit: 400 req/minuto
  - Documentação: https://api.portaldatransparencia.gov.br/swagger-ui/index.html

---

## 📁 Estrutura do Projeto

A definir