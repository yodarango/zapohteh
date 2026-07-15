package models

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"unicode/utf8"

	"github.com/ledongthuc/pdf"
	"zapohteh/internal/lib"
	"zapohteh/internal/utils"
)

const (
	apiRequestsDir  = "src/content/api_requests"
	maxTTSInputLen  = 4096
	pendingDirName  = "pending"
	workingDirName  = "working"
	doneDirName     = "done"
)

var (
	supportedVoices = []string{
		"alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx",
		"sage", "shimmer", "verse",
	}

	supportedLanguages = []string{
		"spanish", "french", "german", "italian", "portuguese", "russian",
		"japanese", "korean", "chinese", "arabic", "hindi", "dutch",
		"swedish", "norwegian", "danish", "polish", "turkish", "greek",
		"hebrew", "thai",
	}
)

// AudiobookFile holds a single uploaded file together with its detected MIME type.
type AudiobookFile struct {
	Name     string
	Data     []byte
	MIMEType string
}

// StepProgress tracks how many items the current pipeline step has processed.
type StepProgress struct {
	TotalItems  int `json:"totalItems"`
	CurrentItem int `json:"currentItem"`
}

// AudiobookRequest represents a single audiobook transformation job.
type AudiobookRequest struct {
	RequestID  string
	BookTitle  string
	Voice      string
	Language   string
	Text       string
	Files      []AudiobookFile
	OnProgress func(step, totalSteps, progress int, message string, current *StepProgress)

	requestDir  string
	pendingDir  string
	workingDir  string
	doneDir     string
	folderName  string
	totalSteps  int
	currentStep int
}

// TransformResult is the payload sent in the final SSE complete event.
type TransformResult struct {
	Success     bool   `json:"success"`
	RequestID   string `json:"requestId"`
	BookTitle   string `json:"bookTitle"`
	Voice       string `json:"voice"`
	Language    string `json:"language"`
	OutputFile  string `json:"outputFile"`
	OutputPath  string `json:"outputPath"`
	FileSize    int64  `json:"fileSize"`
	DownloadURL string `json:"downloadUrl"`
}

// NewAudiobookRequestFromHTTP parses and validates the multipart transform request.
func NewAudiobookRequestFromHTTP(r *http.Request) (*AudiobookRequest, error) {
	if err := r.ParseMultipartForm(50 << 20); err != nil {
		return nil, fmt.Errorf("failed to parse multipart form: %w", err)
	}

	bookTitle := strings.TrimSpace(r.FormValue("bookTitle"))
	voice := strings.TrimSpace(r.FormValue("voice"))
	language := strings.ToLower(strings.TrimSpace(r.FormValue("language")))
	text := strings.TrimSpace(r.FormValue("text"))

	if bookTitle == "" {
		return nil, fmt.Errorf("bookTitle is required")
	}
	if voice == "" {
		return nil, fmt.Errorf("voice is required")
	}
	if !containsString(supportedVoices, voice) {
		return nil, fmt.Errorf("unsupported voice: %s", voice)
	}
	if language != "" && !containsString(supportedLanguages, language) {
		return nil, fmt.Errorf("unsupported language: %s", language)
	}

	var files []AudiobookFile
	if fh := r.MultipartForm.File["files"]; len(fh) > 0 {
		for _, header := range fh {
			file, err := header.Open()
			if err != nil {
				return nil, fmt.Errorf("failed to open uploaded file %s: %w", header.Filename, err)
			}
			data, err := io.ReadAll(file)
			file.Close()
			if err != nil {
				return nil, fmt.Errorf("failed to read uploaded file %s: %w", header.Filename, err)
			}
			files = append(files, AudiobookFile{
				Name:     header.Filename,
				Data:     data,
				MIMEType: header.Header.Get("Content-Type"),
			})
		}
	}

	if text == "" && len(files) == 0 {
		return nil, fmt.Errorf("either text or at least one file is required")
	}

	req := &AudiobookRequest{
		RequestID: generateRequestID(),
		BookTitle: bookTitle,
		Voice:     voice,
		Language:  language,
		Text:      text,
		Files:     files,
	}
	req.initDirs()
	return req, nil
}

