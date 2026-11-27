package models

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

// SaveVirtualNarration installs only a complete, nonempty MP3. A failed download never
// replaces an existing narration. The caller checks the source revision before installation.
func (r *Research) SaveVirtualNarration(audio io.Reader, expectedBytes int64, verify func() error) error {
	folder := filepath.Join(r.folderPath(), "sounds")
	if err := os.MkdirAll(folder, 0755); err != nil {
		return err
	}
	file, err := os.CreateTemp(folder, ".narration-*")
	if err != nil {
		return err
	}
	defer os.Remove(file.Name())
	reader := bufio.NewReader(audio)
	header, err := reader.Peek(3)
	if err != nil || !(string(header) == "ID3" || (header[0] == 0xff && header[1]&0xe0 == 0xe0)) {
		file.Close()
		return fmt.Errorf("Tangereen did not return a valid MP3")
	}
	const maxAudioBytes = int64(2 << 30)
	size, copyErr := io.Copy(file, io.LimitReader(reader, maxAudioBytes+1))
	syncErr := file.Sync()
	closeErr := file.Close()
	if copyErr != nil {
		return copyErr
	}
	if syncErr != nil {
		return syncErr
	}
	if closeErr != nil {
		return closeErr
	}
	if size == 0 || size > maxAudioBytes || (expectedBytes > 0 && size != expectedBytes) {
		return fmt.Errorf("incomplete or oversized narration download")
	}
	if err := verify(); err != nil {
		return err
	}
	return os.Rename(file.Name(), filepath.Join(folder, "narration.mp3"))
}

func (r *Research) NarrationURL() string {
	if info, err := os.Stat(filepath.Join(r.folderPath(), "sounds", "narration.mp3")); err != nil || info.Size() == 0 {
		return ""
	}
	return "/data/" + encodePathSegments(fmt.Sprintf("user_%d/%s/sounds/narration.mp3", r.UserID, filepath.Base(r.folderPath())))
}
