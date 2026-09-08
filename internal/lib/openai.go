package lib

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
	"unicode/utf8"
)

func getOpenAIResponsesURL() string {
	if url := os.Getenv("OPENAI_RESPONSES_URL"); url != "" {
		return url
	}
	return "https://api.openai.com/v1/responses"
}

func getOpenAIImageURL() string {
	if url := os.Getenv("OPENAI_IMAGE_URL"); url != "" {
		return url
	}
	return "https://api.openai.com/v1/images/generations"
}

func getOpenAIModel() string {
	if model := os.Getenv("OPENAI_MODEL"); model != "" {
		return model
	}
	return "gpt-5.6-luna"
}

func getOpenAIImageModel() string {
	if model := os.Getenv("OPENAI_IMAGE_MODEL"); model != "" {
		return model
	}
	return "gpt-image-1"
}

type OpenAIService struct {
	APIKey string
	Model  string
}

// responseInputMessage is a single message item in the Responses API `input`
// array. Content is a plain string; multimodal messages use content parts (see
// responseContentPart).
type responseInputMessage struct {
	Role    string `json:"role"`
	Content any    `json:"content"`
}

// responseContentPart is a text or image content part for a multimodal input
// message in the Responses API.
type responseContentPart struct {
	Type     string `json:"type"`
	Text     string `json:"text,omitempty"`
	ImageURL string `json:"image_url,omitempty"`
}

// responseTool enables a built-in tool such as web search. An empty object
// (e.g. {"type":"web_search"}) is enough to turn the feature on.
type responseTool struct {
	Type string `json:"type"`
}

type responseRequest struct {
	Model        string                 `json:"model"`
	Input        []responseInputMessage `json:"input"`
	Instructions string                 `json:"instructions,omitempty"`
	Tools        []responseTool         `json:"tools,omitempty"`
}

type responseOutputContent struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type responseOutputItem struct {
	Type    string                  `json:"type"`
	Content []responseOutputContent `json:"content"`
}

type responseResult struct {
	Output []responseOutputItem `json:"output"`
	Error  *struct {
		Message string `json:"message"`
	} `json:"error"`
}

/**************************************************************************************
* Creates a new OpenAI service using the API key from the environment variables.
**************************************************************************************/
func NewOpenAIService() *OpenAIService {
	return &OpenAIService{
		APIKey: os.Getenv("OPEN_AI"),
		Model:  getOpenAIModel(),
	}
}

/**************************************************************************************
* Ask sends a system prompt and a user prompt to the OpenAI Responses API
* (v1/responses) and returns the model's text output. The system prompt is optional
* and is omitted when empty.
**************************************************************************************/
func (s *OpenAIService) Ask(systemPrompt, userPrompt string) (string, error) {
	return s.ask(s.Model, systemPrompt, userPrompt, false)
}

/**************************************************************************************
* AskWithWebSearch behaves like Ask but lets the model search the web before
* answering. It uses the same model but adds the built-in web_search tool.
**************************************************************************************/
func (s *OpenAIService) AskWithWebSearch(systemPrompt, userPrompt string) (string, error) {
	return s.ask(s.Model, systemPrompt, userPrompt, true)
}

/**************************************************************************************
* ask is the shared implementation behind Ask and AskWithWebSearch. It builds the
* Responses API request, optionally enabling web search, and returns the model's text
* output. The system prompt is optional and is passed as `instructions` when non-empty.
**************************************************************************************/
func (s *OpenAIService) ask(model, systemPrompt, userPrompt string, webSearch bool) (string, error) {
	if s.APIKey == "" {
		return "", fmt.Errorf("OpenAI API key is not configured")
	}

	reqBody := responseRequest{
		Model:        model,
		Input:        []responseInputMessage{{Role: "user", Content: userPrompt}},
		Instructions: systemPrompt,
	}
	if webSearch {
		reqBody.Tools = []responseTool{{Type: "web_search"}}
	}

	payload, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal OpenAI request: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, getOpenAIResponsesURL(), bytes.NewBuffer(payload))
	if err != nil {
		return "", fmt.Errorf("failed to create OpenAI request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.APIKey)

	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to send OpenAI request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read OpenAI response: %w", err)
	}

	text, err := extractResponseText(body)
	if err != nil {
		return "", err
	}
	if text == "" {
		return "", fmt.Errorf("OpenAI returned no text output")
	}
	return text, nil
}

