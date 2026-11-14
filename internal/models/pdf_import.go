package models

import (
	"context"
	"fmt"
	"math"
	"os"
	"os/exec"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/ledongthuc/pdf"
)

// maxPDFImportPages caps how many pages of an imported PDF are processed.
const maxPDFImportPages = 200

var (
	pdfPageHeading     = regexp.MustCompile(`(?i)^(?:page|p\.)\s*\d+\b`)
	pdfNumberedHeading = regexp.MustCompile(`(?i)^(?:(?:chapter|section|part|appendix)\s+[0-9ivxlcdm]+\b|\d+(?:\.\d+)*[.)]\s+\S|[IVXLCDM]+\.\s+[A-Z])`)
	pdfNamedHeading    = regexp.MustCompile(`(?i)^(?:abstract|introduction|conclusion|concluding reflections|discussion|references|bibliography|methodology|methods|results|summary|page.by.page summaries|the whole paper explained.*|significance for.*|research relevance.*|final analysis|key findings|notes)$`)
	pdfMarkdownHeading = regexp.MustCompile(`^#{1,6}\s+`)
	pdfDigits          = regexp.MustCompile(`\d+`)
)

type pdfImportLine struct {
	Text    string
	Size    float64
	Bold    bool
	Y       float64
	Gap     bool
	Heading int
}

type pdfImportPage struct {
	Lines []pdfImportLine
}

// ExtractPDFSource extracts text from a PDF and preserves inferred headings as Markdown.
// It tries styled PDF text, pdftotext, native text extraction, and optional OCR.
// The output always contains page-level Markdown headings if section detection fails.
func (r *Research) ExtractPDFSource(data []byte, progress func(phase, detail string)) error {
	report := func(phase, detail string) {
		if progress != nil {
			progress(phase, detail)
		}
	}
	report("start", fmt.Sprintf("%.1f MB", float64(len(data))/(1<<20)))

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

	outlineTitles := make(map[string]int)
	collectPDFOutline(reader.Outline(), 0, outlineTitles)
	pages := make([]pdfImportPage, numPages)
	var popplerPages []string
	popplerAttempted := false
	readablePages := 0

	for i := 1; i <= numPages; i++ {
		report("text", fmt.Sprintf("page %d of %d", i, numPages))
		p := reader.Page(i)
		if p.V.IsNull() {
			continue
		}

		lines := extractPDFStyledLines(p)
		if pdfTextLength(lines) < 80 {
			if !popplerAttempted {
				popplerAttempted = true
				if text, err := runPDFCommand(45*time.Second, "pdftotext", "-layout", "-enc", "UTF-8", tmpPath, "-"); err == nil {
					popplerPages = strings.Split(strings.ReplaceAll(text, "\r\n", "\n"), "\f")
				}
			}
			if i-1 < len(popplerPages) {
				alternative := plainPDFLines(popplerPages[i-1])
				if pdfTextLength(alternative) > pdfTextLength(lines) {
					lines = alternative
				}
			}
		}
		if pdfTextLength(lines) < 80 {
			if text, err := p.GetPlainText(nil); err == nil {
				alternative := plainPDFLines(text)
				if pdfTextLength(alternative) > pdfTextLength(lines) {
					lines = alternative
				}
			}
		}
		if pdfTextLength(lines) < 40 {
			report("ocr", fmt.Sprintf("page %d of %d", i, numPages))
			if text, err := ocrPDFPage(tmpPath, i); err == nil {
				alternative := plainPDFLines(text)
				if pdfTextLength(alternative) > pdfTextLength(lines) {
					lines = alternative
				}
			}
		}

		if pdfTextLength(lines) > 0 {
			readablePages++
		}
		pages[i-1] = pdfImportPage{Lines: lines}
	}
	if readablePages == 0 {
		return fmt.Errorf("no text could be extracted from the PDF (install pdftotext, pdftoppm, and tesseract for additional extraction and OCR support)")
	}

	suppressPDFRepeatedMargins(pages)
	bodySize := detectPDFBodySize(pages)
	headingCount := 0
	for i := range pages {
		for j := range pages[i].Lines {
			level := classifyPDFHeading(pages[i].Lines[j], bodySize, outlineTitles)
			pages[i].Lines[j].Heading = level
			if level > 0 {
				headingCount++
			}
		}
	}

	addPageHeadings := headingCount < 2 && numPages > 1
	var out strings.Builder
	for pageIndex, page := range pages {
		if len(page.Lines) == 0 {
			continue
		}
		if addPageHeadings {
			out.WriteString(fmt.Sprintf("## PDF page %d\n\n", pageIndex+1))
		}
		var paragraph strings.Builder
		flush := func() {
			if paragraph.Len() > 0 {
				out.WriteString(strings.TrimSpace(paragraph.String()))
				out.WriteString("\n\n")
				paragraph.Reset()
			}
		}
		var previous pdfImportLine
		for idx, line := range page.Lines {
			text := strings.TrimSpace(line.Text)
			if text == "" {
				continue
			}
			if level := line.Heading; level >= 1 && level <= 6 {
				flush()
				headingText := pdfMarkdownHeading.ReplaceAllString(text, "")
				// Do not create duplicate Markdown headings if the source already has one.
				out.WriteString(strings.Repeat("#", level) + " " + headingText + "\n\n")
				previous = pdfImportLine{}
				continue
			}
			if line.Gap || (idx > 0 && previous.Size > 0 && line.Y > 0 && previous.Y > 0 &&
				previous.Y-line.Y > math.Max(bodySize*1.75, 16)) {
				flush()
			}
			if paragraph.Len() > 0 {
				if strings.HasSuffix(paragraph.String(), "-") && beginsWithLowerPDF(text) {
					prior := paragraph.String()
					paragraph.Reset()
					paragraph.WriteString(strings.TrimSuffix(prior, "-"))
				} else {
					paragraph.WriteString(" ")
				}
			}
			paragraph.WriteString(text)
			previous = line
		}
		flush()
	}
	content := strings.TrimSpace(out.String())
	if content == "" {
		return fmt.Errorf("no readable text could be assembled from the PDF")
	}
	if !strings.HasPrefix(content, "#") {
		content = "# Imported PDF\n\n" + content
	}
	r.SourceContent = content
	report("done", fmt.Sprintf("%d pages, %d detected headings", numPages, headingCount))
	return nil
}

