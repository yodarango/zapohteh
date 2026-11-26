package models

import (
	"crypto/sha256"
	"database/sql"
	"fmt"
)

func IsVirtualSource(source string) bool {
	return source == CourseSourceDoc || source == CourseSourceWeb
}

func CourseSourceByID(id int) (string, error) {
	var source string
	err := ModelsRepo.DB.Conn.QueryRow(`SELECT source FROM courses WHERE id = ?`, id).Scan(&source)
	return source, err
}

// The older AI endpoint can regenerate AI courses, but cannot take over a Virtual's title.
func ReserveAICourseTitle(userID uint, title string) error {
	result, err := ModelsRepo.DB.Conn.Exec(`INSERT INTO courses (user_id, title, source) VALUES (?, ?, 'ai')
		ON CONFLICT(user_id, title) DO UPDATE SET source = 'ai' WHERE courses.source = 'ai'`, userID, title)
	if err != nil {
		return err
	}
	if count, err := result.RowsAffected(); err != nil {
		return err
	} else if count == 0 {
		return fmt.Errorf("a Virtual with this title already exists; please choose another title")
	}
	return nil
}

func ContentRevision(content, bibliography string) string {
	return fmt.Sprintf("v1-%x", sha256.Sum256([]byte(fmt.Sprintf("%d:%s%s", len(content), content, bibliography))))
}

type VirtualCheckpoint struct {
	Revision  string `json:"revision"`
	WordIndex int    `json:"wordIndex"`
	WordCount int    `json:"wordCount"`
}

func (r *Research) checkpointPercent(checkpoint VirtualCheckpoint) int {
	if checkpoint.Revision == "" || checkpoint.WordIndex < 0 || checkpoint.WordCount <= checkpoint.WordIndex {
		return 0
	}
	content, err := r.ReadContent()
	if err != nil {
		return 0
	}
	bibliography, err := r.ReadBibliography()
	if err != nil || ContentRevision(content, bibliography) != checkpoint.Revision {
		return 0
	}
	return int(float64(checkpoint.WordIndex+1) * 100 / float64(checkpoint.WordCount))
}

func GetVirtualCheckpoint(userID uint, courseID int) (*VirtualCheckpoint, error) {
	var checkpoint VirtualCheckpoint
	err := ModelsRepo.DB.Conn.QueryRow(`SELECT revision, word_index, word_count FROM virtual_checkpoints WHERE user_id = ? AND course_id = ?`, userID, courseID).
		Scan(&checkpoint.Revision, &checkpoint.WordIndex, &checkpoint.WordCount)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &checkpoint, err
}

func SaveVirtualCheckpoint(userID uint, courseID int, checkpoint VirtualCheckpoint) error {
	_, err := ModelsRepo.DB.Conn.Exec(`INSERT INTO virtual_checkpoints (user_id, course_id, revision, word_index, word_count)
		VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(user_id, course_id) DO UPDATE SET revision = excluded.revision, word_index = excluded.word_index,
		word_count = excluded.word_count, updated_at = CURRENT_TIMESTAMP`, userID, courseID, checkpoint.Revision, checkpoint.WordIndex, checkpoint.WordCount)
	return err
}
