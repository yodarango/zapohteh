package models

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"

	"zapohteh/internal/lib"
	"zapohteh/internal/utils"
)

// SourceImage is an image extracted from an imported source (PDF or web page).
// Token is the [IMAGE_N] marker used in the source text; WebPath is the
// web-absolute path under /data where the saved image is served.
type SourceImage struct {
	Token    string `json:"token"`
	FileName string `json:"fileName"`
	WebPath  string `json:"webPath"`
	Alt      string `json:"alt"`
}

// sourceSection is a heading plus its text, produced by splitSourceIntoSections.
type sourceSection struct {
	Heading string
	Text    string
}

const (
	// maxOutlineLength caps the document outline sent to the chapter planner.
	maxOutlineLength = 20000
	// maxSectionPreviewLength caps each section preview in the outline.
	maxSectionPreviewLength = 200
	// sourceSectionChunkSize is the target section size when the source has no
	// headings and must be chunked on paragraph breaks.
	sourceSectionChunkSize = 7000
	// maxChapterBatchSize caps how much source text is sent to the model in a
	// single elaboration call; larger chapters are appended in batches.
	maxChapterBatchSize = 20000
	// continuationTailLength is how much of the already written chapter is sent
	// back to the model when appending a continuation batch.
	continuationTailLength = 1500
)

// imageTokenPattern matches the [IMAGE_N] markers placed in imported content.
var imageTokenPattern = regexp.MustCompile(`\[IMAGE_\d+\]`)

// markdownHeadingPattern matches markdown-style headings (# …) in source text.
var markdownHeadingPattern = regexp.MustCompile(`^#{1,6}\s+`)

// numberedHeadingPattern matches lines like "Chapter 3" or "Part II".
var numberedHeadingPattern = regexp.MustCompile(`(?i)^(chapter|part|section)\s+[\divxlc]+\b`)

// imageToken returns the [IMAGE_N] marker for the n-th imported image (1-based).
func imageToken(n int) string {
	return fmt.Sprintf("[IMAGE_%d]", n)
}

// importContentInstructions returns the language instruction for imported
// lessons: the source text is carried over exactly as written and is only
// translated when it is not already in the requested language.
func (r *Research) importContentInstructions() string {
	lang := languageInstruction(r.Language)
	return fmt.Sprintf("If the source material is not written in %s, translate it faithfully into %s, preserving every detail; otherwise keep the original words.", lang, lang)
}

/**************************************************************************************
* runImport executes the import pipeline: chapters are planned from the extracted
* source content, then each chapter is written by restructuring its assigned source
* sections, and finally a cover image is generated like any other course.
**************************************************************************************/
func (r *Research) runImport() error {
	if strings.TrimSpace(r.SourceContent) == "" {
		return fmt.Errorf("no content could be extracted from the source")
	}

	err := r.GenerateChaptersFromContent()
	if err != nil {
		return err
	}

	err = r.WriteChaptersFile()
	if err != nil {
		return err
	}

	// notify listeners about the generated chapter list
	if r.OnChapters != nil {
		r.OnChapters(r.Chapters)
	}

	err = r.ElaborateChaptersFromContent()
	if err != nil {
		return err
	}

	// Cover image generation is best-effort, same as the AI pipeline: failures
	// are reported to the UI but do not fail the lesson.
	if err := r.GenerateCoverImage(); err != nil {
		if r.OnCoverImage != nil {
			r.OnCoverImage("error", err.Error())
		}
	}

	return nil
}

/**************************************************************************************
* saveSourceImage stores an image extracted from an import source inside the topic's
* images folder and registers it in SourceImages with the next [IMAGE_N] token.
**************************************************************************************/
func (r *Research) saveSourceImage(data []byte, ext, alt string) (SourceImage, error) {
	imagesDir := r.imagesDir()
	if err := os.MkdirAll(imagesDir, 0755); err != nil {
		return SourceImage{}, fmt.Errorf("failed to create images folder: %w", err)
	}

	n := len(r.SourceImages) + 1
	ext = strings.TrimPrefix(strings.ToLower(strings.TrimSpace(ext)), ".")
	if ext == "" {
		ext = "png"
	}
	fileName := fmt.Sprintf("%d-imported-%d.%s", nextImagePrefix(imagesDir), n, ext)
	imagePath := filepath.Join(imagesDir, fileName)
	if err := os.WriteFile(imagePath, data, 0644); err != nil {
		return SourceImage{}, fmt.Errorf("failed to write imported image: %w", err)
	}

	img := SourceImage{
		Token:    imageToken(n),
		FileName: fileName,
		WebPath:  webDataPath(imagePath),
		Alt:      alt,
	}
	r.SourceImages = append(r.SourceImages, img)
	return img, nil
}

