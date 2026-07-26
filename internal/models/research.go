package models

import (
	"database/sql"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"zapohteh/internal/lib"
	"zapohteh/internal/utils"
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
	// SubjectIDs are the subjects to attach to the created course.
	SubjectIDs []int `json:"subjectIds"`
	// Language is the language in which the content is generated.
	Language string `json:"language"`
	// WritingStyle controls the tone and register of the generated text.
	WritingStyle string `json:"writingStyle"`
	// UserID is the owner of the research content.
	UserID uint `json:"userId"`

	// OnChapters is called once the chapter list has been generated.
	OnChapters func([]string) `json:"-"`
	// OnChapterDone is called every time a chapter has been described.
	OnChapterDone func(string) `json:"-"`
	// OnCoverImage is called when the cover image generation phase updates.
	// The phase string is one of: "description", "image", "done".
	OnCoverImage func(phase string, data string) `json:"-"`
}

// research depth levels
const (
	ResearchLevelLow    = "low"
	ResearchLevelMedium = "medium"
	ResearchLevelHigh   = "high"
)

const chaptersFileName = "chapters.md"
const donePrefix = "✅ "
const imagesDirName = "images"

// imageSystemPrompt explains to the image model what kind of summarizing image is
// expected. The per-request user prompt only carries the chapter content.
const imageSystemPrompt = `You are an image generation assistant that creates a single image summarizing a chapter of study material. The image is a memorization aid that captures the main points at a glance, for example as a chart, timeline, list of events, people, dates or concepts. Favour clear labels and a clean educational infographic style. Do not invent facts that are not in the chapter.`

// coverImageDescriptionPrompt asks the completions model to craft a prompt for an
// image generation model that will be used as the cover image for the course.
const coverImageDescriptionPrompt = `You are an assistant that helps create cover images for educational blog posts. A researcher is investigating a topic and has enrolled in a course with several chapters. Your job is to write a single, detailed description that can be sent directly to an image generation model to create a 1024x1024 cover image for the blog post. The description should capture the theme of the topic and the breadth of the chapters without inventing facts. Return only the description, no commentary.`

// coverImageSystemPrompt explains to the image model what kind of cover image is expected.
const coverImageSystemPrompt = `You are an image generation assistant that creates a single, eye-catching cover image for an educational blog post. The image should be visually engaging, thematically relevant, and suitable as a 1024x1024 blog post cover. Favour a clean, professional style without small text or labels.`

// languageInstruction returns a clean language value, defaulting to English.
func languageInstruction(language string) string {
	lang := strings.TrimSpace(language)
	if lang == "" {
		return "English"
	}
	return lang
}

// writingStyleDescription returns a prompt instruction for the requested tone.
func writingStyleDescription(style string) string {
	switch strings.ToLower(style) {
	case "academic":
		return "Write the content as a scholarly research paper: formal tone, structured arguments, citations, and advanced academic vocabulary."
	case "professional":
		return "Write the content as a professional blog post: clear, engaging, well-structured, and suitable for an educated general audience."
	case "casual":
		return "Write the content in everyday vernacular language using common words and simple terms that even a learner of the language can understand."
	default:
		return "Write the content as a professional blog post: clear, engaging, well-structured, and suitable for an educated general audience."
	}
}

// contentInstructions returns the language and writing style prompt for the AI.
func (r *Research) contentInstructions() string {
	lang := languageInstruction(r.Language)
	style := writingStyleDescription(r.WritingStyle)
	return fmt.Sprintf("Write the response in %s. %s", lang, style)
}

// Course represents a single researched topic stored in the data directory. ID is
// the raw folder name (used in the learn route) and Name is its Title Case version.
type Course struct {
	ID             string     `json:"id"`
	Name           string     `json:"name"`
	CoverImagePath string     `json:"coverImagePath"`
	Language       string     `json:"language"`
	TotalChapters  int        `json:"totalChapters"`
	ReadChapters   int        `json:"readChapters"`
	Subjects       []Subject  `json:"subjects"`
	CreatedAt      time.Time  `json:"createdAt"`
	LastReadAt     *time.Time `json:"lastReadAt"`
	CompletedAt    *time.Time `json:"completedAt"`
}

