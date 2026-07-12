package models

import (
	"fmt"
	"strings"
	"time"

	"zapohteh/internal/lib"
)

// ChatMessage represents a single message in a lesson chat thread.
type ChatMessage struct {
	ID        int       `json:"id"`
	UserID    uint      `json:"userId"`
	CourseID  int       `json:"courseId"`
	Chapter   string    `json:"chapter"`
	Role      string    `json:"role"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"createdAt"`
}

// Create inserts a new chat message into the database.
func (c *ChatMessage) Create() error {
	query := `
		INSERT INTO chat_messages (user_id, course_id, chapter, role, content)
		VALUES (?, ?, ?, ?, ?)
	`
	_, err := ModelsRepo.DB.Conn.Exec(query, c.UserID, c.CourseID, c.Chapter, c.Role, c.Content)
	if err != nil {
		return fmt.Errorf("could not save chat message: %w", err)
	}
	return nil
}

// GetChatMessagesByCourse returns every message for a user's course, ordered oldest first.
func GetChatMessagesByCourse(userId uint, courseTitle string) ([]ChatMessage, error) {
	courseId, err := GetCourseID(userId, courseTitle)
	if err != nil {
		return nil, err
	}
	query := `
		SELECT id, user_id, course_id, chapter, role, content, created_at
		FROM chat_messages
		WHERE user_id = ? AND course_id = ?
		ORDER BY created_at ASC
	`
	rows, err := ModelsRepo.DB.Conn.Query(query, userId, courseId)
	if err != nil {
		return nil, fmt.Errorf("could not load chat messages: %w", err)
	}
	defer rows.Close()

	messages := make([]ChatMessage, 0)
	for rows.Next() {
		var m ChatMessage
		if err := rows.Scan(&m.ID, &m.UserID, &m.CourseID, &m.Chapter, &m.Role, &m.Content, &m.CreatedAt); err != nil {
			return nil, fmt.Errorf("could not scan chat message: %w", err)
		}
		messages = append(messages, m)
	}
	return messages, nil
}

// GetChatMessagesByChapter returns the most recent messages for a specific chapter.
func GetChatMessagesByChapter(userId uint, courseId int, chapter, role string, limit int) ([]ChatMessage, error) {
	query := `
		SELECT id, user_id, course_id, chapter, role, content, created_at
		FROM chat_messages
		WHERE user_id = ? AND course_id = ? AND chapter = ? AND role = ?
		ORDER BY created_at DESC
		LIMIT ?
	`
	rows, err := ModelsRepo.DB.Conn.Query(query, userId, courseId, chapter, role, limit)
	if err != nil {
		return nil, fmt.Errorf("could not load chapter chat messages: %w", err)
	}
	defer rows.Close()

	messages := make([]ChatMessage, 0, limit)
	for rows.Next() {
		var m ChatMessage
		if err := rows.Scan(&m.ID, &m.UserID, &m.CourseID, &m.Chapter, &m.Role, &m.Content, &m.CreatedAt); err != nil {
			return nil, fmt.Errorf("could not scan chat message: %w", err)
		}
		messages = append(messages, m)
	}
	// reverse so the oldest of the selected set comes first
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}
	return messages, nil
}

// IsFirstChapterQuestion checks whether the user has already asked about this chapter.
func IsFirstChapterQuestion(userId uint, courseId int, chapter string) (bool, error) {
	var count int
	query := `
		SELECT COUNT(*)
		FROM chat_messages
		WHERE user_id = ? AND course_id = ? AND chapter = ? AND role = 'user'
	`
	err := ModelsRepo.DB.Conn.QueryRow(query, userId, courseId, chapter).Scan(&count)
	if err != nil {
		return false, fmt.Errorf("could not count chapter questions: %w", err)
	}
	return count <= 1, nil
}

// readCourseContent loads the assembled markdown for a user's course.
func readCourseContent(userId uint, course string) string {
	r := Research{Title: course, UserID: userId}
	content, err := r.ReadContent()
	if err != nil {
		return ""
	}
	return content
}