/**************************************************************************************
* splitSourceIntoSections breaks imported content into sections. Heading lines
* (markdown headings, "Chapter N" style lines or ALL-CAPS lines) start a new
* section; when the source has no headings at all, it is chunked on paragraph
* breaks at roughly sourceSectionChunkSize characters instead.
**************************************************************************************/
func splitSourceIntoSections(content string) []sourceSection {
	lines := strings.Split(content, "\n")

	var sections []sourceSection
	var current sourceSection
	var body []string
	seenHeading := false

	flush := func() {
		text := strings.TrimSpace(strings.Join(body, "\n"))
		body = nil
		if current.Heading == "" && text == "" {
			return
		}
		current.Text = text
		sections = append(sections, current)
		current = sourceSection{}
	}

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if heading, ok := headingText(trimmed); ok {
			flush()
			current = sourceSection{Heading: heading}
			seenHeading = true
			continue
		}
		body = append(body, line)
	}
	flush()

	if seenHeading {
		return sections
	}

	// no headings anywhere: chunk the content on paragraph breaks instead
	return chunkContent(content, sourceSectionChunkSize)
}

// headingText reports whether a trimmed line is a document heading and returns
// the heading text without the heading marker.
func headingText(line string) (string, bool) {
	if line == "" {
		return "", false
	}
	if markdownHeadingPattern.MatchString(line) {
		return strings.TrimSpace(markdownHeadingPattern.ReplaceAllString(line, "")), true
	}
	if numberedHeadingPattern.MatchString(line) && len(line) <= 120 {
		return line, true
	}
	if isAllCapsHeading(line) {
		return line, true
	}
	return "", false
}

// isAllCapsHeading reports whether a short line is written entirely in capital
// letters, which is how headings often appear in extracted PDF text.
func isAllCapsHeading(line string) bool {
	if len(line) < 4 || len(line) > 100 {
		return false
	}
	letters := 0
	for _, r := range line {
		if !unicode.IsLetter(r) {
			continue
		}
		if !unicode.IsUpper(r) {
			return false
		}
		letters++
	}
	return letters >= 3
}

// chunkContent splits content into pseudo-sections of roughly size characters,
// breaking on blank lines and falling back to a hard rune-safe split for very
// long paragraphs.
func chunkContent(content string, size int) []sourceSection {
	paragraphs := strings.Split(content, "\n\n")
	var sections []sourceSection
	var b strings.Builder

	flush := func() {
		text := strings.TrimSpace(b.String())
		b.Reset()
		if text != "" {
			sections = append(sections, sourceSection{Text: text})
		}
	}

	for _, p := range paragraphs {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		if utf8.RuneCountInString(p) > size {
			flush()
			for _, chunk := range splitRunes(p, size) {
				sections = append(sections, sourceSection{Text: chunk})
			}
			continue
		}
		if b.Len() > 0 && utf8.RuneCountInString(b.String())+utf8.RuneCountInString(p) > size {
			flush()
		}
		if b.Len() > 0 {
			b.WriteString("\n\n")
		}
		b.WriteString(p)
	}
	flush()
	return sections
}

// splitRunes splits s into rune-safe chunks of at most size runes.
func splitRunes(s string, size int) []string {
	runes := []rune(s)
	var chunks []string
	for len(runes) > size {
		chunks = append(chunks, string(runes[:size]))
		runes = runes[size:]
	}
	if len(runes) > 0 {
		chunks = append(chunks, string(runes))
	}
	return chunks
}