func collectPDFOutline(node pdf.Outline, depth int, titles map[string]int) {
	if title := strings.TrimSpace(node.Title); title != "" {
		level := depth
		if level < 1 {
			level = 1
		}
		if level > 6 {
			level = 6
		}
		titles[normalizePDFHeading(title)] = level
	}
	for _, child := range node.Child {
		collectPDFOutline(child, depth+1, titles)
	}
}

func extractPDFStyledLines(page pdf.Page) (result []pdfImportLine) {
	// Some malformed PDFs can panic during content parsing; allow the fallback chain.
	defer func() {
		if recover() != nil {
			result = nil
		}
	}()
	tokens := page.Content().Text
	filtered := make([]pdf.Text, 0, len(tokens))
	for _, token := range tokens {
		if strings.TrimSpace(token.S) != "" && token.FontSize > 0 {
			filtered = append(filtered, token)
		}
	}
	sort.SliceStable(filtered, func(i, j int) bool {
		return filtered[i].Y > filtered[j].Y
	})
	var rows [][]pdf.Text
	for _, token := range filtered {
		if len(rows) == 0 || math.Abs(rows[len(rows)-1][0].Y-token.Y) > 2.0 {
			rows = append(rows, []pdf.Text{token})
		} else {
			rows[len(rows)-1] = append(rows[len(rows)-1], token)
		}
	}
	if len(rows) == 0 {
		return nil
	}

	minX, maxX := math.Inf(1), math.Inf(-1)
	for _, token := range filtered {
		if token.X < minX {
			minX = token.X
		}
		right := token.X + token.W
		if right > maxX {
			maxX = right
		}
	}
	midpoint := (minX + maxX) / 2
	pairedRows := 0
	for _, row := range rows {
		left, right, center := 0, 0, 0
		for _, token := range row {
			if token.X+token.W < midpoint-8 {
				left++
			} else if token.X > midpoint+8 {
				right++
			} else {
				center++
			}
		}
		if left > 0 && right > 0 && center == 0 {
			pairedRows++
		}
	}
	twoColumns := pairedRows >= 6 && float64(pairedRows)/float64(len(rows)) > .22
	var all, left, right, spanning []pdfImportLine
	for _, row := range rows {
		if !twoColumns {
			all = append(all, combinePDFTokens(row))
			continue
		}
		var a, b, wide []pdf.Text
		for _, token := range row {
			if token.X+token.W < midpoint-8 {
				a = append(a, token)
			} else if token.X > midpoint+8 {
				b = append(b, token)
			} else {
				wide = append(wide, token)
			}
		}
		if len(wide) > 0 {
			spanning = append(spanning, combinePDFTokens(row))
		} else {
			if len(a) > 0 {
				left = append(left, combinePDFTokens(a))
			}
			if len(b) > 0 {
				right = append(right, combinePDFTokens(b))
			}
		}
	}
	if twoColumns {
		highest, lowest := math.Inf(-1), math.Inf(1)
		for _, l := range append(append([]pdfImportLine{}, left...), right...) {
			if l.Y > highest {
				highest = l.Y
			}
			if l.Y < lowest {
				lowest = l.Y
			}
		}
		var top, bottom []pdfImportLine
		for _, l := range spanning {
			if l.Y >= highest-5 {
				top = append(top, l)
			} else if l.Y < lowest+5 {
				bottom = append(bottom, l)
			} else {
				left = append(left, l)
			}
		}
		sort.SliceStable(left, func(i, j int) bool { return left[i].Y > left[j].Y })
		sort.SliceStable(right, func(i, j int) bool { return right[i].Y > right[j].Y })
		all = append(all, top...)
		all = append(all, left...)
		if len(right) > 0 {
			right[0].Gap = true
		}
		all = append(all, right...)
		all = append(all, bottom...)
	}
	return all
}