/**************************************************************************************
* GetCoverImagePath returns the stored cover image path for a course title and user,
* or an empty string when none has been generated yet.
**************************************************************************************/
func GetCoverImagePath(userId uint, title string) string {
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return ""
	}
	var path sql.NullString
	err := ModelsRepo.DB.Conn.QueryRow(
		"SELECT cover_image_path FROM courses WHERE user_id = ? AND title = ?",
		userId, title,
	).Scan(&path)
	if err != nil || !path.Valid {
		return ""
	}
	return path.String
}

/**************************************************************************************
* ListCourses reads the data directory for a user and returns every researched topic as
* a Course. Files are ignored, only directories are listed. Each course is also enriched
* with its cover image path, reading progress, and subjects from the database.
**************************************************************************************/
func ListCourses(userId uint) ([]Course, error) {
	userDir := filepath.Join(utils.ContentDir(), fmt.Sprintf("user_%d", userId))
	entries, err := os.ReadDir(userDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []Course{}, nil
		}
		return nil, fmt.Errorf("failed to read user data directory: %w", err)
	}

	coverPaths := make(map[string]string)
	createdAts := make(map[string]time.Time)
	completedAts := make(map[string]*time.Time)
	languages := make(map[string]string)
	if ModelsRepo != nil && ModelsRepo.DB != nil && ModelsRepo.DB.Conn != nil {
		rows, err := ModelsRepo.DB.Conn.Query(
			"SELECT title, cover_image_path, created_at, completed_at, language FROM courses WHERE user_id = ?",
			userId,
		)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var title string
				var path sql.NullString
				var createdAt time.Time
				var completedAt sql.NullTime
				var language sql.NullString
				if err := rows.Scan(&title, &path, &createdAt, &completedAt, &language); err == nil {
					key := utils.SanitizeFilename(title)
					if path.Valid && path.String != "" {
						coverPaths[key] = path.String
					}
					createdAts[key] = createdAt
					if completedAt.Valid {
						completedAts[key] = &completedAt.Time
					}
					if language.Valid && language.String != "" {
						languages[key] = language.String
					}
				}
			}
		}
	}

	readCounts := make(map[string]int)
	lastReadAts := make(map[string]*time.Time)
	if ModelsRepo != nil && ModelsRepo.DB != nil && ModelsRepo.DB.Conn != nil {
		rows, err := ModelsRepo.DB.Conn.Query(
			"SELECT course_title, COUNT(*) FROM reading_progress WHERE user_id = ? AND read = 1 GROUP BY course_title",
			userId,
		)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var title string
				var count int
				if err := rows.Scan(&title, &count); err == nil {
					readCounts[utils.SanitizeFilename(title)] = count
				}
			}
		}

		rows2, err2 := ModelsRepo.DB.Conn.Query(
			"SELECT course_title, MAX(updated_at) FROM reading_progress WHERE user_id = ? AND read = 1 GROUP BY course_title",
			userId,
		)
		if err2 == nil {
			defer rows2.Close()
			for rows2.Next() {
				var title string
				var lastRead sql.NullString
				if err := rows2.Scan(&title, &lastRead); err == nil && lastRead.Valid {
					if t, err := time.Parse("2006-01-02 15:04:05", lastRead.String); err == nil {
						sanitized := utils.SanitizeFilename(title)
						lastReadAts[sanitized] = &t
					}
				}
			}
		}
	}

	subjectMap, err := SubjectColorMap(userId)
	if err != nil {
		subjectMap = make(map[string][]Subject)
	}

	courses := make([]Course, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		name := entry.Name()
		total := countChapters(filepath.Join(userDir, name))
		courses = append(courses, Course{
			ID:             name,
			Name:           utils.ToTitleCase(name),
			CoverImagePath: coverPaths[name],
			Language:       languages[name],
			TotalChapters:  total,
			ReadChapters:   readCounts[name],
			Subjects:       subjectMap[name],
			CreatedAt:      createdAts[name],
			LastReadAt:     lastReadAts[name],
			CompletedAt:    completedAts[name],
		})
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

	// Cover image generation is best-effort. If it fails, notify the UI so it can
	// mark the thumbnail step as failed, but continue to treat the lesson as
	// successful since the chapters and research were already completed.
	if err := r.GenerateCoverImage(); err != nil {
		if r.OnCoverImage != nil {
			r.OnCoverImage("error", err.Error())
		}
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
	Return ONLY a comma separated list of chapter titles in %s without any other text, numbering or formatting.
	Never address the user nor give any comments that are not text requested. Never compliment them nor acknowledge them. Stick to the chapters.
	`, languageInstruction(r.Language))

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
* ReadChapters reads the persisted chapter titles from the topic folder.
**************************************************************************************/
func (r *Research) ReadChapters() ([]string, error) {
	folder := r.folderPath()
	data, err := os.ReadFile(filepath.Join(folder, chaptersFileName))
	if err != nil {
		return nil, fmt.Errorf("failed to read chapters file: %w", err)
	}

	lines := strings.Split(string(data), "\n")
	chapters := make([]string, 0, len(lines))
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		line = strings.TrimPrefix(line, donePrefix)
		chapters = append(chapters, line)
	}
	return chapters, nil
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
	userDir := fmt.Sprintf("user_%d", r.UserID)
	return filepath.Join(utils.ContentDir(), userDir, utils.SanitizeFilename(name))
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
		return "Deep and comprehensive (around 10 to 15 chapters). The nature of this research is academic in nature and very liekly used in post graduate scholarly research, be sure to site your sources in chicago style and use scholarly and reliable sources."
	default:
		return "Moderately detailed (around 6 to 9 chapters). The nature of this research is semi-academic in nature and probably used for a research paper at a master's level, be sure to site your sources in chicago style and use reliable sources."
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
* description to a numbered markdown file (e.g. 1_introduction.md). Already described
* chapters are provided to the model as context.
**************************************************************************************/
func (r *Research) elaborateChapter(folder, chapter string, done, allChapters []string) error {
	chapterIndex := len(done) + 1

	var previousContent string
	if len(done) > 0 {
		prevIndex := len(done)
		prevFile := chapterFilePath(folder, done[len(done)-1], prevIndex)
		if data, err := os.ReadFile(prevFile); err == nil {
			previousContent = string(data)
		}
	}

	var prompt string
	if len(done) == 0 {
		prompt = fmt.Sprintf(
			`Research Topic Description:
			%s
			Research chapters:
			 %s
			Chapter I want you to describe:
			%s.
			Describe nothing else`,
			r.Topic, strings.Join(allChapters, ", "), chapter,
		)
	} else if previousContent != "" {
		prompt = fmt.Sprintf(
			`Research Topic Description:
			%s.
			Research chapters:
			%s.
			Previous chapter "%s" content:
			%s.
			Now describe chapter "%s" and nothing else. Write the new chapter so it flows naturally from the previous chapter without repeating it.`,
			r.Topic, strings.Join(allChapters, ", "), done[len(done)-1], previousContent, chapter,
		)
	} else {
		prompt = fmt.Sprintf(
			`Research Topic Description:
			%s.
			I already have the text for the following chapters:
			%s.
			Now describe chapter "%s" and nothing else.`,
			r.Topic, strings.Join(done, ", "), chapter,
		)
	}

	systemDescription := fmt.Sprintf(`You are a research helper machine that helps analyze a specific chapter at a time from a subject given by the user. Your job is to describe it accurately and objectively.
	The user will give you the description of the topic they are interested in, as well as the depth of your description. Please respect their depth description and do not provide more or less details than needed.
	Cite your sources in chicago style and make sure to use reliable and scholarly ones.
	When the user provides the content of the previous chapter, write the current chapter so it flows naturally from it. Do not repeat the previous chapter content; build upon it so the reader feels a continuous narrative.
	Do not introduce the topic, chapter title, or purpose of the chpater. For example, do not say this chapters delves into..., or this chapter explains... Simply describe the content. THat's it.
	The user may give you a list of chapters that they already have the description for so you know what they are missing.
	Remember, you must omit the title of the chapter. just elaborate on it. NEVERE NEVER give the same title to more than one chapter.
	Never address the user nor give any comments that are not text requested. Never compliment them nor acknowledge them. Stick to the description.
	%s`, r.contentInstructions())

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

	chapterFile := filepath.Join(folder, fmt.Sprintf("%d_%s.md", chapterIndex, utils.ToCamelCase(chapter)))
	err = os.WriteFile(chapterFile, []byte(description), 0644)
	if err != nil {
		return fmt.Errorf("failed to write chapter file: %w", err)
	}

	return nil
}

// chapterIndexFromFile reads chapters.md and returns the 1-based index of the given
// chapter title, or -1 if it is not found.
func chapterIndexFromFile(folder, chapter string) int {
	data, err := os.ReadFile(filepath.Join(folder, chaptersFileName))
	if err != nil {
		return -1
	}
	idx := 1
	for _, line := range strings.Split(string(data), "\n") {
		title := strings.TrimSpace(line)
		if title == "" {
			continue
		}
		title = strings.TrimSpace(strings.TrimPrefix(title, donePrefix))
		if title == chapter {
			return idx
		}
		idx++
	}
	return -1
}

// chapterFilePath returns the path to a chapter's markdown file. Files are named
// with a 1-based numeric prefix to avoid collisions when two chapters share the
// same title (e.g. 1_introduction.md). If the numbered file does not exist, it
// falls back to the legacy camelCase filename for backwards compatibility.
func chapterFilePath(folder, chapter string, index int) string {
	numbered := filepath.Join(folder, fmt.Sprintf("%d_%s.md", index, utils.ToCamelCase(chapter)))
	if _, err := os.Stat(numbered); err == nil {
		return numbered
	}
	return filepath.Join(folder, utils.ToCamelCase(chapter)+".md")
}

// chapterFileByTitle finds the markdown file for a chapter by title, using the
// order declared in chapters.md.
func chapterFileByTitle(folder, chapter string) string {
	idx := chapterIndexFromFile(folder, chapter)
	if idx <= 0 {
		return filepath.Join(folder, utils.ToCamelCase(chapter)+".md")
	}
	return chapterFilePath(folder, chapter, idx)
}

/**************************************************************************************
* ReadContent returns the full research of a topic as a single markdown document. The
* per-chapter files are assembled in the order declared in chapters.md.
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

	idx := 1
	for _, line := range strings.Split(string(data), "\n") {
		title := strings.TrimSpace(line)
		if title == "" {
			continue
		}
		title = strings.TrimSpace(strings.TrimPrefix(title, donePrefix))

		content, err := os.ReadFile(chapterFilePath(folder, title, idx))
		if err != nil {
			// skip chapters that have not been described yet
			idx++
			continue
		}

		b.WriteString("## " + title + "\n\n")
		b.Write(content)
		b.WriteString("\n\n")
		idx++
	}

	return b.String(), nil
}

// Highlight represents a user-created text highlight stored in the database.
type Highlight struct {
	ID          int       `json:"id"`
	UserID      uint      `json:"userId"`
	CourseID    int       `json:"courseId"`
	HighlightID int       `json:"highlightId"`
	Chapter     string    `json:"chapter"`
	Text        string    `json:"text"`
	Note        string    `json:"note"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// UserHighlight represents a user-defined highlight style (label + color) that can be
// reused across courses.
type UserHighlight struct {
	ID          int       `json:"id"`
	UserID      uint      `json:"userId"`
	Label       string    `json:"label"`
	Color       string    `json:"color"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// getCourseID returns the database id of a user's course by title.
func getCourseID(userId uint, title string) (int, error) {
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return 0, fmt.Errorf("database is not available")
	}
	var id int
	err := ModelsRepo.DB.Conn.QueryRow(
		"SELECT id FROM courses WHERE user_id = ? AND title = ?",
		userId, title,
	).Scan(&id)
	if err != nil {
		return 0, fmt.Errorf("course not found: %w", err)
	}
	return id, nil
}

// AllCourseHighlight represents a single course highlight enriched with the course
// title, cover image, highlight color and course subjects for rendering in the highlights feed.
type AllCourseHighlight struct {
	ID             int       `json:"id"`
	CourseID       int       `json:"courseId"`
	CourseTitle    string    `json:"courseTitle"`
	CoverImagePath string    `json:"coverImagePath"`
	HighlightID    int       `json:"highlightId"`
	Color          string    `json:"color"`
	Chapter        string    `json:"chapter"`
	Text           string    `json:"text"`
	Note           string    `json:"note"`
	Subjects       []Subject `json:"subjects"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

// ListAllCourseHighlights returns all of a user's course highlights across every
// course, enriched with the course title, cover image path and highlight color.
// Results are ordered by the highlight's updated_at timestamp descending and
// paginated with limit/offset. The second return value is the total count.
func ListAllCourseHighlights(userId uint, limit, offset int) ([]AllCourseHighlight, int, error) {
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return nil, 0, fmt.Errorf("database is not available")
	}

	var total int
	err := ModelsRepo.DB.Conn.QueryRow(
		"SELECT COUNT(*) FROM course_highlights WHERE user_id = ?",
		userId,
	).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count highlights: %w", err)
	}

	rows, err := ModelsRepo.DB.Conn.Query(`
		SELECT
			ch.id,
			ch.course_id,
			c.title,
			c.cover_image_path,
			ch.highlight_id,
			h.color,
			ch.chapter,
			ch.text,
			ch.note,
			ch.created_at,
			ch.updated_at
		FROM course_highlights ch
		JOIN courses c ON c.id = ch.course_id
		JOIN highlights h ON h.id = ch.highlight_id
		WHERE ch.user_id = ?
		ORDER BY ch.updated_at DESC
		LIMIT ? OFFSET ?`,
		userId, limit, offset,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to read highlights: %w", err)
	}
	defer rows.Close()

	highlights := []AllCourseHighlight{}
	for rows.Next() {
		var h AllCourseHighlight
		var coverImagePath sql.NullString
		if err := rows.Scan(
			&h.ID, &h.CourseID, &h.CourseTitle, &coverImagePath,
			&h.HighlightID, &h.Color, &h.Chapter, &h.Text, &h.Note,
			&h.CreatedAt, &h.UpdatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("failed to scan highlight: %w", err)
		}
		if coverImagePath.Valid {
			h.CoverImagePath = coverImagePath.String
		}
		highlights = append(highlights, h)
	}
	return highlights, total, nil
}

// ReadHighlights reads the persisted highlights for a user's course.
func ReadHighlights(userId uint, title string) ([]Highlight, error) {
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return nil, fmt.Errorf("database is not available")
	}

	courseId, err := getCourseID(userId, title)
	if err != nil {
		return []Highlight{}, nil
	}

	rows, err := ModelsRepo.DB.Conn.Query(
		"SELECT id, user_id, course_id, highlight_id, chapter, text, note, created_at, updated_at FROM course_highlights WHERE user_id = ? AND course_id = ? ORDER BY created_at",
		userId, courseId,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to read highlights: %w", err)
	}
	defer rows.Close()

	highlights := []Highlight{}
	for rows.Next() {
		var h Highlight
		if err := rows.Scan(
			&h.ID, &h.UserID, &h.CourseID, &h.HighlightID, &h.Chapter, &h.Text, &h.Note, &h.CreatedAt, &h.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan highlight: %w", err)
		}
		highlights = append(highlights, h)
	}
	return highlights, nil
}

