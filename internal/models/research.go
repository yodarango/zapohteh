package models

import (
	"fmt"
	"goilerplate/internal/lib"
	"goilerplate/internal/utils"
	"net/url"
	"os"
	"path/filepath"
	"strings"
)

// Research represents a topic research request together with the chapters that
// are generated for it.
type Research struct {
	// Title is used only to name the folder where the research is stored.
	Title    string   `json:"title"`
	Topic    string   `json:"input"`
	Level    string   `json:"level"`
	Chapters []string `json:"chapters"`
	// SearchWeb enables web search during chapter elaboration when true.
	SearchWeb bool `json:"searchWeb"`

	// OnChapters is called once the chapter list has been generated.
	OnChapters func([]string) `json:"-"`
	// OnChapterDone is called every time a chapter has been described.
	OnChapterDone func(string) `json:"-"`
}

// research depth levels
const (
	ResearchLevelLow    = "low"
	ResearchLevelMedium = "medium"
	ResearchLevelHigh   = "high"
)

const chaptersFileName = "chapters.md"
const donePrefix = "✅ "
const dataDir = "data"
const imagesDirName = "images"

// imageSystemPrompt explains to the image model what kind of summarizing image is
// expected. The per-request user prompt only carries the chapter content.
const imageSystemPrompt = `You are an image generation assistant that creates a single image summarizing a chapter of study material. The image is a memorization aid that captures the main points at a glance, for example as a chart, timeline, list of events, people, dates or concepts. Favour clear labels and a clean educational infographic style. Do not invent facts that are not in the chapter.`

// Course represents a single researched topic stored in the data directory. ID is
// the raw folder name (used in the learn route) and Name is its Title Case version.
type Course struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

