package models

import (
	"database/sql"
	"fmt"
	"time"

	"zapohteh/internal/utils"
)

// CourseDB represents a single course row in the database.
type CourseDB struct {
	ID                      int        `json:"id"`
	UserID                  uint       `json:"userId"`
	Title                   string     `json:"title"`
	Description             *string    `json:"description"`
	CoverImageDescription   *string    `json:"coverImageDescription"`
	CoverImagePath          *string    `json:"coverImagePath"`
	CreatedAt               time.Time  `json:"createdAt"`
	UpdatedAt               time.Time  `json:"updatedAt"`
	CompletedAt             *time.Time `json:"completedAt"`
}

// EnsureCourse creates a course row for a user if it does not already exist and
// returns the course id.
func EnsureCourse(userId uint, title string) (int, error) {
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return 0, fmt.Errorf("database is not available")
	}
	res, err := ModelsRepo.DB.Conn.Exec(
		"INSERT OR IGNORE INTO courses (user_id, title) VALUES (?, ?)",
		userId, title,
	)
	if err != nil {
		return 0, fmt.Errorf("could not ensure course: %w", err)
	}
	if id, err := res.LastInsertId(); err == nil && id > 0 {
		return int(id), nil
	}
	var id int
	err = ModelsRepo.DB.Conn.QueryRow(
		"SELECT id FROM courses WHERE user_id = ? AND title = ?",
		userId, title,
	).Scan(&id)
	if err != nil {
		return 0, fmt.Errorf("could not retrieve course id: %w", err)
	}
	return id, nil
}

// GetCourseID returns the id of a course for a user and title, creating it if needed.
func GetCourseID(userId uint, title string) (int, error) {
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return 0, fmt.Errorf("database is not available")
	}
	var id int
	err := ModelsRepo.DB.Conn.QueryRow(
		"SELECT id FROM courses WHERE user_id = ? AND title = ?",
		userId, title,
	).Scan(&id)
	if err == nil {
		return id, nil
	}
	if err == sql.ErrNoRows {
		return EnsureCourse(userId, title)
	}
	return 0, fmt.Errorf("could not get course id: %w", err)
}

// SetCourseSubjects replaces the subjects linked to a user's course with the given ids.
func SetCourseSubjects(userId uint, courseTitle string, subjectIDs []int) error {
	courseId, err := GetCourseID(userId, courseTitle)
	if err != nil {
		return err
	}
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return fmt.Errorf("database is not available")
	}
	tx, err := ModelsRepo.DB.Conn.Begin()
	if err != nil {
		return err
	}
	if _, err := tx.Exec("DELETE FROM course_subjects WHERE course_id = ?", courseId); err != nil {
		tx.Rollback()
		return err
	}
	for _, id := range subjectIDs {
		if _, err := tx.Exec(
			"INSERT INTO course_subjects (course_id, subject_id) VALUES (?, ?)",
			courseId, id,
		); err != nil {
			tx.Rollback()
			return err
		}
	}
	return tx.Commit()
}

// GetCourseSubjects returns the subjects attached to a user's course.
func GetCourseSubjects(userId uint, courseTitle string) ([]Subject, error) {
	courseId, err := GetCourseID(userId, courseTitle)
	if err != nil {
		return []Subject{}, err
	}
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return []Subject{}, nil
	}
	rows, err := ModelsRepo.DB.Conn.Query(`
		SELECT s.id, s.name, s.description, s.color
		FROM subjects s
		JOIN course_subjects cs ON cs.subject_id = s.id
		WHERE cs.course_id = ?
		ORDER BY s.name
	`, courseId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	subjects := []Subject{}
	for rows.Next() {
		var s Subject
		if err := rows.Scan(&s.ID, &s.Name, &s.Description, &s.Color); err != nil {
			return nil, err
		}
		subjects = append(subjects, s)
	}
	return subjects, nil
}

// SubjectColorMap returns a map of course title -> list of subjects for every course
// that has at least one subject attached, scoped to the given user.
func SubjectColorMap(userId uint) (map[string][]Subject, error) {
	m := make(map[string][]Subject)
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return m, nil
	}
	rows, err := ModelsRepo.DB.Conn.Query(`
		SELECT c.title, s.id, s.name, s.description, s.color
		FROM course_subjects cs
		JOIN courses c ON c.id = cs.course_id
		JOIN subjects s ON s.id = cs.subject_id
		WHERE c.user_id = ?
		ORDER BY c.title, s.name
	`, userId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var courseTitle string
		var s Subject
		if err := rows.Scan(&courseTitle, &s.ID, &s.Name, &s.Description, &s.Color); err != nil {
			return nil, err
		}
		key := utils.SanitizeFilename(courseTitle)
		m[key] = append(m[key], s)
	}
	return m, nil
}
