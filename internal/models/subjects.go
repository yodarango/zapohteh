package models

import (
	"fmt"
	"goilerplate/internal/utils"
	"regexp"
	"strings"
)

/**************************************************************************************
* Subject represents a topic area that a course can be attached to.
**************************************************************************************/
type Subject struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Color       string `json:"color"`
}

var colorPattern = regexp.MustCompile(`^(#([0-9A-Fa-f]{3}){1,2}|rgb\([^)]+\)|rgba\([^)]+\)|cmyk\([^)]+\)|hsl\([^)]+\)|hsla\([^)]+\))$`)

/**************************************************************************************
* Validate checks that the subject has a name and a supported color format.
**************************************************************************************/
func (s *Subject) Validate() error {
	if strings.TrimSpace(s.Name) == "" {
		return fmt.Errorf("subject name is required")
	}
	if strings.TrimSpace(s.Color) == "" {
		return fmt.Errorf("subject color is required")
	}
	if !colorPattern.MatchString(strings.TrimSpace(s.Color)) {
		return fmt.Errorf("color must be in hex, rgb, cmyk, or hsl format")
	}
	return nil
}

/**************************************************************************************
* Create persists a new subject to the database.
**************************************************************************************/
func (s *Subject) Create() error {
	if err := s.Validate(); err != nil {
		return err
	}
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return fmt.Errorf("database is not available")
	}
	_, err := ModelsRepo.DB.Conn.Exec(
		"INSERT INTO subjects (name, description, color) VALUES (?, ?, ?)",
		strings.TrimSpace(s.Name),
		strings.TrimSpace(s.Description),
		strings.TrimSpace(s.Color),
	)
	return err
}

/**************************************************************************************
* ListSubjects returns every subject stored in the database.
**************************************************************************************/
func ListSubjects() ([]Subject, error) {
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return []Subject{}, nil
	}
	rows, err := ModelsRepo.DB.Conn.Query("SELECT id, name, description, color FROM subjects ORDER BY name")
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

/**************************************************************************************
* GetCourseSubjects returns the subjects attached to a course.
**************************************************************************************/
func GetCourseSubjects(courseTitle string) ([]Subject, error) {
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return []Subject{}, nil
	}
	rows, err := ModelsRepo.DB.Conn.Query(`
		SELECT s.id, s.name, s.description, s.color
		FROM subjects s
		JOIN course_subjects cs ON cs.subject_id = s.id
		WHERE cs.course_title = ?
		ORDER BY s.name
	`, courseTitle)
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

/**************************************************************************************
* SetCourseSubjects replaces the subject attachments for a course with the given
* subject ids.
**************************************************************************************/
func SetCourseSubjects(courseTitle string, subjectIDs []int) error {
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return fmt.Errorf("database is not available")
	}
	tx, err := ModelsRepo.DB.Conn.Begin()
	if err != nil {
		return err
	}
	if _, err := tx.Exec("DELETE FROM course_subjects WHERE course_title = ?", courseTitle); err != nil {
		tx.Rollback()
		return err
	}
	for _, id := range subjectIDs {
		if _, err := tx.Exec(
			"INSERT INTO course_subjects (course_title, subject_id) VALUES (?, ?)",
			courseTitle, id,
		); err != nil {
			tx.Rollback()
			return err
		}
	}
	return tx.Commit()
}

/**************************************************************************************
* SubjectColorMap returns a map of course title -> list of subjects for every course
* that has at least one subject attached.
**************************************************************************************/
func SubjectColorMap() (map[string][]Subject, error) {
	m := make(map[string][]Subject)
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return m, nil
	}
	rows, err := ModelsRepo.DB.Conn.Query(`
		SELECT cs.course_title, s.id, s.name, s.description, s.color
		FROM course_subjects cs
		JOIN subjects s ON s.id = cs.subject_id
		ORDER BY cs.course_title, s.name
	`)
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