// report sends a progress event to the caller.
func (r *AudiobookRequest) report(message string, current *StepProgress) {
	if r.OnProgress == nil {
		return
	}
	if current == nil {
		current = &StepProgress{}
	}
	progress := 0
	if r.totalSteps > 0 && r.currentStep > 0 {
		progress = (r.currentStep - 1) * 100 / r.totalSteps
		if progress > 100 {
			progress = 100
		}
	}
	r.OnProgress(r.currentStep, r.totalSteps, progress, message, current)
}

// advanceStep increments the current step counter and reports the new step.
func (r *AudiobookRequest) advanceStep(message string) {
	r.currentStep++
	r.report(fmt.Sprintf("Step %d: %s", r.currentStep, message), nil)
}

// totalStepCount returns the number of steps that will run for this request.
func (r *AudiobookRequest) totalStepCount() int {
	steps := 4
	if r.hasFiles() {
		steps += 2
	}
	if r.Language != "" {
		steps++
	}
	return steps
}

// Run executes the full audiobook pipeline and returns the final result.
func (r *AudiobookRequest) Run() (*TransformResult, error) {
	r.totalSteps = r.totalStepCount()

	if err := os.MkdirAll(r.workingDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create working directory: %w", err)
	}
	if err := os.MkdirAll(r.doneDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create done directory: %w", err)
	}
	if r.hasFiles() {
		if err := os.MkdirAll(r.pendingDir, 0755); err != nil {
			return nil, fmt.Errorf("failed to create pending directory: %w", err)
		}
	}

	defer r.cleanupOnSuccess()

	if r.hasFiles() {
		r.currentStep = 0
		r.advanceStep("🗂️ Saving uploaded files...")
		if err := r.saveFiles(); err != nil {
			return nil, err
		}

		r.advanceStep("🔍 Extracting text from files with OCR...")
		ocrText, err := r.ocrFiles()
		if err != nil {
			return nil, err
		}
		if r.Text != "" {
			r.Text = r.Text + "\n\n" + ocrText
		} else {
			r.Text = ocrText
		}
	} else {
		r.currentStep = 2
	}

	r.advanceStep("🧹 Cleaning text with OpenAI...")
	if err := r.cleanText(); err != nil {
		return nil, err
	}

	if r.Language != "" {
		r.advanceStep(fmt.Sprintf("🌐 Translating text to %s...", r.Language))
		if err := r.translateText(); err != nil {
			return nil, err
		}
	}

	r.advanceStep("✂️ Splitting text into TTS chunks...")
	chunks := r.splitTextForTTS()

	r.advanceStep("🎙️ Generating audio with OpenAI TTS...")
	if err := r.generateTTS(chunks); err != nil {
		return nil, err
	}

	r.advanceStep("🔧 Concatenating audio chunks into final MP3...")
	outputPath, err := r.concatenateMP3()
	if err != nil {
		return nil, err
	}

	info, err := os.Stat(outputPath)
	if err != nil {
		return nil, fmt.Errorf("failed to stat output file: %w", err)
	}

	return &TransformResult{
		Success:     true,
		RequestID:   r.RequestID,
		BookTitle:   r.BookTitle,
		Voice:       r.Voice,
		Language:    r.Language,
		OutputFile:  r.folderName + ".mp3",
		OutputPath:  outputPath,
		FileSize:    info.Size(),
		DownloadURL: fmt.Sprintf("/api/download/%s/%s", r.RequestID, r.folderName),
	}, nil
}

// cleanupOnSuccess removes the pending and working directories, leaving the done directory.
func (r *AudiobookRequest) cleanupOnSuccess() {
	if r.pendingDir != "" {
		_ = os.RemoveAll(r.pendingDir)
	}
	if r.workingDir != "" {
		_ = os.RemoveAll(r.workingDir)
	}
}

