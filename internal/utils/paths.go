package utils

import (
	"os"
	"path/filepath"
	"strings"
)

// ContentDir returns the base directory where generated research content is stored.
// It reads the CONTENT_DIR environment variable and defaults to "./data" relative
// to the current working directory. The returned path is cleaned so it has no
// trailing separator.
func ContentDir() string {
	dir := strings.TrimSpace(os.Getenv("CONTENT_DIR"))
	if dir == "" {
		dir = "./data"
	}
	return filepath.Clean(dir)
}
