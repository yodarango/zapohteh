package models

import (
	"database/sql"
	"fmt"
	"strings"
	"time"
)

// SharedCourse is the public, read-only view of a lesson exposed through a
// share link. It carries only what the public page renders: the assembled
// markdown content, the cover image, the language and the course notes.
type SharedCourse struct {
	Title          string       `json:"title"`
	Content        string       `json:"content"`
	CoverImagePath string       `json:"coverImagePath"`
	Language       string       `json:"language"`
	Notes          []SharedNote `json:"notes"`
}

// SharedNote is the public view of a note attached to a shared lesson.
type SharedNote struct {
	Body      string    `json:"body"`
	UpdatedAt time.Time `json:"updatedAt"`
	Author    string    `json:"author"`
}

/**************************************************************************************
* EnableCourseShare returns the public share token for a course, generating one on
* first use. Calling it again returns the same token so the link stays stable.
**************************************************************************************/
func EnableCourseShare(userId uint, title string) (string, error) {
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return "", fmt.Errorf("database is not available")
	}

	var existing sql.NullString
	err := ModelsRepo.DB.Conn.QueryRow(
		"SELECT share_token FROM courses WHERE user_id = ? AND title = ?",
		userId, title,
	).Scan(&existing)
	if err != nil && err != sql.ErrNoRows {
		return "", fmt.Errorf("failed to read share state: %w", err)
	}
	if existing.Valid && existing.String != "" {
		return existing.String, nil
	}

	token := generateRequestID()
	_, err = ModelsRepo.DB.Conn.Exec(`
		INSERT INTO courses (user_id, title, share_token)
		VALUES (?, ?, ?)
		ON CONFLICT(user_id, title) DO UPDATE SET
			share_token = excluded.share_token,
			updated_at = CURRENT_TIMESTAMP
	`, userId, title, token)
	if err != nil {
		return "", fmt.Errorf("failed to enable sharing: %w", err)
	}
	return token, nil
}

/**************************************************************************************
* DisableCourseShare removes the public share token of a course, disabling its link.
**************************************************************************************/
func DisableCourseShare(userId uint, title string) error {
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return fmt.Errorf("database is not available")
	}
	_, err := ModelsRepo.DB.Conn.Exec(
		"UPDATE courses SET share_token = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND title = ?",
		userId, title,
	)
	return err
}

/**************************************************************************************
* GetCourseShareToken returns the current share token of a course, or an empty
* string when the course is not shared.
**************************************************************************************/
func GetCourseShareToken(userId uint, title string) string {
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return ""
	}
	var token sql.NullString
	err := ModelsRepo.DB.Conn.QueryRow(
		"SELECT share_token FROM courses WHERE user_id = ? AND title = ?",
		userId, title,
	).Scan(&token)
	if err != nil || !token.Valid {
		return ""
	}
	return token.String
}

/**************************************************************************************
* GetSharedCourse returns the public view of a shared lesson for a share link
* token: the assembled markdown content, the cover image, the language and the
* course notes. It fails when the token does not match any shared course.
**************************************************************************************/
func GetSharedCourse(token string) (*SharedCourse, error) {
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return nil, fmt.Errorf("database is not available")
	}
	token = strings.TrimSpace(token)
	if token == "" {
		return nil, fmt.Errorf("share link not found")
	}

	var (
		courseID int
		userID   uint
		title    string
		cover    sql.NullString
		lang     sql.NullString
	)
	err := ModelsRepo.DB.Conn.QueryRow(
		"SELECT id, user_id, title, cover_image_path, language FROM courses WHERE share_token = ?",
		token,
	).Scan(&courseID, &userID, &title, &cover, &lang)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("this share link is invalid or has been disabled")
	}
	if err != nil {
		return nil, fmt.Errorf("failed to load shared lesson: %w", err)
	}

	research := Research{UserID: userID, Title: title}
	content, err := research.ReadContent()
	if err != nil {
		return nil, fmt.Errorf("failed to load shared lesson content: %w", err)
	}

	shared := &SharedCourse{Title: title, Content: content, Notes: []SharedNote{}}
	if cover.Valid {
		shared.CoverImagePath = cover.String
	}
	if lang.Valid {
		shared.Language = lang.String
	}

	// Notes are course-wide: the public page shows every participant's notes,
	// each with its author's username.
	if notes, err := GetCourseNotesWithAuthors(courseID); err == nil {
		for _, n := range notes {
			shared.Notes = append(shared.Notes, SharedNote{Body: n.Body, UpdatedAt: n.UpdatedAt, Author: n.AuthorUsername})
		}
	}
	return shared, nil
}