/**************************************************************************************
* GenerateChaptersFromContent plans the course chapters from the extracted source
* content. The document's own headings are followed when present; the model must
* never invent topics that are not present in the source.
**************************************************************************************/
func (r *Research) GenerateChaptersFromContent() error {
	sections := splitSourceIntoSections(r.SourceContent)
	if len(sections) == 0 {
		return fmt.Errorf("no content could be extracted from the source")
	}

	system := fmt.Sprintf(`
	You are a scholarly assistant that turns documents into course chapters.
	The user will give you the outline of a document: its section headings with a short preview of each section's content.
	Your job is to provide a set of chapters that reorganize the document into a course.
	Follow the document's own headings when present; when the document has no clear headings, structure the content as you see fit.
	Never invent topics that are not present in the outline.
	Return ONLY a comma separated list of chapter titles in %s without any other text, numbering or formatting.
	Never address the user nor give any comments that are not text requested. Never compliment them nor acknowledge them. Stick to the chapters.
	`, languageInstruction(r.Language))

	user := fmt.Sprintf(
		`Document title:
		%s
		Document outline:
		%s`,
		r.Title, buildSourceOutline(sections),
	)

	response, err := lib.NewOpenAIService().Ask(system, user)
	if err != nil {
		return err
	}

	r.Chapters = parseChapters(response)
	if len(r.Chapters) == 0 {
		return fmt.Errorf("no chapters were generated from the source content")
	}

	return nil
}

// buildSourceOutline renders the section headings with a short preview of each
// section's content, capping the whole outline at maxOutlineLength characters.
func buildSourceOutline(sections []sourceSection) string {
	var b strings.Builder
	for i, s := range sections {
		heading := s.Heading
		if heading == "" {
			heading = fmt.Sprintf("Section %d", i+1)
		}
		preview := strings.Join(strings.Fields(s.Text), " ")
		previewRunes := []rune(preview)
		if len(previewRunes) > maxSectionPreviewLength {
			preview = string(previewRunes[:maxSectionPreviewLength]) + "…"
		}
		entry := fmt.Sprintf("%d. %s\n%s\n\n", i+1, heading, preview)
		if b.Len()+len(entry) > maxOutlineLength {
			fmt.Fprintf(&b, "… and %d more sections.\n", len(sections)-i)
			break
		}
		b.WriteString(entry)
	}
	return b.String()
}

/**************************************************************************************
* ElaborateChaptersFromContent writes every chapter by restructuring the source
* sections assigned to it. It follows the same chapters.md bookkeeping loop as
* ElaborateChapters: chapters are prefixed with the done marker one by one.
**************************************************************************************/
func (r *Research) ElaborateChaptersFromContent() error {
	folder := r.folderPath()
	chaptersPath := filepath.Join(folder, chaptersFileName)

	sections := splitSourceIntoSections(r.SourceContent)
	chapters, err := r.ReadChapters()
	if err != nil {
		return err
	}
	assignment, err := r.assignSectionsToChapters(sections, chapters)
	if err != nil {
		return err
	}

	for {
		content, err := os.ReadFile(chaptersPath)
		if err != nil {
			return fmt.Errorf("failed to read chapters file: %w", err)
		}

		lines := strings.Split(string(content), "\n")

		var done []string
		var allChapters []string
		next := ""
		nextIndex := -1

		// collect already written chapters and the next pending one
		for i, line := range lines {
			chapter := strings.TrimSpace(line)
			if chapter == "" {
				continue
			}
			if strings.HasPrefix(chapter, donePrefix) {
				done = append(done, strings.TrimPrefix(chapter, donePrefix))
				allChapters = append(allChapters, strings.TrimPrefix(chapter, donePrefix))
				continue
			}
			allChapters = append(allChapters, chapter)
			if next == "" {
				next = chapter
				nextIndex = i
			}
		}

		// no pending chapter means every chapter has been written
		if next == "" {
			return nil
		}

		err = r.elaborateChapterFromContent(folder, next, done, allChapters, sections, assignment)
		if err != nil {
			return err
		}

		// mark the chapter as done and persist the chapters file
		lines[nextIndex] = donePrefix + next
		err = os.WriteFile(chaptersPath, []byte(strings.Join(lines, "\n")), 0644)
		if err != nil {
			return fmt.Errorf("failed to update chapters file: %w", err)
		}

		// notify listeners that this chapter has been written
		if r.OnChapterDone != nil {
			r.OnChapterDone(next)
		}
	}
}

