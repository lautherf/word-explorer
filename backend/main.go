package main

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

var (
	llmAPIKey   string
	llmModel    string
	llmBaseURL  string
	httpClient  = &http.Client{Timeout: 45 * time.Second}
)

type ExploreRequest struct {
	Words []string `json:"words"`
	Lang  string   `json:"lang"`
}

type ExploreResponse struct {
	Words []string `json:"words"`
}

type GenerateRequest struct {
	Words        []string            `json:"words"`
	Lang         string              `json:"lang"`
	Existing     string              `json:"existing"`
	Namespaces   map[string][]string `json:"namespaces"`
	Background   string              `json:"background"`
	TargetLength int                 `json:"target_length"`
}

type GenerateResponse struct {
	Article string `json:"article"`
}

type PolishRequest struct {
	Article string `json:"article"`
	Prompt  string `json:"prompt"`
	Lang    string `json:"lang"`
}

type ExplainRequest struct {
	Word    string   `json:"word"`
	Context []string `json:"context"`
	Lang    string   `json:"lang"`
}

type ExplainResponse struct {
	Explanation string `json:"explanation"`
}

func callLLM(systemPrompt, userPrompt string) (string, error) {
	body := map[string]interface{}{
		"model": llmModel,
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": userPrompt},
		},
		"temperature": 0.2,
	}
	b, _ := json.Marshal(body)

	req, _ := http.NewRequest("POST", llmBaseURL+"/chat/completions", bytes.NewReader(b))
	req.Header.Set("Authorization", "Bearer "+llmAPIKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("HTTP-Referer", "http://localhost:8080")

	resp, err := httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("http call: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", fmt.Errorf("unmarshal: %w", err)
	}
	if len(result.Choices) == 0 {
		return "", fmt.Errorf("no choices in response")
	}
	return result.Choices[0].Message.Content, nil
}

func parseWordsFromLLM(content string) []string {
	content = strings.TrimSpace(content)

	if strings.HasPrefix(content, "```") {
		lines := strings.Split(content, "\n")
		var cleaned []string
		for _, line := range lines {
			if strings.HasPrefix(line, "```") {
				continue
			}
			cleaned = append(cleaned, line)
		}
		content = strings.Join(cleaned, "\n")
	}
	content = strings.TrimSpace(content)

	var words []string
	if err := json.Unmarshal([]byte(content), &words); err == nil {
		return words
	}

	var obj map[string]interface{}
	if err := json.Unmarshal([]byte(content), &obj); err == nil {
		if w, ok := obj["words"].([]interface{}); ok {
			for _, v := range w {
				if s, ok := v.(string); ok {
					words = append(words, s)
				}
			}
			return words
		}
	}

	lines := strings.Split(content, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "//") || strings.HasPrefix(line, "#") {
			continue
		}
		line = strings.TrimPrefix(line, "- ")
		line = strings.TrimPrefix(line, "* ")
		parts := strings.SplitN(line, ". ", 2)
		if len(parts) == 2 {
			var n int
			if _, err := fmt.Sscanf(parts[0], "%d", &n); err == nil {
				line = parts[1]
			}
		}
		word := strings.Trim(line, "\"'「」『』【】（）()[],. ")
		if word != "" {
			words = append(words, word)
		}
	}
	return words
}

func handleExplore(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var req ExploreRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}
	if len(req.Words) == 0 {
		http.Error(w, `{"error":"words required"}`, http.StatusBadRequest)
		return
	}

	langName := map[string]string{"zh": "Chinese", "en": "English"}[req.Lang]
	if langName == "" {
		langName = "English"
	}
	langInstr := fmt.Sprintf(" Respond in %s.", langName)
	wordList := strings.Join(req.Words, ", ")
	prompt := "Given these seed words: [" + wordList + "], generate 20 closely related words or concepts. Return ONLY a JSON array of strings, no other text." + langInstr
	system := "You are a semantic association engine. Always respond with valid JSON only, no other text."

	content, err := callLLM(system, prompt)
	if err != nil {
		log.Printf("LLM call failed: %v", err)
		http.Error(w, `{"error":"LLM call failed"}`, http.StatusInternalServerError)
		return
	}

	words := parseWordsFromLLM(content)
	if len(words) == 0 {
		words = []string{"no", "results", "returned"}
	}
	if len(words) > 20 {
		words = words[:20]
	}

	json.NewEncoder(w).Encode(ExploreResponse{Words: words})
}