func combinePDFTokens(tokens []pdf.Text) pdfImportLine {
	sort.SliceStable(tokens, func(i, j int) bool { return tokens[i].X < tokens[j].X })
	var result strings.Builder
	boldChars, totalChars := 0, 0
	maxSize := 0.0
	for i, token := range tokens {
		if i > 0 {
			prev := tokens[i-1]
			width := prev.W
			if width <= 0 {
				width = float64(len([]rune(prev.S))) * prev.FontSize * .45
			}
			gap := token.X - (prev.X + width)
			if gap > math.Max(1.3, token.FontSize*.12) &&
				!strings.HasSuffix(result.String(), " ") && !strings.HasPrefix(token.S, " ") {
				result.WriteByte(' ')
			}
		}
		result.WriteString(token.S)
		chars := len([]rune(strings.TrimSpace(token.S)))
		totalChars += chars
		if isPDFBoldFont(token.Font) {
			boldChars += chars
		}
		if token.FontSize > maxSize {
			maxSize = token.FontSize
		}
	}
	return pdfImportLine{
		Text: strings.Join(strings.Fields(result.String()), " "),
		Size: maxSize, Bold: totalChars > 0 && boldChars*2 >= totalChars,
		Y: tokens[0].Y,
	}
}

func isPDFBoldFont(name string) bool {
	name = strings.ToLower(name)
	return strings.Contains(name, "bold") || strings.Contains(name, "black") ||
		strings.Contains(name, "heavy") || strings.Contains(name, "demi") ||
		strings.Contains(name, "semibold")
}

func plainPDFLines(text string) []pdfImportLine {
	text = strings.ReplaceAll(strings.ReplaceAll(text, "\r\n", "\n"), "\r", "\n")
	var result []pdfImportLine
	gap := false
	for _, raw := range strings.Split(text, "\n") {
		trimmed := strings.Join(strings.Fields(raw), " ")
		if trimmed == "" {
			gap = true
			continue
		}
		result = append(result, pdfImportLine{Text: trimmed, Gap: gap})
		gap = false
	}
	return result
}

func pdfTextLength(lines []pdfImportLine) int {
	total := 0
	for _, line := range lines {
		total += len([]rune(line.Text))
	}
	return total
}

func suppressPDFRepeatedMargins(pages []pdfImportPage) {
	if len(pages) < 3 {
		return
	}
	occurrence := make(map[string]int)
	for _, page := range pages {
		seen := make(map[string]bool)
		for i, line := range page.Lines {
			if i > 1 && i < len(page.Lines)-2 {
				continue
			}
			key := normalizePDFHeading(pdfDigits.ReplaceAllString(line.Text, "#"))
			if key != "" && !seen[key] {
				occurrence[key]++
				seen[key] = true
			}
		}
	}
	for p := range pages {
		var kept []pdfImportLine
		for i, line := range pages[p].Lines {
			key := normalizePDFHeading(pdfDigits.ReplaceAllString(line.Text, "#"))
			repeatedMargin := i <= 1 || i >= len(pages[p].Lines)-2
			if repeatedMargin && occurrence[key] >= 3 && !pdfPageHeading.MatchString(line.Text) &&
				!pdfNumberedHeading.MatchString(line.Text) {
				continue
			}
			kept = append(kept, line)
		}
		pages[p].Lines = kept
	}
}

