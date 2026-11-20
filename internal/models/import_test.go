package models

import (
	"strings"
	"testing"
)

func TestMergeParentSectionsAttachesHeadingOnlySectionsAsPrefix(t *testing.T) {
	longText := strings.Repeat("a", 250)
	sections := []sourceSection{
		{Heading: "Main heading", Level: 1},
		{Heading: "1 chapter heading", Level: 2},
		{Heading: "Section one heading", Level: 3, Text: longText},
		{Heading: "Section two", Level: 3, Text: longText},
	}

	merged := mergeParentSections(sections)

	if len(merged) != 2 {
		t.Fatalf("expected 2 chapters, got %d", len(merged))
	}
	if merged[0].Heading != "Section one heading" {
		t.Errorf("expected first chapter %q, got %q", "Section one heading", merged[0].Heading)
	}
	if merged[0].Text != longText {
		t.Errorf("chapter text must stay untouched, got %q", merged[0].Text)
	}
	if len(merged[0].Prefix) != 2 {
		t.Fatalf("expected 2 prefix sections, got %d", len(merged[0].Prefix))
	}
	// prefix sections keep their original level and order
	if merged[0].Prefix[0].Heading != "Main heading" || merged[0].Prefix[0].Level != 1 {
		t.Errorf("unexpected first prefix section: %+v", merged[0].Prefix[0])
	}
	if merged[0].Prefix[1].Heading != "1 chapter heading" || merged[0].Prefix[1].Level != 2 {
		t.Errorf("unexpected second prefix section: %+v", merged[0].Prefix[1])
	}
	if len(merged[1].Prefix) != 0 {
		t.Errorf("second chapter should have no prefix sections, got %+v", merged[1].Prefix)
	}
}

func TestMergeParentSectionsPrefixKeepsShortText(t *testing.T) {
	longText := strings.Repeat("b", 300)
	sections := []sourceSection{
		{Heading: "Parent", Level: 4, Text: "a brief orientation line"},
		{Heading: "Chapter", Level: 3, Text: longText},
	}

	merged := mergeParentSections(sections)

	if len(merged) != 1 {
		t.Fatalf("expected 1 chapter, got %d", len(merged))
	}
	if len(merged[0].Prefix) != 1 {
		t.Fatalf("expected 1 prefix section, got %d", len(merged[0].Prefix))
	}
	prefix := merged[0].Prefix[0]
	if prefix.Heading != "Parent" || prefix.Level != 4 || prefix.Text != "a brief orientation line" {
		t.Errorf("prefix section must keep heading, level and text, got %+v", prefix)
	}
	if merged[0].Text != longText {
		t.Errorf("chapter text must stay untouched, got %q", merged[0].Text)
	}
}

func TestMergeParentSectionsKeepsLastShortSection(t *testing.T) {
	longText := strings.Repeat("a", 250)
	sections := []sourceSection{
		{Heading: "Real chapter", Level: 2, Text: longText},
		{Heading: "Parent", Level: 1},
		{Heading: "Short tail", Level: 2, Text: "brief closing note"},
	}

	merged := mergeParentSections(sections)

	if len(merged) != 2 {
		t.Fatalf("expected 2 chapters, got %d", len(merged))
	}
	if merged[1].Heading != "Short tail" {
		t.Errorf("expected last chapter %q, got %q", "Short tail", merged[1].Heading)
	}
	if merged[1].Text != "brief closing note" {
		t.Errorf("last chapter text must stay untouched, got %q", merged[1].Text)
	}
	if len(merged[1].Prefix) != 1 || merged[1].Prefix[0].Heading != "Parent" {
		t.Errorf("expected Parent as prefix of the last chapter, got %+v", merged[1].Prefix)
	}
}

func TestMergeParentSectionsKeepsLongSectionsUntouched(t *testing.T) {
	longText := strings.Repeat("a", 250)
	sections := []sourceSection{
		{Heading: "First", Level: 1, Text: longText},
		{Heading: "Second", Level: 3, Text: longText},
	}

	merged := mergeParentSections(sections)

	if len(merged) != 2 {
		t.Fatalf("expected 2 chapters, got %d", len(merged))
	}
	for i, section := range merged {
		if section.Heading != sections[i].Heading || section.Text != sections[i].Text {
			t.Errorf("section %d was modified: %+v", i, section)
		}
		if len(section.Prefix) != 0 {
			t.Errorf("section %d should have no prefix sections, got %+v", i, section.Prefix)
		}
	}
}