/**************************************************************************************
* elaborateChapterFromContent writes a single chapter by restructuring the source
* sections assigned to it. Long source material is sent to the model in batches:
* the first batch writes the chapter, later batches append to it given the tail of
* what has been written so far. Image tokens are swapped for real image references
* before the chapter file is written.
**************************************************************************************/
func (r *Research) elaborateChapterFromContent(folder, chapter string, done, allChapters []string, sections []sourceSection, assignment [][]int) error {
	chapterIndex := len(done) + 1

	var sourceText string
	if chapterIndex-1 < len(assignment) {
		sourceText = joinSections(sections, assignment[chapterIndex-1])
	}

	system := fmt.Sprintf(`You are a lesson formatter machine that organizes source material into a course chapter.
	The user gives you the chapter they want and the raw source material for it. Organize the material into a lesson chapter: pick the source passages that belong to this chapter and order them sensibly.
	Carry the text over exactly as written in the source: do not paraphrase, summarize, expand, embellish or change the wording. You may only add paragraph breaks and decide which source passage goes where.
	Preserve every fact, name, date and figure from the source material; never invent content that is not in it.
	The source material may contain image tokens like [IMAGE_3]: keep every token verbatim on its own line, placing each image where it best supports the surrounding text. Never renumber, rename, drop or invent tokens.
	Do not add the chapter title or any heading for the chapter itself.
	Never address the user nor give any comments that are not text requested. Stick to the chapter content.
	%s`, r.importContentInstructions())

	batches := batchSourceText(sourceText, maxChapterBatchSize)
	if len(batches) == 0 {
		batches = []string{""}
	}

	var written string
	for i, batch := range batches {
		var user string
		if i == 0 {
			user = fmt.Sprintf(
				`Course chapters:
				%s
				Chapter I want you to write:
				%s
				Source material for this chapter:
				%s`,
				strings.Join(allChapters, ", "), chapter, batch,
			)
		} else {
			user = fmt.Sprintf(
				`This is a continuation of the same chapter "%s". The chapter so far ends with:
				"""
				%s
				"""
				Append the following source material seamlessly, carrying its text over exactly as written. Never repeat what is already written and never drop content from the source material:
				%s`,
				chapter, tailOf(written, continuationTailLength), batch,
			)
		}

		part, err := lib.NewOpenAIService().Ask(system, user)
		if err != nil {
			return err
		}
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		if written != "" {
			written += "\n\n"
		}
		written += part
	}

	if strings.TrimSpace(written) == "" {
		return fmt.Errorf("no content was generated for chapter %q", chapter)
	}

	written = r.replaceImageTokens(written)

	chapterFile := filepath.Join(folder, fmt.Sprintf("%d_%s.md", chapterIndex, utils.ToCamelCase(chapter)))
	err := os.WriteFile(chapterFile, []byte(written), 0644)
	if err != nil {
		return fmt.Errorf("failed to write chapter file: %w", err)
	}

	return nil
}

// joinSections renders the given section indices as source material for a
// chapter, keeping section headings as markdown subheadings.
func joinSections(sections []sourceSection, idxs []int) string {
	var b strings.Builder
	for _, idx := range idxs {
		if idx < 0 || idx >= len(sections) {
			continue
		}
		s := sections[idx]
		if s.Heading != "" {
			b.WriteString("## " + s.Heading + "\n\n")
		}
		b.WriteString(s.Text)
		b.WriteString("\n\n")
	}
	return strings.TrimSpace(b.String())
}

/**************************************************************************************
* assignSectionsToChapters maps every source section to exactly one chapter,
* returning for each chapter the 0-based indices of its sections. When the counts
* match, the mapping is the identity; otherwise one cheap AI call proposes ranges
* ("1-2,3-3,4-6") which are validated to cover every section in order, with an
* even split as a deterministic fallback.
**************************************************************************************/
func (r *Research) assignSectionsToChapters(sections []sourceSection, chapters []string) ([][]int, error) {
	k := len(chapters)
	m := len(sections)
	assignment := make([][]int, k)

	if m == 0 || k == 0 {
		return assignment, nil
	}

	if k == m {
		for i := range assignment {
			assignment[i] = []int{i}
		}
		return assignment, nil
	}

	ranges, err := r.proposeSectionRanges(sections, chapters)
	if err == nil && validSectionRanges(ranges, k, m) {
		for i, rg := range ranges {
			for s := rg[0]; s <= rg[1]; s++ {
				assignment[i] = append(assignment[i], s-1)
			}
		}
		return assignment, nil
	}

	// fallback: even split; section s (0-based) belongs to chapter floor(s*k/m)
	for s := 0; s < m; s++ {
		ch := s * k / m
		assignment[ch] = append(assignment[ch], s)
	}
	return assignment, nil
}