// DeleteCourseHighlight deletes a single course highlight by id if it belongs to the user.
func DeleteCourseHighlight(userId uint, id int) error {
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return fmt.Errorf("database is not available")
	}
	res, err := ModelsRepo.DB.Conn.Exec(
		"DELETE FROM course_highlights WHERE id = ? AND user_id = ?",
		id, userId,
	)
	if err != nil {
		return fmt.Errorf("failed to delete highlight: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check delete: %w", err)
	}
	if n == 0 {
		return fmt.Errorf("highlight not found")
	}
	return nil
}

// WriteHighlights replaces all highlights for a user's course with the given list.
func WriteHighlights(userId uint, title string, highlights []Highlight) error {
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return fmt.Errorf("database is not available")
	}

	courseId, err := getCourseID(userId, title)
	if err != nil {
		return err
	}

	tx, err := ModelsRepo.DB.Conn.Begin()
	if err != nil {
		return err
	}

	if _, err := tx.Exec(
		"DELETE FROM course_highlights WHERE user_id = ? AND course_id = ?",
		userId, courseId,
	); err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to clear old highlights: %w", err)
	}

	for _, h := range highlights {
		if strings.TrimSpace(h.Text) == "" || h.HighlightID <= 0 {
			continue
		}
		if _, err := tx.Exec(
			"INSERT INTO course_highlights (user_id, course_id, highlight_id, chapter, text, note) VALUES (?, ?, ?, ?, ?, ?)",
			userId, courseId, h.HighlightID, h.Chapter, h.Text, h.Note,
		); err != nil {
			tx.Rollback()
			return fmt.Errorf("failed to insert highlight: %w", err)
		}
	}

	return tx.Commit()
}

