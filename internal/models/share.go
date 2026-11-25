package models

import (
	"database/sql"
	"fmt"
	"strings"
	"time"
)

// SharedCourse is the public, read-only view of a lesson exposed through a
// share link. It carries what the shared page renders: the assembled markdown
// content, cover image, language, course-wide notes, the owner's highlights and
// the highlight styles needed to color them. Access describes the viewer's
// relationship to the lesson: "anonymous" without a valid auth token, "owner"
// or "collaborator" for users who can already open the lesson, and "shared" for
// authenticated users who only have the public link.
type SharedCourse struct {
	Title          string            `json:"title"`
	Content        string            `json:"content"`
	Bibliography   string            `json:"bibliography"`
	CoverImagePath string            `json:"coverImagePath"`
	Language       string            `json:"language"`
	Notes          []SharedNote      `json:"notes"`
	Highlights     []SharedHighlight `json:"highlights"`
	UserHighlights []UserHighlight   `json:"userHighlights"`
	Access         string            `json:"access"`
	Owner          string            `json:"owner"`
	// Chapters lists the declared chapter titles in order and Imported reports
	// whether the lesson came from a source import; the lesson view uses them
	// to tell chapter headings apart from structural source headings.
	Chapters []string `json:"chapters"`
	Imported bool     `json:"imported"`
}

// SharedNote is the public view of a note attached to a shared lesson.
type SharedNote struct {
	Body         string    `json:"body"`
	UpdatedAt    time.Time `json:"updatedAt"`
	Author       string    `json:"author"`
	AuthorAvatar string    `json:"authorAvatar"`
}

// SharedHighlight is the public view of an owner's text highlight on a shared
// lesson, enriched with the style fields the reader needs to render it.
type SharedHighlight struct {
	HighlightID int    `json:"highlightId"`
	Chapter     string `json:"chapter"`
	Text        string `json:"text"`
	Note        string `json:"note"`
	Color       string `json:"color"`
	Label       string `json:"label"`
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
func GetSharedCourse(token string, viewer *AuthUser) (*SharedCourse, error) {
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return nil, fmt.Errorf("database is not available")
	}
	token = strings.TrimSpace(token)
	if token == "" {
		return nil, fmt.Errorf("share link not found")
	}

	var (
		courseID      int
		ownerID       uint
		title         string
		cover         sql.NullString
		lang          sql.NullString
		ownerUsername string
	)
	err := ModelsRepo.DB.Conn.QueryRow(`
		SELECT c.id, c.user_id, c.title, c.cover_image_path, c.language, u.username
		FROM courses c
		JOIN users u ON u.id = c.user_id
		WHERE c.share_token = ?
	`, token).Scan(&courseID, &ownerID, &title, &cover, &lang, &ownerUsername)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("this share link is invalid or has been disabled")
	}
	if err != nil {
		return nil, fmt.Errorf("failed to load shared lesson: %w", err)
	}

	research := Research{UserID: ownerID, Title: title}
	content, err := research.ReadContent()
	if err != nil {
		return nil, fmt.Errorf("failed to load shared lesson content: %w", err)
	}
	bibliography, err := research.ReadBibliography()
	if err != nil {
		return nil, fmt.Errorf("failed to load shared lesson bibliography: %w", err)
	}

	access := "anonymous"
	if viewer != nil {
		access = "shared"
		if viewer.Id == ownerID {
			access = "owner"
		} else {
			var collaboratorStatus string
			err := ModelsRepo.DB.Conn.QueryRow(
				"SELECT status FROM course_collaborators WHERE course_id = ? AND user_id = ?",
				courseID, viewer.Id,
			).Scan(&collaboratorStatus)
			if err == nil && collaboratorStatus == "accepted" {
				access = "collaborator"
			} else if err != nil && err != sql.ErrNoRows {
				return nil, fmt.Errorf("failed to resolve shared lesson access: %w", err)
			}
		}
	}

	shared := &SharedCourse{
		Title:          title,
		Content:        content,
		Bibliography:   bibliography,
		Notes:          []SharedNote{},
		Highlights:     []SharedHighlight{},
		UserHighlights: []UserHighlight{},
		Access:         access,
		Owner:          ownerUsername,
		Chapters:       research.ChapterTitles(),
		Imported:       research.IsImported(),
	}
	if cover.Valid {
		shared.CoverImagePath = cover.String
	}
	if lang.Valid {
		shared.Language = lang.String
	}

	// Notes are course-wide: the shared page shows every participant's notes,
	// each with its author's username and avatar.
	if notes, err := GetCourseNotesWithAuthors(courseID); err == nil {
		for _, n := range notes {
			shared.Notes = append(shared.Notes, SharedNote{
				Body:         n.Body,
				UpdatedAt:    n.UpdatedAt,
				Author:       n.AuthorUsername,
				AuthorAvatar: n.AuthorAvatar,
			})
		}
	}

	// Highlights on a shared lesson are the owner's highlights, enriched with the
	// owner's highlight styles so the shared page renders them exactly like the
	// lesson page does.
	highlightRows, err := ModelsRepo.DB.Conn.Query(`
		SELECT ch.highlight_id, ch.chapter, ch.text, COALESCE(ch.note, ''), h.color, h.label
		FROM course_highlights ch
		JOIN highlights h ON h.id = ch.highlight_id
		WHERE ch.user_id = ? AND ch.course_id = ?
		ORDER BY ch.created_at
	`, ownerID, courseID)
	if err != nil {
		return nil, fmt.Errorf("failed to load shared lesson highlights: %w", err)
	}
	defer highlightRows.Close()

	for highlightRows.Next() {
		var h SharedHighlight
		if err := highlightRows.Scan(&h.HighlightID, &h.Chapter, &h.Text, &h.Note, &h.Color, &h.Label); err != nil {
			return nil, fmt.Errorf("failed to scan shared lesson highlight: %w", err)
		}
		shared.Highlights = append(shared.Highlights, h)
	}

	if userHighlights, err := ListUserHighlights(ownerID); err == nil {
		shared.UserHighlights = userHighlights
	}

	return shared, nil
}