// proposeSectionRanges asks the model for a 1-based section range per chapter,
// e.g. "1-2,3-3,4-6".
func (r *Research) proposeSectionRanges(sections []sourceSection, chapters []string) ([][2]int, error) {
	var secList strings.Builder
	for i, s := range sections {
		heading := s.Heading
		if heading == "" {
			heading = strings.Join(strings.Fields(s.Text), " ")
			runes := []rune(heading)
			if len(runes) > 80 {
				heading = string(runes[:80]) + "…"
			}
		}
		secList.WriteString(fmt.Sprintf("%d. %s\n", i+1, heading))
	}

	system := `You map document sections to course chapters.
	The user gives you a numbered list of document sections and a numbered list of course chapters.
	Assign the sections to the chapters so that every section is covered exactly once and the order is preserved.
	Return ONLY one comma separated 1-based range per chapter, in chapter order, e.g. "1-2,3-3,4-6".`

	var user strings.Builder
	user.WriteString("Document sections:\n")
	user.WriteString(secList.String())
	user.WriteString("\nCourse chapters:\n")
	for i, ch := range chapters {
		user.WriteString(fmt.Sprintf("%d. %s\n", i+1, ch))
	}

	response, err := lib.NewOpenAIService().Ask(system, user.String())
	if err != nil {
		return nil, err
	}

	return parseSectionRanges(response)
}

// parseSectionRanges parses a comma separated list of 1-based ranges like
// "1-2,3-3,4-6" into [start, end] pairs. A bare number n means the range n-n.
func parseSectionRanges(response string) ([][2]int, error) {
	parts := strings.Split(response, ",")
	ranges := make([][2]int, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		var start, end int
		if strings.Contains(part, "-") {
			bounds := strings.SplitN(part, "-", 2)
			var err1, err2 error
			start, err1 = strconv.Atoi(strings.TrimSpace(bounds[0]))
			end, err2 = strconv.Atoi(strings.TrimSpace(bounds[1]))
			if err1 != nil || err2 != nil {
				return nil, fmt.Errorf("invalid section range %q", part)
			}
		} else {
			n, err := strconv.Atoi(part)
			if err != nil {
				return nil, fmt.Errorf("invalid section range %q", part)
			}
			start, end = n, n
		}
		ranges = append(ranges, [2]int{start, end})
	}
	if len(ranges) == 0 {
		return nil, fmt.Errorf("no section ranges found")
	}
	return ranges, nil
}

// validSectionRanges reports whether the ranges cover every section 1..m
// exactly once, in order, with exactly one range per chapter.
func validSectionRanges(ranges [][2]int, k, m int) bool {
	if len(ranges) != k {
		return false
	}
	next := 1
	for _, rg := range ranges {
		if rg[0] != next || rg[1] < rg[0] {
			return false
		}
		next = rg[1] + 1
	}
	return next == m+1
}

// batchSourceText splits source material into batches of at most size
// characters, breaking on paragraph boundaries where possible.
func batchSourceText(text string, size int) []string {
	paragraphs := strings.Split(text, "\n\n")
	var batches []string
	var b strings.Builder

	flush := func() {
		if strings.TrimSpace(b.String()) == "" {
			b.Reset()
			return
		}
		batches = append(batches, strings.TrimSpace(b.String()))
		b.Reset()
	}

	for _, p := range paragraphs {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		if len(p) > size {
			flush()
			batches = append(batches, splitRunes(p, size)...)
			continue
		}
		if b.Len() > 0 && b.Len()+len(p)+2 > size {
			flush()
		}
		if b.Len() > 0 {
			b.WriteString("\n\n")
		}
		b.WriteString(p)
	}
	flush()
	return batches
}

// tailOf returns the last n runes of s.
func tailOf(s string, n int) string {
	runes := []rune(s)
	if len(runes) <= n {
		return s
	}
	return string(runes[len(runes)-n:])
}

/**************************************************************************************
* replaceImageTokens swaps every [IMAGE_N] token in the chapter markdown for the
* markdown reference of the corresponding imported image. Tokens left over without
* a matching image (or duplicated by the model) are stripped.
**************************************************************************************/
func (r *Research) replaceImageTokens(md string) string {
	for _, img := range r.SourceImages {
		alt := strings.ReplaceAll(img.Alt, "]", "")
		md = strings.ReplaceAll(md, img.Token, fmt.Sprintf("![%s](%s)", alt, img.WebPath))
	}
	return imageTokenPattern.ReplaceAllString(md, "")
}