func TestMergeParentSectionsSingleShortSection(t *testing.T) {
	sections := []sourceSection{
		{Heading: "Content", Text: "very short document"},
	}

	merged := mergeParentSections(sections)

	if len(merged) != 1 || merged[0].Heading != "Content" || merged[0].Text != "very short document" {
		t.Errorf("single short section must remain untouched, got %+v", merged)
	}
}

func TestChapterContentHasOwnHeading(t *testing.T) {
	content := "# Main heading\n\n## 1 chapter heading\n\n### Section one heading\n\nsome text"

	for _, title := range []string{"Main heading", "1 chapter heading", "Section one heading"} {
		if !chapterContentHasOwnHeading(content, title) {
			t.Errorf("expected content to contain heading %q", title)
		}
	}
	for _, title := range []string{"Missing", "Section one", "1 chapter heading extra"} {
		if chapterContentHasOwnHeading(content, title) {
			t.Errorf("expected content not to contain heading %q", title)
		}
	}
	if chapterContentHasOwnHeading("plain text without headings", "Title") {
		t.Errorf("plain text must not report a heading")
	}
}

// TestRunImportPreservesSourceHeadingStructure imports a document whose source
// has structural headings ahead of the real sections (like a "page-by-page
// summary" title before page sections) and verifies that the assembled lesson
// keeps those headings in place, at their original level, without turning them
// into chapters.
func TestRunImportPreservesSourceHeadingStructure(t *testing.T) {
	t.Setenv("CONTENT_DIR", t.TempDir())

	body := strings.Repeat("Page content. ", 30) // well over 200 chars
	r := &Research{
		Title:      "Sample Lesson",
		UserID:     9,
		SourceType: CourseSourceDoc,
		SourceContent: strings.Join([]string{
			"# Thinking, Meaning, and Truth",
			"",
			"Some opening text.",
			"",
			"## Page-by-page summary",
			"",
			"## Page 2 - First topic",
			"",
			body,
			"",
			"## Page 3 - Second topic",
			"",
			body,
		}, "\n"),
	}

	if err := r.runImport(); err != nil {
		t.Fatalf("runImport failed: %v", err)
	}

	expectedChapters := []string{"Page 2 - First topic", "Page 3 - Second topic"}
	if len(r.Chapters) != len(expectedChapters) {
		t.Fatalf("expected %d chapters, got %v", len(expectedChapters), r.Chapters)
	}
	for i, title := range expectedChapters {
		if r.Chapters[i] != title {
			t.Errorf("expected chapter %d to be %q, got %q", i, title, r.Chapters[i])
		}
	}

	if !r.IsImported() {
		t.Errorf("expected IsImported to report true")
	}
	if got := r.countVisibleChapters(); got != len(expectedChapters) {
		t.Errorf("expected %d visible chapters, got %d", len(expectedChapters), got)
	}
	if got := r.ChapterTitles(); len(got) != 2 || got[0] != expectedChapters[0] || got[1] != expectedChapters[1] {
		t.Errorf("unexpected chapter titles: %v", got)
	}

	content, err := r.ReadContent()
	if err != nil {
		t.Fatalf("ReadContent failed: %v", err)
	}

	// structural headings stay in the source order at their original levels,
	// ahead of the chapter they introduce
	landmarks := []string{
		"# Sample Lesson",
		"# Thinking, Meaning, and Truth",
		"Some opening text.",
		"## Page-by-page summary",
		"## Page 2 - First topic",
		"## Page 3 - Second topic",
	}
	previous := -1
	for _, landmark := range landmarks {
		idx := strings.Index(content, landmark)
		if idx < 0 {
			t.Fatalf("assembled content is missing %q:\n%s", landmark, content)
		}
		if idx <= previous {
			t.Errorf("%q is out of order in the assembled content:\n%s", landmark, content)
		}
		previous = idx
	}
}