/**************************************************************************************
* extractResponseText parses a Responses API payload and returns the concatenated
* text from every output_text content item. It surfaces API-level errors when present.
**************************************************************************************/
func extractResponseText(body []byte) (string, error) {
	var res responseResult
	if err := json.Unmarshal(body, &res); err != nil {
		return "", fmt.Errorf("failed to unmarshal OpenAI response: %w", err)
	}
	if res.Error != nil {
		return "", fmt.Errorf("OpenAI error: %s", res.Error.Message)
	}
	var b strings.Builder
	for _, item := range res.Output {
		if item.Type != "message" {
			continue
		}
		for _, content := range item.Content {
			if content.Type == "output_text" {
				b.WriteString(content.Text)
			}
		}
	}
	return strings.TrimSpace(b.String()), nil
}

type imageRequest struct {
	Model        string `json:"model"`
	Prompt       string `json:"prompt"`
	Size         string `json:"size"`
	N            int    `json:"n"`
	OutputFormat string `json:"output_format"`
}

type imageResponse struct {
	Data []struct {
		B64JSON string `json:"b64_json"`
		URL     string `json:"url"`
	} `json:"data"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

/**************************************************************************************
* GenerateImage asks the OpenAI image model to create an image from the given system
* and user prompts (concatenated into a single prompt) and returns the raw decoded
* image bytes (PNG). Transient network errors are retried with exponential backoff.
**************************************************************************************/
func (s *OpenAIService) GenerateImage(systemPrompt, userPrompt string) ([]byte, error) {
	if s.APIKey == "" {
		return nil, fmt.Errorf("OpenAI API key is not configured")
	}

	prompt := userPrompt
	if systemPrompt != "" {
		prompt = systemPrompt + "\n\n" + userPrompt
	}

	reqBody := imageRequest{
		Model:        getOpenAIImageModel(),
		Prompt:       prompt,
		Size:         "1024x1024",
		N:            1,
		OutputFormat: "png",
	}

	payload, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal OpenAI image request: %w", err)
	}

	client := &http.Client{
		Timeout: 120 * time.Second,
	}

	maxRetries := 3
	var lastErr error
	for attempt := 0; attempt < maxRetries; attempt++ {
		if attempt > 0 {
			backoff := time.Duration(1<<attempt) * time.Second
			time.Sleep(backoff)
		}

		req, err := http.NewRequest(http.MethodPost, getOpenAIImageURL(), bytes.NewBuffer(payload))
		if err != nil {
			return nil, fmt.Errorf("failed to create OpenAI image request: %w", err)
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+s.APIKey)

		resp, err := client.Do(req)
		if err != nil {
			lastErr = fmt.Errorf("failed to send OpenAI image request: %w", err)
			if isTransientError(err) {
				continue
			}
			return nil, lastErr
		}
		defer resp.Body.Close()

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			lastErr = fmt.Errorf("failed to read OpenAI image response: %w", err)
			if isTransientError(err) {
				continue
			}
			return nil, lastErr
		}

		var imgResp imageResponse
		err = json.Unmarshal(body, &imgResp)
		if err != nil {
			return nil, fmt.Errorf("failed to unmarshal OpenAI image response: %w", err)
		}

		if imgResp.Error != nil {
			return nil, fmt.Errorf("OpenAI image error: %s", imgResp.Error.Message)
		}

		if len(imgResp.Data) == 0 {
			return nil, fmt.Errorf("OpenAI returned no image data")
		}

		// The unified image API may return either a base64 payload or a temporary URL.
		if imgResp.Data[0].B64JSON != "" {
			decoded, err := base64.StdEncoding.DecodeString(imgResp.Data[0].B64JSON)
			if err != nil {
				return nil, fmt.Errorf("failed to decode OpenAI image data: %w", err)
			}
			return decoded, nil
		}

		if imgResp.Data[0].URL != "" {
			imageResp, err := client.Get(imgResp.Data[0].URL)
			if err != nil {
				lastErr = fmt.Errorf("failed to download OpenAI image: %w", err)
				if isTransientError(err) {
					continue
				}
				return nil, lastErr
			}
			defer imageResp.Body.Close()
			imageBytes, err := io.ReadAll(imageResp.Body)
			if err != nil {
				lastErr = fmt.Errorf("failed to read downloaded OpenAI image: %w", err)
				if isTransientError(err) {
					continue
				}
				return nil, lastErr
			}
			return imageBytes, nil
		}

		return nil, fmt.Errorf("OpenAI returned no image data")
	}

	if lastErr == nil {
		lastErr = fmt.Errorf("OpenAI image request failed after %d attempts", maxRetries)
	}
	return nil, lastErr
}

/**************************************************************************************
* isTransientError reports whether an error is likely temporary and worth retrying.
**************************************************************************************/
func isTransientError(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	transientPhrases := []string{
		"unexpected EOF",
		"connection reset",
		"broken pipe",
		"timeout",
		"temporary",
		"EOF",
	}
	for _, phrase := range transientPhrases {
		if strings.Contains(msg, phrase) {
			return true
		}
	}
	return false
}

const openAITTSURL = "https://api.openai.com/v1/audio/speech"
const openAITTSModel = "tts-1"

/**************************************************************************************
* TTS sends text to the OpenAI text-to-speech endpoint and returns the generated MP3
* audio bytes. Input must be 4096 characters or fewer.
**************************************************************************************/
func (s *OpenAIService) TTS(text, voice string) ([]byte, error) {
	if s.APIKey == "" {
		return nil, fmt.Errorf("OpenAI API key is not configured")
	}

	if len(text) == 0 {
		return nil, fmt.Errorf("TTS input is empty")
	}

	if utf8.RuneCountInString(text) > 4096 {
		return nil, fmt.Errorf("TTS input exceeds 4096 characters")
	}

	reqBody := map[string]interface{}{
		"model":           openAITTSModel,
		"input":           text,
		"voice":           voice,
		"response_format": "mp3",
	}

	payload, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal TTS request: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, openAITTSURL, bytes.NewBuffer(payload))
	if err != nil {
		return nil, fmt.Errorf("failed to create TTS request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.APIKey)

	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send TTS request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read TTS response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		var errResp struct {
			Error *struct {
				Message string `json:"message"`
			} `json:"error"`
		}
		if json.Unmarshal(body, &errResp) == nil && errResp.Error != nil {
			return nil, fmt.Errorf("OpenAI TTS error: %s", errResp.Error.Message)
		}
		return nil, fmt.Errorf("OpenAI TTS returned status %d", resp.StatusCode)
	}

	return body, nil
}

/**************************************************************************************
* OCRImage sends an image to a vision-enabled OpenAI model via the Responses API and
* asks it to extract all readable text. The returned string is the extracted text
* without commentary.
**************************************************************************************/
func (s *OpenAIService) OCRImage(imageData []byte, mimeType string) (string, error) {
	if s.APIKey == "" {
		return "", fmt.Errorf("OpenAI API key is not configured")
	}

	base64Image := base64.StdEncoding.EncodeToString(imageData)
	dataURL := fmt.Sprintf("data:%s;base64,%s", mimeType, base64Image)

	reqBody := responseRequest{
		Model: getOpenAIModel(),
		Input: []responseInputMessage{
			{
				Role: "user",
				Content: []responseContentPart{
					{Type: "input_text", Text: "Extract all readable text from this image. Return only the extracted text, with no commentary."},
					{Type: "input_image", ImageURL: dataURL},
				},
			},
		},
	}

	payload, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal OCR request: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, getOpenAIResponsesURL(), bytes.NewBuffer(payload))
	if err != nil {
		return "", fmt.Errorf("failed to create OCR request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.APIKey)

	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to send OCR request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read OCR response: %w", err)
	}

	text, err := extractResponseText(body)
	if err != nil {
		return "", fmt.Errorf("OCR failed: %w", err)
	}
	if text == "" {
		return "", fmt.Errorf("OpenAI OCR returned no text output")
	}
	return text, nil
}
