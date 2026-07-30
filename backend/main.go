package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

func main() {
	loadDotEnv(".env")

	apiKey := os.Getenv("TRANSPARENCIA_API_KEY")
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	client := &http.Client{Timeout: 30 * time.Second}
	transparencia := NewTransparenciaClient(client, apiKey)
	tesouro := NewTesouroClient(client)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("GET /api/v1/despesas/por-orgao", handleDespesasPorOrgao(transparencia))
	mux.HandleFunc("GET /api/v1/despesas/documentos", handleDespesasDocumentos(transparencia))
	mux.HandleFunc("GET /api/v1/custos", handleCustos(tesouro))
	mux.HandleFunc("GET /api/v1/gastos", handleGastos(transparencia, tesouro))

	addr := ":" + port
	log.Printf("backend listening on %s", addr)
	if err := http.ListenAndServe(addr, withCORS(mux)); err != nil {
		log.Fatal(err)
	}
}

func handleDespesasPorOrgao(c *TransparenciaClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ano := r.URL.Query().Get("ano")
		if ano == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "ano is required (YYYY)"})
			return
		}
		pagina := r.URL.Query().Get("pagina")
		if pagina == "" {
			pagina = "1"
		}

		data, status, err := c.DespesasPorOrgao(r.Context(), DespesasPorOrgaoParams{
			Ano:           ano,
			OrgaoSuperior: r.URL.Query().Get("orgaoSuperior"),
			Orgao:         r.URL.Query().Get("orgao"),
			Pagina:        pagina,
		})
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
			return
		}
		writeRawJSON(w, status, data)
	}
}

func handleDespesasDocumentos(c *TransparenciaClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		dataEmissao := r.URL.Query().Get("dataEmissao")
		fase := r.URL.Query().Get("fase")
		if dataEmissao == "" || fase == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{
				"error": "dataEmissao (DD/MM/YYYY) and fase (1=empenho,2=liquidacao,3=pagamento) are required",
			})
			return
		}
		pagina := r.URL.Query().Get("pagina")
		if pagina == "" {
			pagina = "1"
		}

		data, status, err := c.DespesasDocumentos(r.Context(), DespesasDocumentosParams{
			DataEmissao:    dataEmissao,
			Fase:           fase,
			UnidadeGestora: r.URL.Query().Get("unidadeGestora"),
			Pagina:         pagina,
		})
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
			return
		}
		writeRawJSON(w, status, data)
	}
}

func handleCustos(c *TesouroClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ano := r.URL.Query().Get("ano")
		if ano == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "ano is required (YYYY)"})
			return
		}
		limit := r.URL.Query().Get("limit")
		if limit == "" {
			limit = "50"
		}
		offset := r.URL.Query().Get("offset")
		if offset == "" {
			offset = "0"
		}

		data, status, err := c.DemaisCustos(r.Context(), CustosParams{
			Ano:    ano,
			Mes:    r.URL.Query().Get("mes"),
			Limit:  limit,
			Offset: offset,
		})
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
			return
		}
		writeRawJSON(w, status, data)
	}
}

func handleGastos(transparencia *TransparenciaClient, tesouro *TesouroClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ano := r.URL.Query().Get("ano")
		if ano == "" {
			ano = "2024"
		}
		mes := r.URL.Query().Get("mes")
		if mes == "" {
			mes = "1"
		}

		type sourceResult struct {
			Source string          `json:"source"`
			OK     bool            `json:"ok"`
			Error  string          `json:"error,omitempty"`
			Data   json.RawMessage `json:"data,omitempty"`
		}

		resp := map[string]any{
			"ano":     ano,
			"mes":     mes,
			"sources": []sourceResult{},
		}
		sources := make([]sourceResult, 0, 2)

		orgaoSuperior := r.URL.Query().Get("orgaoSuperior")
		if orgaoSuperior == "" {
			orgaoSuperior = "26000"
		}

		desp, status, err := transparencia.DespesasPorOrgao(r.Context(), DespesasPorOrgaoParams{
			Ano:           ano,
			OrgaoSuperior: orgaoSuperior,
			Pagina:        "1",
		})
		if err != nil {
			sources = append(sources, sourceResult{
				Source: "portal_transparencia",
				OK:     false,
				Error:  err.Error(),
			})
		} else if status >= 400 {
			sources = append(sources, sourceResult{
				Source: "portal_transparencia",
				OK:     false,
				Error:  string(desp),
			})
		} else {
			sources = append(sources, sourceResult{
				Source: "portal_transparencia",
				OK:     true,
				Data:   json.RawMessage(desp),
			})
		}

		custos, status, err := tesouro.DemaisCustos(r.Context(), CustosParams{
			Ano:    ano,
			Mes:    mes,
			Limit:  "20",
			Offset: "0",
		})
		if err != nil {
			sources = append(sources, sourceResult{
				Source: "tesouro_custos",
				OK:     false,
				Error:  err.Error(),
			})
		} else if status >= 400 {
			sources = append(sources, sourceResult{
				Source: "tesouro_custos",
				OK:     false,
				Error:  string(custos),
			})
		} else {
			sources = append(sources, sourceResult{
				Source: "tesouro_custos",
				OK:     true,
				Data:   json.RawMessage(custos),
			})
		}

		resp["sources"] = sources
		writeJSON(w, http.StatusOK, resp)
	}
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeRawJSON(w http.ResponseWriter, status int, data []byte) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_, _ = w.Write(data)
}

func loadDotEnv(path string) {
	data, err := os.ReadFile(path)
	if err != nil {
		return
	}
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		value = strings.TrimSpace(value)
		value = strings.Trim(value, `"'`)
		if os.Getenv(key) == "" {
			_ = os.Setenv(key, value)
		}
	}
}