// parseCourseContent splits the markdown into a title and a map of chapter bodies.
func parseCourseContent(content string) (string, map[string]string) {
	chapters := make(map[string]string)
	parts := strings.Split(content, "\n## ")
	if len(parts) == 0 {
		return content, chapters
	}

	title := content
	firstLines := strings.SplitN(parts[0], "\n", 2)
	if strings.HasPrefix(firstLines[0], "# ") {
		title = strings.TrimPrefix(firstLines[0], "# ")
	}

	for _, part := range parts[1:] {
		lines := strings.SplitN(part, "\n\n", 2)
		if len(lines) != 2 {
			continue
		}
		chapters[strings.TrimSpace(lines[0])] = strings.TrimSpace(lines[1])
	}
	return strings.TrimSpace(title), chapters
}

// truncate shortens text to a maximum number of runes.
func truncate(text string, maxLen int) string {
	runes := []rune(text)
	if len(runes) <= maxLen {
		return text
	}
	return string(runes[:maxLen]) + "..."
}

// buildChatPrompt creates the system prompt and user prompt for the AI tutor.
func buildChatPrompt(userId uint, courseId int, courseTitle, chapter, question string) (string, string) {
	content := readCourseContent(userId, courseTitle)
	title, chapterMap := parseCourseContent(content)

	if chapter != "generic" {
		chapterBody, ok := chapterMap[chapter]
		if !ok {
			chapterBody = ""
		}

		first, err := IsFirstChapterQuestion(userId, courseId, chapter)
		if err != nil {
			first = true
		}

		if first {
			system := fmt.Sprintf(
				"You are a helpful tutor for the lesson \"%s\". The user is asking about the chapter \"%s\". Here is the chapter text:\n\n%s\n\nAnswer the user's question using the chapter.",
				title, chapter, truncate(chapterBody, 4000),
			)
			return system, question
		}

		users, _ := GetChatMessagesByChapter(userId, courseId, chapter, "user", 3)
		assistants, _ := GetChatMessagesByChapter(userId, courseId, chapter, "assistant", 3)

		var thread strings.Builder
		for _, m := range users {
			fmt.Fprintf(&thread, "User: %s\n", m.Content)
		}
		for _, m := range assistants {
			fmt.Fprintf(&thread, "AI: %s\n", m.Content)
		}

		system := fmt.Sprintf(
			"You are continuing a discussion about the chapter \"%s\" from the lesson \"%s\". Here is the recent conversation (most recent last):\n\n%s\n\nThe user is following up. Answer the next question while staying consistent with the chapter.",
			chapter, title, thread.String(),
		)
		return system, question
	}

	chapterTitles := make([]string, 0, len(chapterMap))
	for t := range chapterMap {
		chapterTitles = append(chapterTitles, t)
	}
	system := fmt.Sprintf(
		"You are a helpful tutor for the lesson \"%s\". The lesson covers these chapters: %s. The user's original lesson query was: %s. Answer general questions about the lesson.",
		title, strings.Join(chapterTitles, ", "), title,
	)
	return system, question
}

// AskChat saves the user's question, queries the AI, and returns the assistant's response.
func AskChat(userId uint, courseTitle, chapter, question string) (*ChatMessage, error) {
	courseId, err := GetCourseID(userId, courseTitle)
	if err != nil {
		return nil, err
	}

	userMsg := ChatMessage{
		UserID:   userId,
		CourseID: courseId,
		Chapter:  chapter,
		Role:     "user",
		Content:  question,
	}
	if err := userMsg.Create(); err != nil {
		return nil, err
	}

	systemPrompt, userPrompt := buildChatPrompt(userId, courseId, courseTitle, chapter, question)

	answer, err := lib.NewOpenAIService().Ask(systemPrompt, userPrompt)
	if err != nil {
		return nil, fmt.Errorf("AI request failed: %w", err)
	}

	assistantMsg := ChatMessage{
		UserID:   userId,
		CourseID: courseId,
		Chapter:  chapter,
		Role:     "assistant",
		Content:  answer,
	}
	if err := assistantMsg.Create(); err != nil {
		return nil, err
	}
	return &assistantMsg, nil
}
