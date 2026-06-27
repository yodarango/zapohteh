package lib

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
)

const openAIChatURL = "https://api.openai.com/v1/chat/completions"
const openAIModel = "gpt-4o-mini"
const openAIModelSearch = "gpt-4o-mini-search-preview"

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
		Model:  openAIModel,
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
	return s.ask(openAIModelSearch, systemPrompt, userPrompt, true)
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

	req, err := http.NewRequest(http.MethodPost, openAIChatURL, bytes.NewBuffer(payload))
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
