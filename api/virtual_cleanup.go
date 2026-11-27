package api

import (
	"bytes"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"zapohteh/constants"
	"zapohteh/internal/models"
)

var virtualCleanupMu sync.Mutex

func cleanupHash(token string) string { return fmt.Sprintf("%x", sha256.Sum256([]byte(token))) }

func VirtualCleanupHandler(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(constants.USER_CONTEXT_AUTH_KEY).(*models.AuthUser)
	if !ok {
		sendJobResponse(w, 401, nil, "Authentication required")
		return
	}
	topic := r.URL.Query().Get("topic")
	owner, courseID, role, err := models.ResolveCourseAccess(user.Id, topic)
	if err != nil {
		sendJobResponse(w, 404, nil, "Virtual not found")
		return
	}
	source, err := models.CourseSourceByID(courseID)
	if err != nil || !models.IsVirtualSource(source) || role != models.CourseRoleOwner {
		sendJobResponse(w, 403, nil, "Only the owner can clean up a Virtual")
		return
	}
	virtualCleanupMu.Lock()
	defer virtualCleanupMu.Unlock()
	conn := models.ModelsRepo.DB.Conn
	if _, err := conn.Exec(`UPDATE virtual_cleanups SET status = 'failed', error = 'Cleanup timed out. Please try again.' WHERE course_id = ? AND status = 'running' AND created_at < datetime('now', '-2 hours')`, courseID); err != nil {
		sendJobResponse(w, 500, nil, "Could not check cleanup status")
		return
	}
	var id, status, message string
	var progress int
	var phase string
	var remaining sql.NullInt64
	err = conn.QueryRow(`SELECT id, status, error, progress, phase, remaining_seconds FROM virtual_cleanups WHERE course_id = ? ORDER BY rowid DESC LIMIT 1`, courseID).Scan(&id, &status, &message, &progress, &phase, &remaining)
	if err != nil && err != sql.ErrNoRows {
		sendJobResponse(w, 500, nil, "Could not check cleanup status")
		return
	}
	if r.Method == http.MethodGet || status == "running" {
		var remainingSeconds interface{}
		if remaining.Valid {
			remainingSeconds = remaining.Int64
		}
		sendJobResponse(w, 200, map[string]interface{}{"id": id, "status": status, "error": message, "progress": progress, "phase": phase, "remainingSeconds": remainingSeconds}, "")
		return
	}
	key := strings.TrimSpace(os.Getenv("TANJREEN_API_KEY"))
	base := strings.TrimRight(strings.TrimSpace(os.Getenv("BASE_URL")), "/")
	endpoint := strings.TrimRight(strings.TrimSpace(os.Getenv("TANJREEN_API_URL")), "/")
	if endpoint == "" {
		endpoint = "https://tanjreen.shrood.app"
	}
	callback, parseErr := url.Parse(base)
	if key == "" || parseErr != nil || callback.Host == "" || (callback.Scheme != "https" && callback.Scheme != "http") {
		sendJobResponse(w, 503, nil, "Configure TANJREEN_API_KEY and BASE_URL before cleaning up Virtuals")
		return
	}
	research := models.Research{Title: topic, UserID: owner}
	content, err := research.ReadContent()
	if err != nil {
		sendJobResponse(w, 500, nil, "Could not read Virtual content")
		return
	}
	bibliography, err := research.ReadBibliography()
	if err != nil {
		sendJobResponse(w, 500, nil, "Could not read Virtual bibliography")
		return
	}
	random := make([]byte, 48)
	if _, err := rand.Read(random); err != nil {
		sendJobResponse(w, 500, nil, "Could not initialize cleanup")
		return
	}
	id, token := hex.EncodeToString(random[:16]), hex.EncodeToString(random[16:])
	payload, err := json.Marshal(map[string]interface{}{"jobId": id, "bookTitle": topic, "content": content, "callbackUrl": base + "/api/virtual-cleanup/callback", "callbackToken": token})
	if err != nil || len(payload) > 8<<20 {
		sendJobResponse(w, 413, nil, "Virtual is too large to clean up")
		return
	}
	if _, err := conn.Exec(`INSERT INTO virtual_cleanups (id, course_id, revision, token_hash) VALUES (?, ?, ?, ?)`, id, courseID, models.ContentRevision(content, bibliography), cleanupHash(token)); err != nil {
		sendJobResponse(w, 409, nil, "Could not start cleanup; another cleanup may be running")
		return
	}
	// Dispatch outside the HTTP request lifetime. Tangereen persists the accepted job.
	go func() {
		failure := "Could not reach Tangereen. Check TANJREEN_API_URL and that its local server is running."
		req, err := http.NewRequest(http.MethodPost, endpoint+"/api/cleanup", bytes.NewReader(payload))
		if err == nil {
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("X-API-Key", key)
			client := &http.Client{Timeout: 30 * time.Second, CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse }}
			var response *http.Response
			response, err = client.Do(req)
			if err == nil {
				body, readErr := io.ReadAll(io.LimitReader(response.Body, 4096))
				response.Body.Close()
				if response.StatusCode != http.StatusAccepted {
					failure = fmt.Sprintf("Tangereen rejected cleanup (HTTP %d).", response.StatusCode)
					// Only forward known configuration/validation errors, never arbitrary upstream content.
					var upstream struct {
						Error string `json:"error"`
					}
					if json.Unmarshal(body, &upstream) == nil {
						switch upstream.Error {
						case "ZAPOHTEH_BASE_URL is not configured", "Invalid ZAPOHTEH_BASE_URL", "Callback URL is not allowed", "Invalid cleanup request", "Could not save cleanup job", "Invalid API key.", "API key authentication is not configured on the server.":
							failure += " " + upstream.Error
						}
					}
					err = fmt.Errorf("%s", failure)
				} else if readErr != nil {
					log.Printf("Virtual cleanup %s accepted; could not read acknowledgment: %v", id, readErr)
				}
			}
		}
		if err != nil {
			log.Printf("Virtual cleanup %s dispatch: %v", id, err)
			if _, updateErr := conn.Exec(`UPDATE virtual_cleanups SET status = 'failed', error = ? WHERE id = ? AND status = 'running'`, failure, id); updateErr != nil {
				log.Printf("Virtual cleanup %s could not record dispatch failure: %v", id, updateErr)
			}
		}
	}()
	sendJobResponse(w, http.StatusAccepted, map[string]interface{}{"id": id, "status": "running", "progress": 0, "phase": "queued", "remainingSeconds": nil}, "")
}

