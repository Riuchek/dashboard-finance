package main

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

const transparenciaBaseURL = "https://api.portaldatransparencia.gov.br/api-de-dados"

type TransparenciaClient struct {
	httpClient *http.Client
	apiKey     string
}

type DespesasPorOrgaoParams struct {
	Ano           string
	OrgaoSuperior string
	Orgao         string
	Pagina        string
}

type DespesasDocumentosParams struct {
	DataEmissao    string
	Fase           string
	UnidadeGestora string
	Pagina         string
}

func NewTransparenciaClient(httpClient *http.Client, apiKey string) *TransparenciaClient {
	return &TransparenciaClient{httpClient: httpClient, apiKey: apiKey}
}

func (c *TransparenciaClient) DespesasPorOrgao(ctx context.Context, p DespesasPorOrgaoParams) ([]byte, int, error) {
	if strings.TrimSpace(c.apiKey) == "" {
		return nil, 0, fmt.Errorf("TRANSPARENCIA_API_KEY is not set - register at https://portaldatransparencia.gov.br/api-de-dados/cadastrar-email")
	}

	q := url.Values{}
	q.Set("ano", p.Ano)
	q.Set("pagina", p.Pagina)
	if p.OrgaoSuperior != "" {
		q.Set("orgaoSuperior", p.OrgaoSuperior)
	}
	if p.Orgao != "" {
		q.Set("orgao", p.Orgao)
	}

	return c.get(ctx, "/despesas/por-orgao", q)
}

func (c *TransparenciaClient) DespesasDocumentos(ctx context.Context, p DespesasDocumentosParams) ([]byte, int, error) {
	if strings.TrimSpace(c.apiKey) == "" {
		return nil, 0, fmt.Errorf("TRANSPARENCIA_API_KEY is not set - register at https://portaldatransparencia.gov.br/api-de-dados/cadastrar-email")
	}

	q := url.Values{}
	q.Set("dataEmissao", p.DataEmissao)
	q.Set("fase", p.Fase)
	q.Set("pagina", p.Pagina)
	if p.UnidadeGestora != "" {
		q.Set("unidadeGestora", p.UnidadeGestora)
	}

	return c.get(ctx, "/despesas/documentos", q)
}

func (c *TransparenciaClient) get(ctx context.Context, path string, q url.Values) ([]byte, int, error) {
	endpoint := transparenciaBaseURL + path + "?" + q.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("chave-api-dados", c.apiKey)

	res, err := c.httpClient.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer res.Body.Close()

	body, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, res.StatusCode, err
	}
	return sanitizeJSONBytes(body), res.StatusCode, nil
}