// Cleanup removes the entire request directory.
func (r *AudiobookRequest) Cleanup() {
	if r.requestDir != "" {
		_ = os.RemoveAll(r.requestDir)
	}
}

// generateRequestID creates a random hex identifier for the request.
func generateRequestID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return utils.GenerateRandomString(16)
	}
	return hex.EncodeToString(b)
}

// initDirs computes the request, pending, working and done directory paths.
func (r *AudiobookRequest) initDirs() {
	r.folderName = bookFolderName(r.BookTitle)
	if r.Language != "" {
		r.folderName = r.folderName + "_" + r.Language
	}
	r.requestDir = filepath.Join(apiRequestsDir, r.RequestID)
	r.pendingDir = filepath.Join(r.requestDir, pendingDirName)
	r.workingDir = filepath.Join(r.requestDir, workingDirName)
	r.doneDir = filepath.Join(r.requestDir, doneDirName, r.folderName)
}

// bookFolderName turns a book title into a safe folder name that preserves the
// original casing and replaces spaces with underscores, matching the docs format.
func bookFolderName(title string) string {
	name := utils.SanitizeFilename(title)
	name = strings.ReplaceAll(name, " ", "_")
	name = strings.ReplaceAll(name, "-", "_")
	return name
}

// hasFiles reports whether any files were uploaded.
func (r *AudiobookRequest) hasFiles() bool {
	return len(r.Files) > 0
}

// containsString reports whether s is present in list.
func containsString(list []string, s string) bool {
	for _, v := range list {
		if v == s {
			return true
		}
	}
	return false
}


// saveFiles writes the uploaded files to the pending directory.
func (r *AudiobookRequest) saveFiles() error {
	for i, file := range r.Files {
		path := filepath.Join(r.pendingDir, fmt.Sprintf("%d_%s", i, sanitizeFileName(file.Name)))
		if err := os.WriteFile(path, file.Data, 0644); err != nil {
			return fmt.Errorf("failed to save file %s: %w", file.Name, err)
		}
	}
	return nil
}

// ocrFiles extracts text from every uploaded file. Images are sent to OpenAI vision;
// PDFs are processed with a local PDF text extractor.
func (r *AudiobookRequest) ocrFiles() (string, error) {
	service := lib.NewOpenAIService()
	var parts []string

	for i, file := range r.Files {
		current := &StepProgress{TotalItems: len(r.Files), CurrentItem: i + 1}
		r.report(fmt.Sprintf("Processing file %d/%d: %s", i+1, len(r.Files), file.Name), current)

		var text string
		var err error
		if isPDF(file.Name, file.MIMEType) {
			text, err = r.extractPDFText(file.Data, i)
		} else if isImage(file.Name, file.MIMEType) {
			text, err = service.OCRImage(file.Data, detectImageMIME(file.Name, file.MIMEType))
		} else {
			text = string(file.Data)
		}
		if err != nil {
			return "", fmt.Errorf("OCR failed for %s: %w", file.Name, err)
		}
		parts = append(parts, text)
	}

	return strings.Join(parts, "\n\n"), nil
}

// extractPDFText saves the PDF data to disk and extracts its plain text.
func (r *AudiobookRequest) extractPDFText(data []byte, index int) (string, error) {
	path := filepath.Join(r.pendingDir, fmt.Sprintf("%d_input.pdf", index))
	if err := os.WriteFile(path, data, 0644); err != nil {
		return "", fmt.Errorf("failed to write PDF to disk: %w", err)
	}
	f, reader, err := pdf.Open(path)
	if err != nil {
		return "", fmt.Errorf("failed to open PDF: %w", err)
	}
	defer f.Close()

	b, err := reader.GetPlainText()
	if err != nil {
		return "", fmt.Errorf("failed to extract PDF text: %w", err)
	}
	var buf bytes.Buffer
	if _, err := buf.ReadFrom(b); err != nil {
		return "", fmt.Errorf("failed to read PDF text: %w", err)
	}
	return buf.String(), nil
}

