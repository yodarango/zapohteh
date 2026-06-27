package models

import (
	"fmt"
	"goilerplate/internal/lib"
	"goilerplate/internal/utils"
	"os"
	"path/filepath"
	"strings"
)

// Research represents a topic research request together with the chapters that
// are generated for it.
type Research struct {
	Topic    string   `json:"input"`
	Level    string   `json:"level"`
	Chapters []string `json:"chapters"`
}

// research depth levels
const (
	ResearchLevelLow    = "low"
	ResearchLevelMedium = "medium"
	ResearchLevelHigh   = "high"
)

const chaptersFileName = "chapters.md"
const donePrefix = "✅ "

/**************************************************************************************
* Run executes the full research pipeline: it generates the chapters from the topic,
* writes them to disk and then elaborates each chapter one by one.
**************************************************************************************/
func (r *Research) Run() error {
	if strings.TrimSpace(r.Level) == "" {
		r.Level = ResearchLevelMedium
	}

	err := r.GenerateChapters()
	if err != nil {
		return err
	}

	err = r.WriteChaptersFile()
	if err != nil {
		return err
	}

	err = r.ElaborateChapters()
	if err != nil {
		return err
	}

	return nil
}

/**************************************************************************************
* GenerateChapters asks the AI model to break the topic down into a comma separated
* list of chapters according to the requested research level.
**************************************************************************************/
func (r *Research) GenerateChapters() error {
	prompt := fmt.Sprintf(
		"Break down the topic \"%s\" into a list of chapters for a %s research. "+
			"Return ONLY a comma separated list of chapter titles without any other text, "+
			"numbering or formatting.",
		r.Topic, levelDescription(r.Level),
	)

	response, err := lib.NewOpenAIService().Ask(prompt)
	if err != nil {
		return err
	}

	r.Chapters = parseChapters(response)
	if len(r.Chapters) == 0 {
		return fmt.Errorf("no chapters were generated for the topic")
	}

	return nil
}

/**************************************************************************************
* WriteChaptersFile creates the topic folder inside the data directory and writes the
* generated chapters to a markdown file, one chapter per line.
**************************************************************************************/
func (r *Research) WriteChaptersFile() error {
	folder := r.folderPath()

	err := os.MkdirAll(folder, 0755)
	if err != nil {
		return fmt.Errorf("failed to create topic folder: %w", err)
	}

	content := strings.Join(r.Chapters, "\n")
	err = os.WriteFile(filepath.Join(folder, chaptersFileName), []byte(content), 0644)
	if err != nil {
		return fmt.Errorf("failed to write chapters file: %w", err)
	}

	return nil
}

/**************************************************************************************
* folderPath returns the path of the folder that holds the research for this topic.
**************************************************************************************/
func (r *Research) folderPath() string {
	return filepath.Join("data", utils.SanitizeFilename(r.Topic))
}

/**************************************************************************************
* levelDescription maps a research level to a human readable instruction that hints
* the AI model at how many chapters to produce.
**************************************************************************************/
func levelDescription(level string) string {
	switch level {
	case ResearchLevelLow:
		return "shallow and introductory (around 3 to 5 chapters)"
	case ResearchLevelHigh:
		return "deep and comprehensive (around 10 to 15 chapters). The nature of this research is academic in nature and very liekly used in post graduate scholarly research, be sure to site your sources and use scholarly and reliable sources."
	default:
		return "moderately detailed (around 6 to 9 chapters). The nature of this research is semi-academic in nature and probably used for a research paper at a master's level, be sure to site your sources and use reliable sources."
	}
}

/**************************************************************************************
* parseChapters turns a comma separated AI response into a clean slice of chapter
* titles, stripping numbering, list markers and empty entries.
**************************************************************************************/
func parseChapters(response string) []string {
	parts := strings.Split(response, ",")
	chapters := make([]string, 0, len(parts))

	for _, part := range parts {
		chapter := strings.TrimSpace(part)
		chapter = strings.Trim(chapter, "-* \t\n\r")
		chapter = strings.TrimSpace(chapter)
		if chapter == "" {
			continue
		}
		chapters = append(chapters, chapter)
	}

	return chapters
}

/**************************************************************************************
* ElaborateChapters reads the chapters file and describes the chapters one by one.
* For every chapter it asks the AI model for a description, writes that description to
* its own markdown file (named after the chapter in camelCase) and prefixes the chapter
* with DONE- in the chapters file. The process repeats until every chapter is done.
**************************************************************************************/
func (r *Research) ElaborateChapters() error {
	folder := r.folderPath()
	chaptersPath := filepath.Join(folder, chaptersFileName)

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

		// collect already described chapters and the next pending one
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

		// no pending chapter means every chapter has been described
		if next == "" {
			return nil
		}

		err = r.elaborateChapter(folder, next, done, allChapters)
		if err != nil {
			return err
		}

		// mark the chapter as done and persist the chapters file
		lines[nextIndex] = donePrefix + next
		err = os.WriteFile(chaptersPath, []byte(strings.Join(lines, "\n")), 0644)
		if err != nil {
			return fmt.Errorf("failed to update chapters file: %w", err)
		}
	}
}

/**************************************************************************************
* elaborateChapter asks the AI model to describe a single chapter and writes the
* description to a markdown file named after the chapter in camelCase. Already
* described chapters are provided to the model as context.
**************************************************************************************/
func (r *Research) elaborateChapter(folder, chapter string, done, allChapters []string) error {
	var prompt string
	if len(done) == 0 {
		prompt = fmt.Sprintf(
			"I am researching %s and I have the following chapters %s. "+
				"I want you to describe chapter %s and nothing else.",
			r.Topic, strings.Join(allChapters, ", "), chapter,
		)
	} else {
		prompt = fmt.Sprintf(
			"I am researching %s. I already have the following chapters %s. "+
				"Now describe chapter %s and nothing else.",
			r.Topic, strings.Join(done, ", "), chapter,
		)
	}

	description, err := lib.NewOpenAIService().Ask(prompt)
	if err != nil {
		return err
	}

	chapterFile := filepath.Join(folder, utils.ToCamelCase(chapter)+".md")
	err = os.WriteFile(chapterFile, []byte(description), 0644)
	if err != nil {
		return fmt.Errorf("failed to write chapter file: %w", err)
	}

	return nil
}