func detectPDFBodySize(pages []pdfImportPage) float64 {
	histogram := make(map[int]int)
	for _, page := range pages {
		for _, line := range page.Lines {
			if line.Size <= 0 {
				continue
			}
			bucket := int(math.Round(line.Size * 2))
			weight := len([]rune(line.Text))
			if weight > 150 {
				weight = 150
			}
			histogram[bucket] += weight
		}
	}
	bestBucket, bestWeight := 22, 0
	for bucket, weight := range histogram {
		if weight > bestWeight {
			bestBucket, bestWeight = bucket, weight
		}
	}
	return float64(bestBucket) / 2
}

func normalizePDFHeading(text string) string {
	return strings.ToLower(strings.Join(strings.Fields(strings.TrimSpace(text)), " "))
}

func classifyPDFHeading(line pdfImportLine, bodySize float64, outline map[string]int) int {
	text := strings.TrimSpace(line.Text)
	if text == "" || len([]rune(text)) > 170 {
		return 0
	}
	if level, found := outline[normalizePDFHeading(text)]; found {
		return level
	}
	if pdfMarkdownHeading.MatchString(text) {
		count := 0
		for _, ch := range text {
			if ch != '#' {
				break
			}
			count++
		}
		if count > 6 {
			count = 6
		}
		return count
	}
	if pdfPageHeading.MatchString(text) || pdfNumberedHeading.MatchString(text) {
		return 2
	}
	if pdfNamedHeading.MatchString(text) {
		return 2
	}
	if len([]rune(text)) > 110 || len(strings.Fields(text)) > 19 {
		return 0
	}
	if looksLikePDFSentence(text) && !(line.Size >= bodySize+1.2 || (line.Bold && line.Size >= bodySize+0.5)) {
		return 0
	}
	if line.Size > 0 && line.Size >= bodySize+3 {
		return 1
	}
	if line.Size > 0 && line.Size >= bodySize+1.0 {
		return 2
	}
	if line.Bold && line.Size > 0 && line.Size >= bodySize-.1 {
		return 2
	}
	if len([]rune(text)) >= 8 && len([]rune(text)) <= 85 && isPDFAllCaps(text) {
		return 2
	}
	return 0
}

func looksLikePDFSentence(text string) bool {
	return strings.HasSuffix(text, ".") || strings.HasSuffix(text, "!") ||
		strings.HasSuffix(text, "?") || strings.HasSuffix(text, ";") ||
		strings.HasSuffix(text, ",")
}

func isPDFAllCaps(text string) bool {
	letters, uppercase := 0, 0
	for _, ch := range text {
		if unicode.IsLetter(ch) {
			letters++
			if unicode.IsUpper(ch) {
				uppercase++
			}
		}
	}
	return letters >= 5 && uppercase*100/letters >= 90
}

func beginsWithLowerPDF(text string) bool {
	for _, ch := range text {
		if unicode.IsLetter(ch) {
			return unicode.IsLower(ch)
		}
	}
	return false
}

func runPDFCommand(timeout time.Duration, name string, args ...string) (string, error) {
	if _, err := exec.LookPath(name); err != nil {
		return "", err
	}
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	output, err := exec.CommandContext(ctx, name, args...).Output()
	return string(output), err
}

func ocrPDFPage(path string, page int) (string, error) {
	if _, err := exec.LookPath("pdftoppm"); err != nil {
		return "", err
	}
	if _, err := exec.LookPath("tesseract"); err != nil {
		return "", err
	}
	tmpDir, err := os.MkdirTemp("", "zapohteh-ocr-*")
	if err != nil {
		return "", err
	}
	defer os.RemoveAll(tmpDir)
	imagePrefix := tmpDir + "/page"
	if _, err := runPDFCommand(30*time.Second, "pdftoppm", "-f", strconv.Itoa(page), "-l", strconv.Itoa(page),
		"-singlefile", "-r", "180", "-png", path, imagePrefix); err != nil {
		return "", err
	}
	return runPDFCommand(30*time.Second, "tesseract", imagePrefix+".png", "stdout", "-l", "eng", "--psm", "3")
}
