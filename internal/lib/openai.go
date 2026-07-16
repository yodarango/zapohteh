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

func getOpenAIChatURL() string {
	if url := os.Getenv("OPENAI_CHAT_URL"); url != "" {
		return url
	}
	return "https://api.openai.com/v1/chat/completions"
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
	return "gpt-4o-mini"
}

func getOpenAIModelSearch() string {
	if model := os.Getenv("OPENAI_MODEL_SEARCH"); model != "" {
		return model
	}
	return "gpt-4o-mini-search-preview"
}

func getOpenAIImageModel() string {
	if model := os.Getenv("OPENAI_IMAGE_MODEL"); model != "" {
		return model
	}
	return "dall-e-3"
}

type OpenAIService struct {
	APIKey string
	Model  string
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// webSearchOptions enables the model's web search tool. An empty object is enough
// to turn the feature on.
type webSearchOptions struct{}

type chatRequest struct {
	Model            string            `json:"model"`
	Messages         []chatMessage     `json:"messages"`
	WebSearchOptions *webSearchOptions `json:"web_search_options,omitempty"`
}

type chatResponse struct {
	Choices []struct {
		Message chatMessage `json:"message"`
	} `json:"choices"`
	Error *struct {
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
* Ask sends a system prompt and a user prompt to the OpenAI chat completions endpoint
* and returns the text content of the first choice. The system prompt is optional and
* is omitted when empty.
**************************************************************************************/
func (s *OpenAIService) Ask(systemPrompt, userPrompt string) (string, error) {
	return s.ask(s.Model, systemPrompt, userPrompt, false)
}

/**************************************************************************************
* AskWithWebSearch behaves like Ask but lets the model search the web before
* answering. It uses the web-search enabled model and turns the web_search_options on.
**************************************************************************************/
func (s *OpenAIService) AskWithWebSearch(systemPrompt, userPrompt string) (string, error) {
	return s.ask(getOpenAIModelSearch(), systemPrompt, userPrompt, true)
}

/**************************************************************************************
* ask is the shared implementation behind Ask and AskWithWebSearch. It builds the
* request for the given model, optionally enabling web search, and returns the text
* content of the first choice. The system prompt is optional and is omitted when empty.
**************************************************************************************/
func (s *OpenAIService) ask(model, systemPrompt, userPrompt string, webSearch bool) (string, error) {
	if s.APIKey == "" {
		return "", fmt.Errorf("OpenAI API key is not configured")
	}

	messages := make([]chatMessage, 0, 2)
	if systemPrompt != "" {
		messages = append(messages, chatMessage{Role: "system", Content: systemPrompt})
	}
	messages = append(messages, chatMessage{Role: "user", Content: userPrompt})

	fmt.Println(messages)
	reqBody := chatRequest{
		Model:    model,
		Messages: messages,
	}
	if webSearch {
		reqBody.WebSearchOptions = &webSearchOptions{}
	}

	payload, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal OpenAI request: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, getOpenAIChatURL(), bytes.NewBuffer(payload))
	if err != nil {
		return "", fmt.Errorf("failed to create OpenAI request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.APIKey)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to send OpenAI request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read OpenAI response: %w", err)
	}

	var chatResp chatResponse
	err = json.Unmarshal(body, &chatResp)
	if err != nil {
		return "", fmt.Errorf("failed to unmarshal OpenAI response: %w", err)
	}

	if chatResp.Error != nil {
		return "", fmt.Errorf("OpenAI error: %s", chatResp.Error.Message)
	}

	if len(chatResp.Choices) == 0 {
		return "", fmt.Errorf("OpenAI returned no choices")
	}

	return chatResp.Choices[0].Message.Content, nil
}

type imageRequest struct {
	Model       string `json:"model"`
	Prompt      string `json:"prompt"`
	Size        string `json:"size"`
	N           int    `json:"n"`
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

type visionContentPart struct {
	Type     string `json:"type"`
	Text     string `json:"text,omitempty"`
	ImageURL *struct {
		URL string `json:"url"`
	} `json:"image_url,omitempty"`
}

type visionMessage struct {
	Role    string              `json:"role"`
	Content []visionContentPart `json:"content"`
}

type visionRequest struct {
	Model    string          `json:"model"`
	Messages []visionMessage `json:"messages"`
}

/**************************************************************************************
* OCRImage sends an image to a vision-enabled OpenAI model and asks it to extract all
* readable text. The returned string is the extracted text without commentary.
**************************************************************************************/
func (s *OpenAIService) OCRImage(imageData []byte, mimeType string) (string, error) {
	if s.APIKey == "" {
		return "", fmt.Errorf("OpenAI API key is not configured")
	}

	base64Image := base64.StdEncoding.EncodeToString(imageData)
	dataURL := fmt.Sprintf("data:%s;base64,%s", mimeType, base64Image)

	reqBody := visionRequest{
		Model: getOpenAIModel(),
		Messages: []visionMessage{
			{
				Role: "system",
				Content: []visionContentPart{
					{Type: "text", Text: "Extract all readable text from the image. Return only the extracted text, with no commentary."},
				},
			},
			{
				Role: "user",
				Content: []visionContentPart{
					{Type: "text", Text: "Extract all text from this image."},
					{Type: "image_url", ImageURL: &struct{ URL string `json:"url"` }{URL: dataURL}},
				},
			},
		},
	}

	payload, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal OCR request: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, getOpenAIChatURL(), bytes.NewBuffer(payload))
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

	var chatResp chatResponse
	if err := json.Unmarshal(body, &chatResp); err != nil {
		return "", fmt.Errorf("failed to unmarshal OCR response: %w", err)
	}

	if chatResp.Error != nil {
		return "", fmt.Errorf("OpenAI OCR error: %s", chatResp.Error.Message)
	}

	if len(chatResp.Choices) == 0 {
		return "", fmt.Errorf("OpenAI OCR returned no choices")
	}

	return strings.TrimSpace(chatResp.Choices[0].Message.Content), nil
}