/**************************************************************************************
* ListCourses reads the data directory and returns every researched topic as a
* Course, deriving a human readable Title Case name from each folder name. Files
* (such as the database) are ignored, only directories are listed.
**************************************************************************************/
func ListCourses() ([]Course, error) {
	entries, err := os.ReadDir(dataDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []Course{}, nil
		}
		return nil, fmt.Errorf("failed to read data directory: %w", err)
	}

	courses := make([]Course, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		name := entry.Name()
		courses = append(courses, Course{ID: name, Name: utils.ToTitleCase(name)})
	}

	return courses, nil
}

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

	// notify listeners about the generated chapter list
	if r.OnChapters != nil {
		r.OnChapters(r.Chapters)
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
	system := fmt.Sprintf(`
	You are a scholarly research assistant machine that helps structure the analysis of any topic by systematizing its analysis into chapters.
	The user will give you a description of the topic they want to research according to the level of depth specified by them. 
	Your job is to provide a set of chapters to divide the topic into and facilitate its analysis.
	Return ONLY a comma separated list of chapter titles without any other text, numbering or formatting.
	Never address the user nor give any comments that are not text requested. Never compliment them nor acknowledge them. Stick to the chapters.
	`)

	user := fmt.Sprintf(
		`Topic Description: 
		%s
		Research Depth Level: 
		%s`,
		r.Topic, levelDescription(r.Level),
	)

	response, err := lib.NewOpenAIService().Ask(system, user)
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
* The folder is named after the title, falling back to the topic description when no
* title was provided.
**************************************************************************************/
func (r *Research) folderPath() string {
	name := r.Title
	if strings.TrimSpace(name) == "" {
		name = r.Topic
	}
	return filepath.Join("data", utils.SanitizeFilename(name))
}

/**************************************************************************************
* levelDescription maps a research level to a human readable instruction that hints
* the AI model at how many chapters to produce.
**************************************************************************************/
func levelDescription(level string) string {
	switch level {
	case ResearchLevelLow:
		return "Shallow and introductory (around 3 to 5 chapters)"
	case ResearchLevelHigh:
		return "Deep and comprehensive (around 10 to 15 chapters). The nature of this research is academic in nature and very liekly used in post graduate scholarly research, be sure to site your sources and use scholarly and reliable sources."
	default:
		return "Moderately detailed (around 6 to 9 chapters). The nature of this research is semi-academic in nature and probably used for a research paper at a master's level, be sure to site your sources and use reliable sources."
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

		// notify listeners that this chapter has been described
		if r.OnChapterDone != nil {
			r.OnChapterDone(next)
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
			`Research Topic Description: 
			%s 
			Research chapters:
			 %s
			Chpater I want you to describe: 
			%s.
			Describe nothing else`,
			r.Topic, strings.Join(allChapters, ", "), chapter,
		)
	} else {
		prompt = fmt.Sprintf(
			`Research Topic Description:
			%s. 
			I already have the text for the following chapters:
			%s.
			Now describe chapter %s and nothing else.`,
			r.Topic, strings.Join(done, ", "), chapter,
		)
	}

	systemDescription := `You are a research helper machine that helps analyze a specific chapter at a time from a subject given by the user. Your job is to describe it accurately and objectively.
	The user will give you the description of the topic they are interrested in, as well as the depth of your dscription. Please respect their depth description and do not provide more or less details than needed.
	Cite your sources and make sure to use reliable and scholarly ones.
	The user may give you a list of chapters that they already have the description for so you know what they are missing.
	Never address the user nor give any comments that are not text requested. Never compliment them nor acknowledge them. Stick to the description.
	`

	// only swap to the web-search enabled model when the user opted in
	service := lib.NewOpenAIService()
	var description string
	var err error
	if r.SearchWeb {
		description, err = service.AskWithWebSearch(systemDescription, prompt)
	} else {
		description, err = service.Ask(systemDescription, prompt)
	}
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

/**************************************************************************************
* ReadContent assembles the full research of a topic into a single markdown document.
* It reads the chapters file for the order and then concatenates every chapter file
* that has already been written.
**************************************************************************************/
func (r *Research) ReadContent() (string, error) {
	folder := r.folderPath()

	data, err := os.ReadFile(filepath.Join(folder, chaptersFileName))
	if err != nil {
		return "", fmt.Errorf("topic not found: %w", err)
	}

	heading := r.Title
	if strings.TrimSpace(heading) == "" {
		heading = r.Topic
	}

	var b strings.Builder
	b.WriteString("# " + heading + "\n\n")

	for _, line := range strings.Split(string(data), "\n") {
		title := strings.TrimSpace(line)
		if title == "" {
			continue
		}
		title = strings.TrimSpace(strings.TrimPrefix(title, donePrefix))

		content, err := os.ReadFile(filepath.Join(folder, utils.ToCamelCase(title)+".md"))
		if err != nil {
			// skip chapters that have not been described yet
			continue
		}

		b.WriteString("## " + title + "\n\n")
		b.Write(content)
		b.WriteString("\n\n")
	}

	return b.String(), nil
}

/**************************************************************************************
* GenerateChapterImage creates a summarizing image for a single chapter using the
* image model, fed with the chapter's content. The image is written to the images
* folder of the topic with a numeric prefix reflecting generation order, and an image
* reference is inserted into the chapter file right below its title.
**************************************************************************************/
func (r *Research) GenerateChapterImage(chapter string) error {
	folder := r.folderPath()
	chapterFile := filepath.Join(folder, utils.ToCamelCase(chapter)+".md")

	content, err := os.ReadFile(chapterFile)
	if err != nil {
		return fmt.Errorf("chapter not found: %w", err)
	}

	// ask the image model for a summarizing image of this chapter
	userPrompt := "Please create a summarizing image for the following chapter:\n\n" + string(content)
	imageBytes, err := lib.NewOpenAIService().GenerateImage(imageSystemPrompt, userPrompt)
	if err != nil {
		return err
	}

	imagesDir := filepath.Join(folder, imagesDirName)
	err = os.MkdirAll(imagesDir, 0755)
	if err != nil {
		return fmt.Errorf("failed to create images folder: %w", err)
	}

	prefix := nextImagePrefix(imagesDir)
	fileName := fmt.Sprintf("%d-%s.png", prefix, utils.ToSlug(chapter))
	err = os.WriteFile(filepath.Join(imagesDir, fileName), imageBytes, 0644)
	if err != nil {
		return fmt.Errorf("failed to write image file: %w", err)
	}

	// reference the image with a web-absolute path so the frontend resolves it
	// against the /data static route regardless of the current page URL. Each path
	// segment is URL-encoded so spaces in the folder name don't break the markdown
	// image syntax (a space inside an image URL would otherwise terminate the link).
	imageRef := "/" + encodePathSegments(filepath.ToSlash(filepath.Join(folder, imagesDirName, fileName)))
	return insertImageReference(chapterFile, chapter, imageRef)
}

/**************************************************************************************
* encodePathSegments URL-encodes each segment of a slash-separated path while keeping
* the slashes intact, so the resulting value is safe to use inside a markdown image
* URL even when folder names contain spaces or other special characters.
**************************************************************************************/
func encodePathSegments(p string) string {
	parts := strings.Split(p, "/")
	for i, part := range parts {
		parts[i] = url.PathEscape(part)
	}
	return strings.Join(parts, "/")
}

/**************************************************************************************
* nextImagePrefix returns the next numeric prefix to use for an image file in the
* given images directory, based on the highest existing prefix. Numbering starts at 1.
**************************************************************************************/
func nextImagePrefix(imagesDir string) int {
	entries, err := os.ReadDir(imagesDir)
	if err != nil {
		return 1
	}

	highest := 0
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		dash := strings.Index(name, "-")
		if dash <= 0 {
			continue
		}
		var n int
		_, err := fmt.Sscanf(name[:dash], "%d", &n)
		if err == nil && n > highest {
			highest = n
		}
	}

	return highest + 1
}

/**************************************************************************************
* insertImageReference rewrites a chapter file so that a markdown image reference is
* placed right below the chapter title. When the chapter file already starts with a
* heading it is inserted after it, otherwise a heading is prepended. This does not use
* any AI, it only edits the file in place.
**************************************************************************************/
func insertImageReference(chapterFile, chapter, imageRef string) error {
	content, err := os.ReadFile(chapterFile)
	if err != nil {
		return fmt.Errorf("failed to read chapter file: %w", err)
	}

	imageLine := fmt.Sprintf("![%s](%s)", chapter, imageRef)
	lines := strings.Split(string(content), "\n")

	// find the first non-empty line to decide whether it is already a heading
	titleIndex := -1
	for i, line := range lines {
		if strings.TrimSpace(line) != "" {
			titleIndex = i
			break
		}
	}

	var out []string
	if titleIndex >= 0 && strings.HasPrefix(strings.TrimSpace(lines[titleIndex]), "#") {
		out = append(out, lines[:titleIndex+1]...)
		out = append(out, "", imageLine)
		out = append(out, lines[titleIndex+1:]...)
	} else {
		out = append([]string{imageLine, ""}, lines...)
	}

	err = os.WriteFile(chapterFile, []byte(strings.Join(out, "\n")), 0644)
	if err != nil {
		return fmt.Errorf("failed to update chapter file: %w", err)
	}

	return nil
}