// ListUserHighlights returns all user-defined highlights for a user.
func ListUserHighlights(userId uint) ([]UserHighlight, error) {
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return nil, fmt.Errorf("database is not available")
	}
	rows, err := ModelsRepo.DB.Conn.Query(
		"SELECT id, user_id, label, color, description, created_at, updated_at FROM highlights WHERE user_id = ? ORDER BY created_at",
		userId,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to read highlights: %w", err)
	}
	defer rows.Close()

	highlights := []UserHighlight{}
	for rows.Next() {
		var h UserHighlight
		if err := rows.Scan(
			&h.ID, &h.UserID, &h.Label, &h.Color, &h.Description, &h.CreatedAt, &h.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan highlight: %w", err)
		}
		highlights = append(highlights, h)
	}
	return highlights, nil
}

// CreateUserHighlight inserts a new user-defined highlight.
func CreateUserHighlight(userId uint, label, color, description string) (int, error) {
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return 0, fmt.Errorf("database is not available")
	}
	res, err := ModelsRepo.DB.Conn.Exec(
		"INSERT INTO highlights (user_id, label, color, description) VALUES (?, ?, ?, ?)",
		userId, label, color, description,
	)
	if err != nil {
		return 0, fmt.Errorf("failed to create highlight: %w", err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("failed to get highlight id: %w", err)
	}
	return int(id), nil
}