func VirtualCleanupCallback(w http.ResponseWriter, r *http.Request) {
	var input struct {
		JobID    string `json:"jobId"`
		Content  string `json:"content"`
		Error    string `json:"error"`
		Progress *struct {
			Phase            string `json:"phase"`
			CompletedChunks  int    `json:"completedChunks"`
			TotalChunks      int    `json:"totalChunks"`
			RemainingSeconds *int   `json:"remainingSeconds"`
		} `json:"progress"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<20)).Decode(&input); err != nil {
		sendJobResponse(w, 400, nil, "Invalid cleanup payload")
		return
	}
	virtualCleanupMu.Lock()
	defer virtualCleanupMu.Unlock()
	conn := models.ModelsRepo.DB.Conn
	var hash, revision, status, title, source string
	var owner uint
	var courseID int
	err := conn.QueryRow(`SELECT j.token_hash, j.revision, j.status, c.title, c.user_id, c.id, c.source FROM virtual_cleanups j JOIN courses c ON c.id = j.course_id WHERE j.id = ?`, input.JobID).
		Scan(&hash, &revision, &status, &title, &owner, &courseID, &source)
	provided := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	if err != nil || subtle.ConstantTimeCompare([]byte(hash), []byte(cleanupHash(provided))) != 1 {
		sendJobResponse(w, 401, nil, "Invalid cleanup callback credentials")
		return
	}
	if status != "running" {
		sendJobResponse(w, 200, nil, "")
		return
	}
	if p := input.Progress; p != nil {
		if p.Phase != "cleaning" || p.CompletedChunks < 0 || p.TotalChunks < 0 || p.CompletedChunks > p.TotalChunks || p.TotalChunks > 1000000 ||
			(p.RemainingSeconds != nil && (*p.RemainingSeconds < 0 || *p.RemainingSeconds > 31536000)) {
			sendJobResponse(w, 400, nil, "Invalid cleanup progress")
			return
		}
		progress, phase := 0, "cleaning"
		if p.TotalChunks > 0 {
			progress = p.CompletedChunks * 95 / p.TotalChunks
		}
		if p.CompletedChunks == p.TotalChunks {
			progress, phase = 95, "finalizing"
		}
		if _, err := conn.Exec(`UPDATE virtual_cleanups SET progress = MAX(progress, ?), phase = ?, remaining_seconds = ? WHERE id = ? AND status = 'running'`, progress, phase, p.RemainingSeconds, input.JobID); err != nil {
			sendJobResponse(w, 500, nil, "Could not save cleanup progress")
			return
		}
		sendJobResponse(w, 200, nil, "")
		return
	}
	research := models.Research{Title: title, UserID: owner}
	content, contentErr := research.ReadContent()
	bibliography, bibErr := research.ReadBibliography()
	failure := ""
	switch {
	case input.Error != "":
		failure = "Tangereen could not clean up this Virtual. Please try again."
	case !models.IsVirtualSource(source):
		failure = "This item is no longer a Virtual."
	case contentErr != nil || bibErr != nil:
		failure = "Could not read current Virtual content."
	case models.ContentRevision(content, bibliography) != revision:
		failure = "This Virtual changed during cleanup. Your newer content was preserved."
	default:
		if err := research.ReplaceVirtualContent(input.JobID, input.Content); err != nil {
			log.Printf("Virtual cleanup %s replacement: %v", input.JobID, err)
			failure = "Could not safely replace Virtual content. The original was retained or backed up."
		}
	}
	status = "completed"
	if failure != "" {
		status = "failed"
	}
	// Revisions invalidate old checkpoints automatically; remove them as well.
	if status == "completed" {
		conn.Exec(`DELETE FROM virtual_checkpoints WHERE course_id = ?`, courseID)
	}
	if _, err := conn.Exec(`UPDATE virtual_cleanups SET status = ?, error = ?, phase = ?, progress = CASE WHEN ? = 'completed' THEN 100 ELSE progress END, remaining_seconds = NULL WHERE id = ?`, status, failure, status, status, input.JobID); err != nil {
		sendJobResponse(w, 500, nil, "Could not record cleanup result")
		return
	}
	sendJobResponse(w, 200, map[string]string{"status": status}, "")
}
