package models

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"zapohteh/internal/utils"
)

const cleanedVirtualContentFile = "cleaned-content.md"

// ReplaceVirtualContent atomically installs one document without parsing chapter headings.
// Old chapter files remain inactive, and a private backup keeps the original content.
func (r *Research) ReplaceVirtualContent(jobID, content string) error {
	if strings.TrimSpace(content) == "" {
		return fmt.Errorf("cleanup returned empty content")
	}
	original, err := r.ReadContent()
	if err != nil {
		return err
	}
	contentRoot, err := filepath.Abs(utils.ContentDir())
	if err != nil {
		return err
	}
	backupRoot := strings.TrimSpace(os.Getenv("VIRTUAL_CLEANUP_BACKUP_DIR"))
	if backupRoot == "" {
		backupRoot = filepath.Join(filepath.Dir(contentRoot), ".virtual-cleanup-backups")
	}
	backupRoot, err = filepath.Abs(backupRoot)
	if err != nil {
		return err
	}
	rel, err := filepath.Rel(contentRoot, backupRoot)
	if err != nil || rel == "." || (rel != ".." && !strings.HasPrefix(rel, ".."+string(os.PathSeparator))) {
		return fmt.Errorf("VIRTUAL_CLEANUP_BACKUP_DIR must be outside CONTENT_DIR")
	}
	backup := filepath.Join(backupRoot, jobID)
	if err := os.MkdirAll(backup, 0700); err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(backup, "content.original.md"), []byte(original), 0600); err != nil {
		return err
	}
	if _, err := os.Stat(filepath.Join(r.folderPath(), cleanedVirtualContentFile)); os.IsNotExist(err) {
		index, err := os.ReadFile(filepath.Join(r.folderPath(), chaptersFileName))
		if err != nil {
			return err
		}
		if err := os.WriteFile(filepath.Join(backup, chaptersFileName), index, 0600); err != nil {
			return err
		}
		for i, title := range r.ChapterTitles() {
			source := chapterFilePath(r.folderPath(), title, i+1)
			data, err := os.ReadFile(source)
			if err != nil {
				return err
			}
			if err := os.WriteFile(filepath.Join(backup, filepath.Base(source)), data, 0600); err != nil {
				return err
			}
		}
	}
	file, err := os.CreateTemp(r.folderPath(), ".cleanup-*")
	if err != nil {
		return err
	}
	defer os.Remove(file.Name())
	_, writeErr := file.WriteString(content)
	syncErr := file.Sync()
	closeErr := file.Close()
	if writeErr != nil {
		return writeErr
	}
	if syncErr != nil {
		return syncErr
	}
	if closeErr != nil {
		return closeErr
	}
	return os.Rename(file.Name(), filepath.Join(r.folderPath(), cleanedVirtualContentFile))
}