// isPDF reports whether the file looks like a PDF.
func isPDF(name, mime string) bool {
	if mime == "application/pdf" {
		return true
	}
	return strings.HasSuffix(strings.ToLower(name), ".pdf")
}

// isImage reports whether the file looks like an image.
func isImage(name, mime string) bool {
	if strings.HasPrefix(mime, "image/") {
		return true
	}
	ext := strings.ToLower(filepath.Ext(name))
	return ext == ".jpg" || ext == ".jpeg" || ext == ".png" || ext == ".gif" || ext == ".webp" || ext == ".bmp"
}

// detectImageMIME returns a reliable image MIME type for the file.
func detectImageMIME(name, fallback string) string {
	ext := strings.ToLower(filepath.Ext(name))
	switch ext {
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	case ".gif":
		return "image/gif"
	case ".webp":
		return "image/webp"
	case ".bmp":
		return "image/bmp"
	}
	if fallback != "" && strings.HasPrefix(fallback, "image/") {
		return fallback
	}
	return "image/jpeg"
}

// sanitizeFileName strips path separators and other unsafe characters.
func sanitizeFileName(name string) string {
	name = filepath.Base(name)
	return strings.Map(func(r rune) rune {
		if r == '/' || r == '\\' || r == 0 {
			return '_'
		}
		return r
	}, name)
}


// cleanText uses OpenAI to sanitize and format the input text for speech.
func (r *AudiobookRequest) cleanText() error {
	if strings.TrimSpace(r.Text) == "" {
		return fmt.Errorf("no text available to clean")
	}

	system := `You are a text preprocessing assistant for text-to-speech.
Clean up the following text. Fix obvious OCR errors, remove page headers/footers, page numbers, and formatting artifacts.
Preserve the narrative flow and structure as clean paragraphs suitable for reading aloud.
Return only the cleaned text, with no commentary.`

	cleaned, err := lib.NewOpenAIService().Ask(system, r.Text)
	if err != nil {
		return fmt.Errorf("text cleaning failed: %w", err)
	}
	r.Text = strings.TrimSpace(cleaned)
	return nil
}

// translateText uses OpenAI to translate the cleaned text into the target language.
func (r *AudiobookRequest) translateText() error {
	if r.Text == "" {
		return fmt.Errorf("no text available to translate")
	}

	system := fmt.Sprintf("Translate the following text to %s. Keep the tone natural and suitable for spoken audio. Return only the translated text, with no commentary.", r.Language)
	translated, err := lib.NewOpenAIService().Ask(system, r.Text)
	if err != nil {
		return fmt.Errorf("translation failed: %w", err)
	}
	r.Text = strings.TrimSpace(translated)
	return nil
}

// splitTextForTTS breaks the text into chunks that fit within OpenAI's TTS input limit.
func (r *AudiobookRequest) splitTextForTTS() []string {
	if r.Text == "" {
		return nil
	}

	paragraphs := strings.Split(r.Text, "\n")
	var chunks []string
	var current strings.Builder

	flush := func() {
		if current.Len() > 0 {
			chunks = append(chunks, strings.TrimSpace(current.String()))
			current.Reset()
		}
	}

	for _, paragraph := range paragraphs {
		paragraph = strings.TrimSpace(paragraph)
		if paragraph == "" {
			continue
		}

		// If a single paragraph is too long, break it at sentence boundaries.
		if utf8.RuneCountInString(paragraph) > maxTTSInputLen {
			flush()
			chunks = append(chunks, splitLongParagraph(paragraph)...)
			continue
		}

		if current.Len() > 0 && utf8.RuneCountInString(current.String())+1+utf8.RuneCountInString(paragraph) > maxTTSInputLen {
			flush()
		}
		if current.Len() > 0 {
			current.WriteString("\n")
		}
		current.WriteString(paragraph)
	}
	flush()
	return chunks
}