// UpdateUserHighlight updates a user-defined highlight if it belongs to the user.
func UpdateUserHighlight(userId uint, id int, label, color, description string) error {
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return fmt.Errorf("database is not available")
	}
	res, err := ModelsRepo.DB.Conn.Exec(
		"UPDATE highlights SET label = ?, color = ?, description = ? WHERE id = ? AND user_id = ?",
		label, color, description, id, userId,
	)
	if err != nil {
		return fmt.Errorf("failed to update highlight: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check update: %w", err)
	}
	if n == 0 {
		return fmt.Errorf("highlight not found")
	}
	return nil
}

// DeleteUserHighlight deletes a user-defined highlight if it belongs to the user.
func DeleteUserHighlight(userId uint, id int) error {
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return fmt.Errorf("database is not available")
	}
	res, err := ModelsRepo.DB.Conn.Exec(
		"DELETE FROM highlights WHERE id = ? AND user_id = ?",
		id, userId,
	)
	if err != nil {
		return fmt.Errorf("failed to delete highlight: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check delete: %w", err)
	}
	if n == 0 {
		return fmt.Errorf("highlight not found")
	}
	return nil
}

// markdownLinkPattern matches markdown links [text](url).
var markdownLinkPattern = regexp.MustCompile(`\[([^\]]+)\]\([^)]+\)`)

