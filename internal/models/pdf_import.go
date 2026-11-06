package models

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"sort"
	"strings"

	"github.com/ledongthuc/pdf"
	pdfcpuapi "github.com/pdfcpu/pdfcpu/pkg/api"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/model"
)

// maxPDFImportPages caps how many pages of an imported PDF are processed.
const maxPDFImportPages = 200

// minPDFImageBytes is the minimum size for an embedded image to be imported;
// smaller images are usually icons or rendering artifacts.
const minPDFImageBytes = 5 * 1024

/**************************************************************************************
* ExtractPDFSource extracts the text of a PDF page by page and imports its embedded
* images, filling SourceContent (the text of each page followed by the [IMAGE_N]
* tokens of that page's images) and SourceImages. progress reports extraction
* phases ("start", "images", "text", "done") so the handler can stream SSE updates.
**************************************************************************************/
func (r *Research) ExtractPDFSource(data []byte, progress func(phase, detail string)) error {
	report := func(phase, detail string) {
		if progress != nil {
			progress(phase, detail)
		}
	}

	report("start", fmt.Sprintf("%.1f MB", float64(len(data))/(1<<20)))

	// pdf.Open works on a file path, so the upload is staged in a temp file
	tmp, err := os.CreateTemp("", "zapohteh-import-*.pdf")
	if err != nil {
		return fmt.Errorf("failed to stage the PDF: %w", err)
	}
	tmpPath := tmp.Name()
	defer os.Remove(tmpPath)
	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		return fmt.Errorf("failed to stage the PDF: %w", err)
	}
	if err := tmp.Close(); err != nil {
		return fmt.Errorf("failed to stage the PDF: %w", err)
	}

	f, reader, err := pdf.Open(tmpPath)
	if err != nil {
		return fmt.Errorf("failed to open the PDF: %w", err)
	}
	defer f.Close()

	numPages := reader.NumPage()
	if numPages == 0 {
		return fmt.Errorf("the PDF has no pages")
	}
	if numPages > maxPDFImportPages {
		return fmt.Errorf("the PDF has %d pages, over the %d page limit", numPages, maxPDFImportPages)
	}

	// extract the embedded images first so their tokens are known when the text
	// of each page is emitted; images are best-effort and never fail the import
	report("images", "extracting embedded images")
	pageTokens, _ := r.extractPDFImages(data)

	var b strings.Builder
	for i := 1; i <= numPages; i++ {
		report("text", fmt.Sprintf("page %d of %d", i, numPages))
		page := reader.Page(i)
		if page.V.IsNull() {
			continue
		}
		text, err := page.GetPlainText(nil)
		if err == nil {
			if trimmed := strings.TrimSpace(text); trimmed != "" {
				b.WriteString(trimmed)
				b.WriteString("\n\n")
			}
		}
		for _, token := range pageTokens[i] {
			b.WriteString(token)
			b.WriteString("\n\n")
		}
	}

	content := strings.TrimSpace(b.String())
	if content == "" {
		return fmt.Errorf("no text could be extracted from the PDF (scanned documents are not supported)")
	}

	r.SourceContent = content
	report("done", fmt.Sprintf("%d pages, %d images", numPages, len(r.SourceImages)))
	return nil
}

/**************************************************************************************
* extractPDFImages pulls the embedded images out of a PDF with pdfcpu, saving each
* one large enough to be meaningful, and returns the image tokens grouped by
* 1-based page number. Extraction errors are returned, but any images already
* extracted are kept so the caller can treat images as best-effort.
**************************************************************************************/
func (r *Research) extractPDFImages(data []byte) (map[int][]string, error) {
	tokens := make(map[int][]string)

	digest := func(img model.Image, _ bool, _ int) error {
		if img.Thumb || img.Reader == nil || (img.Size > 0 && img.Size < minPDFImageBytes) {
			return nil
		}
		imageBytes, err := io.ReadAll(img)
		if err != nil || len(imageBytes) < minPDFImageBytes {
			return nil // skip unreadable images and tiny icons
		}
		ext := strings.ToLower(img.FileType)
		if ext == "jpeg" {
			ext = "jpg"
		}
		switch ext {
		case "jpg", "png", "gif", "webp":
		default:
			return nil // skip image types the frontend cannot render
		}
		saved, err := r.saveSourceImage(imageBytes, ext, fmt.Sprintf("Image from page %d", img.PageNr))
		if err != nil {
			return err
		}
		tokens[img.PageNr] = append(tokens[img.PageNr], saved.Token)
		return nil
	}

	err := pdfcpuapi.ExtractImages(context.Background(), bytes.NewReader(data), nil, digest, nil)

	// keep the tokens of each page in a stable order
	for page := range tokens {
		sort.Strings(tokens[page])
	}
	return tokens, err
}
