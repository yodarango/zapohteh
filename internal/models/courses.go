package models

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"
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

// SaveCourseLanguage stores the language selected for a course, creating the
// course row if it does not already exist.
func SaveCourseLanguage(userId uint, title, language string) error {
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return fmt.Errorf("database is not available")
	}
	query := `
		INSERT INTO courses (user_id, title, language)
		VALUES (?, ?, ?)
		ON CONFLICT(user_id, title) DO UPDATE SET
			language = excluded.language,
			updated_at = CURRENT_TIMESTAMP
	`
	_, err := ModelsRepo.DB.Conn.Exec(query, userId, title, language)
	return err
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

// GetCourseLanguage returns the stored language for a user's course, or an empty
// string when none has been saved.
func GetCourseLanguage(userId uint, title string) string {
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return ""
	}
	var lang sql.NullString
	err := ModelsRepo.DB.Conn.QueryRow(
		"SELECT language FROM courses WHERE user_id = ? AND title = ?",
		userId, title,
	).Scan(&lang)
	if err != nil || !lang.Valid {
		return ""
	}
	return lang.String
}

// DeleteCourse removes a user's course from the database and deletes its content
// folder. Related course_subjects and chat_messages rows are removed automatically
// via ON DELETE CASCADE. The reading_progress rows are cleaned up explicitly.
func DeleteCourse(userId uint, title string) error {
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return fmt.Errorf("database is not available")
	}

	// Remove the course content folder first so the lesson disappears even if the
	// database row is missing or partially created.
	folder := filepath.Join(utils.ContentDir(), fmt.Sprintf("user_%d", userId), utils.SanitizeFilename(title))
	if err := os.RemoveAll(folder); err != nil {
		return fmt.Errorf("failed to delete course folder: %w", err)
	}

	// Delete the course row. Related course_subjects and chat_messages rows are
	// removed via ON DELETE CASCADE.
	_, err := ModelsRepo.DB.Conn.Exec(
		"DELETE FROM courses WHERE user_id = ? AND title = ?",
		userId, title,
	)
	if err != nil {
		return fmt.Errorf("failed to delete course from database: %w", err)
	}

	// reading_progress uses the course title, so clean it up explicitly.
	_, _ = ModelsRepo.DB.Conn.Exec(
		"DELETE FROM reading_progress WHERE user_id = ? AND course_title = ?",
		userId, title,
	)

	return nil
}

// UpdateCourse updates a course's title, language, and subjects. If the title
// changes, the course folder is renamed and image references are updated to match.
func UpdateCourse(userId uint, oldTitle, newTitle, language string, subjectIDs []int) (string, error) {
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return "", fmt.Errorf("database is not available")
	}

	oldTitle = utils.SanitizeFilename(oldTitle)
	newTitle = utils.SanitizeFilename(newTitle)

	if oldTitle == "" || newTitle == "" {
		return "", fmt.Errorf("course title is required")
	}

	tx, err := ModelsRepo.DB.Conn.Begin()
	if err != nil {
		return "", err
	}

	var courseId int
	err = tx.QueryRow(
		"SELECT id FROM courses WHERE user_id = ? AND title = ?",
		userId, oldTitle,
	).Scan(&courseId)
	if err != nil {
		tx.Rollback()
		return "", fmt.Errorf("course not found: %w", err)
	}

	_, err = tx.Exec(
		"UPDATE courses SET title = ?, language = ? WHERE id = ?",
		newTitle, language, courseId,
	)
	if err != nil {
		tx.Rollback()
		return "", fmt.Errorf("failed to update course: %w", err)
	}

	_, err = tx.Exec("DELETE FROM course_subjects WHERE course_id = ?", courseId)
	if err != nil {
		tx.Rollback()
		return "", fmt.Errorf("failed to update subjects: %w", err)
	}
	for _, id := range subjectIDs {
		_, err = tx.Exec(
			"INSERT INTO course_subjects (course_id, subject_id) VALUES (?, ?)",
			courseId, id,
		)
		if err != nil {
			tx.Rollback()
			return "", fmt.Errorf("failed to add subject: %w", err)
		}
	}

	_, err = tx.Exec(
		"UPDATE reading_progress SET course_title = ? WHERE user_id = ? AND course_title = ?",
		newTitle, userId, oldTitle,
	)
	if err != nil {
		tx.Rollback()
		return "", fmt.Errorf("failed to update reading progress: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return "", fmt.Errorf("failed to commit course update: %w", err)
	}

	if oldTitle != newTitle {
		userDir := filepath.Join(utils.ContentDir(), fmt.Sprintf("user_%d", userId))
		oldFolder := filepath.Join(userDir, oldTitle)
		newFolder := filepath.Join(userDir, newTitle)

		if err := os.Rename(oldFolder, newFolder); err != nil {
			return "", fmt.Errorf("failed to rename course folder: %w", err)
		}

		oldEncoded := encodePathSegments(oldTitle)
		newEncoded := encodePathSegments(newTitle)

		_, _ = ModelsRepo.DB.Conn.Exec(
			"UPDATE courses SET cover_image_path = REPLACE(cover_image_path, ?, ?) WHERE id = ?",
			oldEncoded, newEncoded, courseId,
		)

		if err := updateFolderReferences(newFolder, oldEncoded, newEncoded); err != nil {
			return "", fmt.Errorf("failed to update image references: %w", err)
		}
	}

	return newTitle, nil
}

// updateFolderReferences replaces an old encoded folder name with a new one in all
// markdown files under the given folder.
func updateFolderReferences(folder, oldEncoded, newEncoded string) error {
	entries, err := os.ReadDir(folder)
	if err != nil {
		return err
	}
	for _, entry := range entries {
		if entry.IsDir() {
			if err := updateFolderReferences(filepath.Join(folder, entry.Name()), oldEncoded, newEncoded); err != nil {
				return err
			}
			continue
		}
		if !strings.HasSuffix(entry.Name(), ".md") {
			continue
		}
		filePath := filepath.Join(folder, entry.Name())
		data, err := os.ReadFile(filePath)
		if err != nil {
			return err
		}
		content := string(data)
		newContent := strings.ReplaceAll(content, oldEncoded, newEncoded)
		if newContent == content {
			continue
		}
		if err := os.WriteFile(filePath, []byte(newContent), 0644); err != nil {
			return err
		}
	}
	return nil
}