// sanitizeImagePrompt strips markdown links and truncates chapter text so it fits
// within the image model's prompt limits. URLs in markdown links are removed, leaving
// only the link text, which keeps the prompt clean and avoids API connection issues.
func sanitizeImagePrompt(text string, maxLen int) string {
	// remove markdown links, keeping only the link text
	text = markdownLinkPattern.ReplaceAllString(text, "$1")
	// collapse multiple spaces/newlines
	text = strings.Join(strings.Fields(text), " ")
	// truncate by runes so we never split a multi-byte character
	runes := []rune(text)
	if len(runes) > maxLen {
		runes = runes[:maxLen]
	}
	return strings.TrimSpace(string(runes))
}

/**************************************************************************************
* GenerateChapterImage creates a summarizing image for a single chapter using the
* image model, fed with the chapter's content. The image is written to the images
* folder of the topic with a numeric prefix reflecting generation order, and an image
* reference is inserted into the chapter file right below its title.
**************************************************************************************/
func (r *Research) GenerateChapterImage(chapter string) error {
	folder := r.folderPath()
	chapterFile := chapterFileByTitle(folder, chapter)

	content, err := os.ReadFile(chapterFile)
	if err != nil {
		return fmt.Errorf("chapter not found: %w", err)
	}

	// ask the image model for a summarizing image of this chapter. The image model
	// prompt has a length limit, so keep the chapter content to a reasonable size and
	// strip markdown links so the prompt does not include URLs.
	const maxImagePromptLength = 2000
	chapterText := sanitizeImagePrompt(string(content), maxImagePromptLength)
	userPrompt := "Please create a summarizing image for the following chapter:\n\n" + chapterText
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
	imageRef := webDataPath(filepath.Join(folder, imagesDirName, fileName))
	return insertImageReference(chapterFile, chapter, imageRef)
}