func handleExtract(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var req struct {
		Text string `json:"text"`
		Lang string `json:"lang"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}
	if req.Text == "" {
		http.Error(w, `{"error":"text required"}`, http.StatusBadRequest)
		return
	}

	langName := map[string]string{"zh": "Chinese", "en": "English"}[req.Lang]
	if langName == "" {
		langName = "English"
	}
	langInstr := fmt.Sprintf(" Respond in %s.", langName)
	system := "You are a keyword extraction engine. Extract all important keywords and concepts from the given text. Return ONLY a JSON array of strings, no other text."
	userPrompt := fmt.Sprintf("Extract all meaningful keywords and concepts from this text:\n\n%s%s", req.Text, langInstr)

	content, err := callLLM(system, userPrompt)
	if err != nil {
		log.Printf("LLM extract failed: %v", err)
		http.Error(w, `{"error":"extract failed"}`, http.StatusInternalServerError)
		return
	}

	words := parseWordsFromLLM(content)
	if len(words) == 0 {
		words = []string{"no", "keywords", "found"}
	}

	json.NewEncoder(w).Encode(ExploreResponse{Words: words})
}

func handleGenerate(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var req GenerateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}
	if len(req.Words) == 0 {
		http.Error(w, `{"error":"words required"}`, http.StatusBadRequest)
		return
	}

	langName := map[string]string{"zh": "Chinese", "en": "English"}[req.Lang]
	if langName == "" {
		langName = "English"
	}
	langInstr := fmt.Sprintf(" Write the article in %s.", langName)
	guidance := " Use the following concepts as high-level thematic guidance — the article should be related to them in spirit and direction, but you don't need to force every single one into the text."
	wordList := strings.Join(req.Words, ", ")
	n := len(req.Words)
	targetWords := req.TargetLength
	if targetWords <= 0 {
		targetWords = 80 + n*30
	}
	system := "You are a skilled writer."
	lengthInstr := fmt.Sprintf(" Write about %d words.", targetWords)

	var nsBuilder strings.Builder
	for name, words := range req.Namespaces {
		if len(words) > 0 {
			fmt.Fprintf(&nsBuilder, "  %s: %s\n", name, strings.Join(words, ", "))
		}
	}
	nsStr := nsBuilder.String()

	var userPrompt string
	if req.Existing != "" {
		userPrompt = fmt.Sprintf("Continue writing the following article. Use these concepts as thematic direction: [%s]. Maintain the same style and language. Do not repeat what has already been written.\n\nExisting article:\n%s\n\nContinue from here:%s%s%s", wordList, req.Existing, langInstr, lengthInstr, guidance)
	} else {
		userPrompt = fmt.Sprintf("Write an article that is inspired by these concepts: [%s]. The article should have a title and paragraphs.%s%s%s", wordList, langInstr, lengthInstr, guidance)
	}

	if req.Background != "" {
		userPrompt = fmt.Sprintf("Background / Setting:\n%s\n\n%s", req.Background, userPrompt)
	}
	if nsStr != "" {
		userPrompt += "\n\nElement categories:\n" + nsStr
	}

	content, err := callLLM(system, userPrompt)
	if err != nil {
		log.Printf("LLM generate failed: %v", err)
		http.Error(w, `{"error":"generate failed"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(GenerateResponse{Article: content})
}

func handlePolish(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var req PolishRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}
	if req.Article == "" {
		http.Error(w, `{"error":"article required"}`, http.StatusBadRequest)
		return
	}

	langName := map[string]string{"zh": "Chinese", "en": "English"}[req.Lang]
	if langName == "" {
		langName = "English"
	}

	system := "You are a professional editor and writing consultant."
	prompt := req.Prompt
	if prompt == "" {
		prompt = "Polish and improve the writing quality."
	}
	userPrompt := fmt.Sprintf("Rewrite the following article according to these instructions: %s\n\nMaintain the original meaning and key information. Output only the polished article, no commentary.\n\nLanguage: %s\n\nArticle:\n%s", prompt, langName, req.Article)

	content, err := callLLM(system, userPrompt)
	if err != nil {
		log.Printf("LLM polish failed: %v", err)
		http.Error(w, `{"error":"polish failed"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(GenerateResponse{Article: content})
}

func handleExplain(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var req ExplainRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}
	if req.Word == "" {
		http.Error(w, `{"error":"word required"}`, http.StatusBadRequest)
		return
	}

	langName := map[string]string{"zh": "Chinese", "en": "English"}[req.Lang]
	if langName == "" {
		langName = "English"
	}

	system := "You are a semantic analysis assistant."
	contextStr := ""
	if len(req.Context) > 0 {
		contextStr = " in the context of these related concepts: [" + strings.Join(req.Context, ", ") + "]"
	}
	userPrompt := fmt.Sprintf("Explain the meaning and significance of the word \"%s\"%s. Keep the explanation concise (2-3 sentences). Respond in %s.", req.Word, contextStr, langName)

	content, err := callLLM(system, userPrompt)
	if err != nil {
		log.Printf("LLM explain failed: %v", err)
		http.Error(w, `{"error":"explain failed"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(ExplainResponse{Explanation: content})
}

func gzipMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
			next.ServeHTTP(w, r)
			return
		}
		w.Header().Set("Content-Encoding", "gzip")
		gz := gzip.NewWriter(w)
		defer gz.Close()
		gzw := &gzipResponseWriter{Writer: gz, ResponseWriter: w}
		next.ServeHTTP(gzw, r)
	})
}

type gzipResponseWriter struct {
	io.Writer
	http.ResponseWriter
}

func (g *gzipResponseWriter) Write(b []byte) (int, error) {
	return g.Writer.Write(b)
}

func main() {
	llmAPIKey = os.Getenv("LLM_API_KEY")
	if llmAPIKey == "" {
		llmAPIKey = os.Getenv("OPENROUTER_API_KEY")
	}
	if llmAPIKey == "" {
		llmAPIKey = os.Getenv("DEEPSEEK_API_KEY")
	}
	if llmAPIKey == "" {
		log.Fatal("LLM_API_KEY not set")
	}

	llmModel = os.Getenv("LLM_MODEL")
	if llmModel == "" {
		llmModel = "openrouter/free"
	}

	llmBaseURL = os.Getenv("LLM_BASE_URL")
	if llmBaseURL == "" {
		llmBaseURL = "https://openrouter.ai/api/v1"
	}

	log.Printf("LLM config: model=%s url=%s", llmModel, llmBaseURL)

	http.HandleFunc("/api/explore", handleExplore)
	http.HandleFunc("/api/generate", handleGenerate)
	http.HandleFunc("/api/extract", handleExtract)
	http.HandleFunc("/api/polish", handlePolish)
	http.HandleFunc("/api/explain", handleExplain)

	fs := http.FileServer(http.Dir("./static"))
	http.Handle("/", gzipMiddleware(fs))

	log.Println("Server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