// sentenceEndPattern matches sentence endings followed by a space and capital letter.
var sentenceEndPattern = regexp.MustCompile(`([.!?]+)\s+([A-Z])`)

// splitLongParagraph splits a long paragraph into TTS-sized chunks at sentence boundaries.
func splitLongParagraph(paragraph string) []string {
	var chunks []string
	var current strings.Builder

	flush := func() {
		if current.Len() > 0 {
			chunks = append(chunks, strings.TrimSpace(current.String()))
			current.Reset()
		}
	}

	sentences := sentenceEndPattern.ReplaceAllString(paragraph, "$1\n$2")
	for _, sentence := range strings.Split(sentences, "\n") {
		sentence = strings.TrimSpace(sentence)
		if sentence == "" {
			continue
		}

		if utf8.RuneCountInString(sentence) > maxTTSInputLen {
			flush()
			chunks = append(chunks, splitByRunes(sentence, maxTTSInputLen)...)
			continue
		}

		if current.Len() > 0 && utf8.RuneCountInString(current.String())+1+utf8.RuneCountInString(sentence) > maxTTSInputLen {
			flush()
		}
		if current.Len() > 0 {
			current.WriteString(" ")
		}
		current.WriteString(sentence)
	}
	flush()
	return chunks
}

// splitByRunes splits text into chunks of at most max runes.
func splitByRunes(text string, max int) []string {
	var chunks []string
	runes := []rune(text)
	for i := 0; i < len(runes); i += max {
		end := i + max
		if end > len(runes) {
			end = len(runes)
		}
		chunks = append(chunks, string(runes[i:end]))
	}
	return chunks
}

// generateTTS creates an MP3 for every text chunk using OpenAI TTS.
func (r *AudiobookRequest) generateTTS(chunks []string) error {
	if len(chunks) == 0 {
		return fmt.Errorf("no text chunks to convert to speech")
	}

	service := lib.NewOpenAIService()
	for i, chunk := range chunks {
		current := &StepProgress{TotalItems: len(chunks), CurrentItem: i + 1}
		r.report(fmt.Sprintf("Generating audio chunk %d/%d", i+1, len(chunks)), current)

		audio, err := service.TTS(chunk, r.Voice)
		if err != nil {
			return fmt.Errorf("TTS failed for chunk %d: %w", i+1, err)
		}

		path := filepath.Join(r.workingDir, fmt.Sprintf("chunk_%04d.mp3", i))
		if err := os.WriteFile(path, audio, 0644); err != nil {
			return fmt.Errorf("failed to write audio chunk %d: %w", i+1, err)
		}
	}
	return nil
}

// concatenateMP3 combines all generated MP3 chunks into the final audiobook file.
func (r *AudiobookRequest) concatenateMP3() (string, error) {
	entries, err := os.ReadDir(r.workingDir)
	if err != nil {
		return "", fmt.Errorf("failed to read working directory: %w", err)
	}

	var chunkPaths []string
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		if strings.HasSuffix(entry.Name(), ".mp3") {
			chunkPaths = append(chunkPaths, filepath.Join(r.workingDir, entry.Name()))
		}
	}
	sort.Strings(chunkPaths)

	if len(chunkPaths) == 0 {
		return "", fmt.Errorf("no audio chunks found to concatenate")
	}

	outputPath := filepath.Join(r.doneDir, r.folderName+".mp3")
	out, err := os.Create(outputPath)
	if err != nil {
		return "", fmt.Errorf("failed to create output MP3: %w", err)
	}
	defer out.Close()

	for _, path := range chunkPaths {
		data, err := os.ReadFile(path)
		if err != nil {
			return "", fmt.Errorf("failed to read chunk %s: %w", path, err)
		}
		if _, err := out.Write(data); err != nil {
			return "", fmt.Errorf("failed to write chunk %s: %w", path, err)
		}
	}

	return outputPath, nil
}