/**************************************************************************************
* GenerateCoverImage asks the completions model to craft a description for a cover
* image, saves that description to the database, then asks the image model to create
* the 1024x1024 cover image. The generated image is stored in the topic folder and its
* path is saved to the database.
**************************************************************************************/
func (r *Research) GenerateCoverImage() error {
	if len(r.Chapters) == 0 {
		return nil
	}

	folder := r.folderPath()
	title := utils.SanitizeFilename(r.Title)
	if strings.TrimSpace(title) == "" {
		title = utils.SanitizeFilename(r.Topic)
	}

	// notify the UI that we are crafting the cover image description
	if r.OnCoverImage != nil {
		r.OnCoverImage("description", "")
	}

	description, err := r.generateCoverImageDescription(title)
	if err != nil {
		return err
	}

	if err := r.SaveCoverImageDescription(title, description); err != nil {
		return fmt.Errorf("failed to save cover image description: %w", err)
	}

	if r.OnCoverImage != nil {
		r.OnCoverImage("description", description)
	}

	if r.OnCoverImage != nil {
		r.OnCoverImage("image", "")
	}

	imageBytes, err := lib.NewOpenAIService().GenerateImage(coverImageSystemPrompt, description)
	if err != nil {
		return err
	}

	imagesDir := filepath.Join(folder, imagesDirName)
	if err := os.MkdirAll(imagesDir, 0755); err != nil {
		return fmt.Errorf("failed to create images folder: %w", err)
	}

	// Use a unique prefix so regenerating the cover image keeps the previous file.
	prefix := nextImagePrefix(imagesDir)
	fileName := fmt.Sprintf("%d-cover.png", prefix)
	imagePath := filepath.Join(imagesDir, fileName)
	if err := os.WriteFile(imagePath, imageBytes, 0644); err != nil {
		return fmt.Errorf("failed to write cover image file: %w", err)
	}

	webPath := webDataPath(imagePath)
	if err := r.SaveCoverImagePath(title, webPath); err != nil {
		return fmt.Errorf("failed to save cover image path: %w", err)
	}

	if r.OnCoverImage != nil {
		r.OnCoverImage("done", webPath)
	}

	return nil
}

/**************************************************************************************
* GenerateCoverImageForCourse creates a fresh cover image for an existing course. The
* chapter list is read from the persisted chapters file. Any previous cover image file
* is left untouched; the new image is written with a unique prefix.
**************************************************************************************/
func GenerateCoverImageForCourse(userId uint, title string) (string, error) {
	r := &Research{
		UserID: userId,
		Title:  title,
		Topic:  title,
	}

	chapters, err := r.ReadChapters()
	if err != nil {
		return "", fmt.Errorf("could not read course chapters: %w", err)
	}
	r.Chapters = chapters

	if err := r.GenerateCoverImage(); err != nil {
		return "", err
	}

	return GetCoverImagePath(userId, title), nil
}

/**************************************************************************************
* generateCoverImageDescription asks the completions model to craft a prompt suitable
* for an image generation model, given the course title and chapter list.
**************************************************************************************/
func (r *Research) generateCoverImageDescription(title string) (string, error) {
	userPrompt := fmt.Sprintf(
		`The user is a researcher that is investigating the following topic: %s.
		The following are the chapters of a course he has enrolled in: %s.
		Based on this, create a description that can be sent to an image generation model to create the cover image for a blog post in dimensions 1024 x 1024.`,
		title, strings.Join(r.Chapters, ", "),
	)

	service := lib.NewOpenAIService()
	description, err := service.Ask(coverImageDescriptionPrompt, userPrompt)
	if err != nil {
		return "", fmt.Errorf("failed to generate cover image description: %w", err)
	}

	return strings.TrimSpace(description), nil
}

/**************************************************************************************
* SaveCoverImageDescription stores the generated cover image description in the
* courses table, creating the row if it does not already exist.
**************************************************************************************/
func (r *Research) SaveCoverImageDescription(title, description string) error {
	query := `
		INSERT INTO courses (user_id, title, cover_image_description)
		VALUES (?, ?, ?)
		ON CONFLICT(user_id, title) DO UPDATE SET
			cover_image_description = excluded.cover_image_description,
			updated_at = CURRENT_TIMESTAMP
	`
	_, err := ModelsRepo.DB.Conn.Exec(query, r.UserID, title, description)
	return err
}

