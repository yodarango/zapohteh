package models

import (
	"fmt"
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
* Create persists a new subject for a user to the database.
**************************************************************************************/
func (s *Subject) Create(userId uint) error {
	if err := s.Validate(); err != nil {
		return err
	}
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return fmt.Errorf("database is not available")
	}
	_, err := ModelsRepo.DB.Conn.Exec(
		"INSERT INTO subjects (user_id, name, description, color) VALUES (?, ?, ?, ?)",
		userId,
		strings.TrimSpace(s.Name),
		strings.TrimSpace(s.Description),
		strings.TrimSpace(s.Color),
	)
	return err
}

/**************************************************************************************
* ListSubjects returns every subject belonging to a user.
**************************************************************************************/
func ListSubjects(userId uint) ([]Subject, error) {
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return []Subject{}, nil
	}
	rows, err := ModelsRepo.DB.Conn.Query(
		"SELECT id, name, description, color FROM subjects WHERE user_id = ? ORDER BY name",
		userId,
	)
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
* Update modifies an existing subject that belongs to the authenticated user.
**************************************************************************************/
func (s *Subject) Update(userId uint) error {
	if err := s.Validate(); err != nil {
		return err
	}
	if s.ID == 0 {
		return fmt.Errorf("subject id is required")
	}
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return fmt.Errorf("database is not available")
	}
	result, err := ModelsRepo.DB.Conn.Exec(
		"UPDATE subjects SET name = ?, description = ?, color = ? WHERE id = ? AND user_id = ?",
		strings.TrimSpace(s.Name),
		strings.TrimSpace(s.Description),
		strings.TrimSpace(s.Color),
		s.ID,
		userId,
	)
	if err != nil {
		return err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return fmt.Errorf("subject not found or not authorized")
	}
	return nil
}

/**************************************************************************************
* Delete removes a subject that belongs to the authenticated user.
**************************************************************************************/
func (s *Subject) Delete(userId uint) error {
	if s.ID == 0 {
		return fmt.Errorf("subject id is required")
	}
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return fmt.Errorf("database is not available")
	}
	result, err := ModelsRepo.DB.Conn.Exec(
		"DELETE FROM subjects WHERE id = ? AND user_id = ?",
		s.ID,
		userId,
	)
	if err != nil {
		return err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return fmt.Errorf("subject not found or not authorized")
	}
	return nil
}

