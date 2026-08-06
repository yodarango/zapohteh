package models

import (
	"fmt"
	"time"
)

// Note represents a simple markdown note tied to a user and a course.
type Note struct {
	ID        int       `json:"id"`
	UserID    uint      `json:"userId"`
	CourseID  int       `json:"courseId"`
	Body      string    `json:"body"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// GetNotesByCourse returns all notes for a user and course title.
func GetNotesByCourse(userId uint, courseTitle string) ([]Note, error) {
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return nil, fmt.Errorf("database is not available")
	}
	rows, err := ModelsRepo.DB.Conn.Query(`
		SELECT n.id, n.user_id, n.course_id, n.body, n.created_at, n.updated_at
		FROM notes n
		JOIN courses c ON c.id = n.course_id
		WHERE n.user_id = ? AND c.title = ?
		ORDER BY n.updated_at DESC
	`, userId, courseTitle)
	if err != nil {
		return nil, fmt.Errorf("failed to load notes: %w", err)
	}
	defer rows.Close()

	var notes []Note
	for rows.Next() {
		var n Note
		if err := rows.Scan(&n.ID, &n.UserID, &n.CourseID, &n.Body, &n.CreatedAt, &n.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan note: %w", err)
		}
		notes = append(notes, n)
	}
	return notes, nil
}

// CreateNote inserts a new note.
func CreateNote(userId uint, courseTitle string, note Note) (int, error) {
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return 0, fmt.Errorf("database is not available")
	}
	courseId, err := GetCourseID(userId, courseTitle)
	if err != nil {
		return 0, err
	}
	res, err := ModelsRepo.DB.Conn.Exec(`
		INSERT INTO notes (user_id, course_id, body)
		VALUES (?, ?, ?)
	`, userId, courseId, note.Body)
	if err != nil {
		return 0, fmt.Errorf("failed to create note: %w", err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("failed to get note id: %w", err)
	}
	return int(id), nil
}

// UpdateNote updates an existing note owned by the user.
func UpdateNote(userId uint, noteID int, note Note) error {
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return fmt.Errorf("database is not available")
	}
	res, err := ModelsRepo.DB.Conn.Exec(`
		UPDATE notes SET body = ?
		WHERE id = ? AND user_id = ?
	`, note.Body, noteID, userId)
	if err != nil {
		return fmt.Errorf("failed to update note: %w", err)
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check note update: %w", err)
	}
	if affected == 0 {
		return fmt.Errorf("note not found or not owned by user")
	}
	return nil
}

// DeleteNote removes a note owned by the user.
func DeleteNote(userId uint, noteID int) error {
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return fmt.Errorf("database is not available")
	}
	res, err := ModelsRepo.DB.Conn.Exec(`
		DELETE FROM notes WHERE id = ? AND user_id = ?
	`, noteID, userId)
	if err != nil {
		return fmt.Errorf("failed to delete note: %w", err)
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check note deletion: %w", err)
	}
	if affected == 0 {
		return fmt.Errorf("note not found or not owned by user")
	}
	return nil
}