/**************************************************************************************
* SaveCoverImagePath stores the generated cover image path in the courses table,
* creating the row if it does not already exist.
**************************************************************************************/
func (r *Research) SaveCoverImagePath(title, path string) error {
	query := `
		INSERT INTO courses (user_id, title, cover_image_path)
		VALUES (?, ?, ?)
		ON CONFLICT(user_id, title) DO UPDATE SET
			cover_image_path = excluded.cover_image_path,
			updated_at = CURRENT_TIMESTAMP
	`
	_, err := ModelsRepo.DB.Conn.Exec(query, r.UserID, title, path)
	return err
}

/**************************************************************************************
* GetReadChapters returns the zero-based indices of chapters that have been marked as
* read for a given course by a given user.
**************************************************************************************/
func GetReadChapters(userId uint, courseTitle string) ([]int, error) {
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return []int{}, nil
	}
	rows, err := ModelsRepo.DB.Conn.Query(
		"SELECT chapter_index FROM reading_progress WHERE user_id = ? AND course_title = ? AND read = 1 ORDER BY chapter_index",
		userId, courseTitle,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	chapters := []int{}
	for rows.Next() {
		var chapter int
		if err := rows.Scan(&chapter); err != nil {
			return nil, err
		}
		chapters = append(chapters, chapter)
	}
	return chapters, nil
}

/**************************************************************************************
* SaveReadingProgress marks a chapter as read or unread for a given user's course and
* updates the course's completed_at timestamp when all chapters are read.
**************************************************************************************/
func SaveReadingProgress(userId uint, courseTitle string, chapterIndex int, read bool) error {
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return fmt.Errorf("database is not available")
	}
	query := `
		INSERT INTO reading_progress (user_id, course_title, chapter_index, read)
		VALUES (?, ?, ?, ?)
		ON CONFLICT(user_id, course_title, chapter_index) DO UPDATE SET
			read = excluded.read,
			updated_at = CURRENT_TIMESTAMP
	`
	readFlag := 0
	if read {
		readFlag = 1
	}
	if _, err := ModelsRepo.DB.Conn.Exec(query, userId, courseTitle, chapterIndex, readFlag); err != nil {
		return err
	}

	// Update the course completion timestamp based on the current reading state.
	folder := filepath.Join(utils.ContentDir(), fmt.Sprintf("user_%d", userId), utils.SanitizeFilename(courseTitle))
	total := countChapters(folder)

	var readCount int
	err := ModelsRepo.DB.Conn.QueryRow(
		"SELECT COUNT(*) FROM reading_progress WHERE user_id = ? AND course_title = ? AND read = 1",
		userId, courseTitle,
	).Scan(&readCount)
	if err != nil {
		return err
	}

	isComplete := total > 0 && readCount == total
	if isComplete {
		_, err = ModelsRepo.DB.Conn.Exec(
			"UPDATE courses SET completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP) WHERE user_id = ? AND title = ?",
			userId, courseTitle,
		)
	} else {
		_, err = ModelsRepo.DB.Conn.Exec(
			"UPDATE courses SET completed_at = NULL WHERE user_id = ? AND title = ?",
			userId, courseTitle,
		)
	}
	return err
}

/**************************************************************************************
* countChapters reads the chapters file for a course and returns the number of chapters.
**************************************************************************************/
func countChapters(folder string) int {
	data, err := os.ReadFile(filepath.Join(folder, chaptersFileName))
	if err != nil {
		return 0
	}
	count := 0
	for _, line := range strings.Split(string(data), "\n") {
		if strings.TrimSpace(line) != "" {
			count++
		}
	}
	return count
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
* webDataPath turns an absolute filesystem path under ContentDir into a web-absolute
* path that is served by the /data/ static route. The result is URL-encoded per path
* segment so spaces and special characters remain valid.
**************************************************************************************/
func webDataPath(absPath string) string {
	absPath = filepath.Clean(absPath)
	contentDir := filepath.Clean(utils.ContentDir())

	rel, err := filepath.Rel(contentDir, absPath)
	if err != nil || strings.HasPrefix(rel, "..") {
		// Fallback: if the path is not under ContentDir, encode it as-is with a single
		// leading slash and avoid the double-slash that an absolute path would create.
		p := strings.TrimPrefix(absPath, "/")
		return "/" + encodePathSegments(filepath.ToSlash(p))
	}

	return "/" + encodePathSegments(filepath.ToSlash(filepath.Join("data", rel)))
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
