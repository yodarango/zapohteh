package models

import (
	"fmt"
	"os"
	"strings"

	"github.com/ledongthuc/pdf"
)

// maxPDFImportPages caps how many pages of an imported PDF are processed.
const maxPDFImportPages = 200

/**************************************************************************************
* ExtractPDFSource extracts the text of a PDF page by page, filling SourceContent.
* Embedded images are ignored: they cannot be placed reliably in the reading order,
* so only the text is imported. progress reports extraction phases ("start", "text",
* "done") so the handler can stream SSE updates.
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
	}

	content := strings.TrimSpace(b.String())
	if content == "" {
		return fmt.Errorf("no text could be extracted from the PDF (scanned documents are not supported)")
	}

	r.SourceContent = content
	report("done", fmt.Sprintf("%d pages", numPages))
	return nil
}
