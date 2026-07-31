package models

import (
	"fmt"
	"time"
)

// Sticky represents a draggable, resizable note attached to a course.
type Sticky struct {
	ID        int       `json:"id"`
	UserID    uint      `json:"userId"`
	CourseID  int       `json:"courseId"`
	Content   string    `json:"content"`
	X         int       `json:"x"`
	Y         int       `json:"y"`
	Width     int       `json:"width"`
	Height    int       `json:"height"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// GetStickiesByCourse returns all stickies for a user and course title.
func GetStickiesByCourse(userId uint, courseTitle string) ([]Sticky, error) {
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return nil, fmt.Errorf("database is not available")
	}
	rows, err := ModelsRepo.DB.Conn.Query(`
		SELECT s.id, s.user_id, s.course_id, s.content, s.x, s.y, s.width, s.height, s.created_at, s.updated_at
		FROM stickies s
		JOIN courses c ON c.id = s.course_id
		WHERE s.user_id = ? AND c.title = ?
		ORDER BY s.updated_at DESC
	`, userId, courseTitle)
	if err != nil {
		return nil, fmt.Errorf("failed to load stickies: %w", err)
	}
	defer rows.Close()

	var stickies []Sticky
	for rows.Next() {
		var s Sticky
		if err := rows.Scan(&s.ID, &s.UserID, &s.CourseID, &s.Content, &s.X, &s.Y, &s.Width, &s.Height, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan sticky: %w", err)
		}
		stickies = append(stickies, s)
	}
	return stickies, nil
}

// CreateSticky inserts a new sticky note.
func CreateSticky(userId uint, courseTitle string, sticky Sticky) (int, error) {
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return 0, fmt.Errorf("database is not available")
	}
	courseId, err := GetCourseID(userId, courseTitle)
	if err != nil {
		return 0, err
	}
	res, err := ModelsRepo.DB.Conn.Exec(`
		INSERT INTO stickies (user_id, course_id, content, x, y, width, height)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, userId, courseId, sticky.Content, sticky.X, sticky.Y, sticky.Width, sticky.Height)
	if err != nil {
		return 0, fmt.Errorf("failed to create sticky: %w", err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("failed to get sticky id: %w", err)
	}
	return int(id), nil
}

// UpdateSticky updates an existing sticky note owned by the user.
func UpdateSticky(userId uint, stickyID int, sticky Sticky) error {
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return fmt.Errorf("database is not available")
	}
	res, err := ModelsRepo.DB.Conn.Exec(`
		UPDATE stickies SET content = ?, x = ?, y = ?, width = ?, height = ?
		WHERE id = ? AND user_id = ?
	`, sticky.Content, sticky.X, sticky.Y, sticky.Width, sticky.Height, stickyID, userId)
	if err != nil {
		return fmt.Errorf("failed to update sticky: %w", err)
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check sticky update: %w", err)
	}
	if affected == 0 {
		return fmt.Errorf("sticky not found or not owned by user")
	}
	return nil
}

// DeleteSticky removes a sticky note owned by the user.
func DeleteSticky(userId uint, stickyID int) error {
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return fmt.Errorf("database is not available")
	}
	res, err := ModelsRepo.DB.Conn.Exec(`
		DELETE FROM stickies WHERE id = ? AND user_id = ?
	`, stickyID, userId)
	if err != nil {
		return fmt.Errorf("failed to delete sticky: %w", err)
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check sticky deletion: %w", err)
	}
	if affected == 0 {
		return fmt.Errorf("sticky not found or not owned by user")
	}
	return nil
}
