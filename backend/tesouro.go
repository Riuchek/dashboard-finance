package main

import (
	"context"
	"io"
	"net/http"
	"net/url"
)

const tesouroBaseURL = "https://apidatalake.tesouro.gov.br/ords/custos/tt"

type TesouroClient struct {
	httpClient *http.Client
}

type CustosParams struct {
	Ano    string
	Mes    string
	Limit  string
	Offset string
}

func NewTesouroClient(httpClient *http.Client) *TesouroClient {
	return &TesouroClient{httpClient: httpClient}
}

func (c *TesouroClient) DemaisCustos(ctx context.Context, p CustosParams) ([]byte, int, error) {
	q := url.Values{}
	q.Set("ano", p.Ano)
	if p.Mes != "" {
		q.Set("mes", p.Mes)
	}
	if p.Limit != "" {
		q.Set("limit", p.Limit)
	}
	if p.Offset != "" {
		q.Set("offset", p.Offset)
	}

	endpoint := tesouroBaseURL + "/demais?" + q.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Accept", "application/json")

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

func sanitizeJSONBytes(b []byte) []byte {
	out := make([]byte, len(b))
	for i, c := range b {
		if c < 0x20 && c != '\t' && c != '\n' && c != '\r' {
			out[i] = ' '
			continue
		}
		out[i] = c
	}
	return out
}
