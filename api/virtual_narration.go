package api

import (
	"bytes"
	"crypto/rand"
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

var narrationWorkers sync.Map

type narrationSettings struct {
	Voice    string `json:"voice"`
	Language string `json:"language"`
	Sanitize bool   `json:"sanitize"`
}

type narrationOptions struct {
	Voices    []string          `json:"voices"`
	Languages []string          `json:"languages"`
	Defaults  narrationSettings `json:"defaults"`
}

func fetchNarrationOptions() (narrationOptions, error) {
	var options narrationOptions
	endpoint, key, err := narrationService()
	if err != nil {
		return options, err
	}
	req, err := http.NewRequest(http.MethodGet, endpoint+"/api/narrations/settings", nil)
	if err != nil {
		return options, err
	}
	req.Header.Set("X-API-Key", key)
	client := &http.Client{Timeout: 10 * time.Second, CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse }}
	response, err := client.Do(req)
	if err != nil {
		return options, fmt.Errorf("could not load narration settings; check that Tangereen is running")
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return options, fmt.Errorf("Tangereen settings returned HTTP %d", response.StatusCode)
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, 65536)).Decode(&options); err != nil {
		return options, fmt.Errorf("invalid narration settings from Tangereen")
	}
	if len(options.Voices) == 0 || options.Defaults.Voice == "" {
		return options, fmt.Errorf("Tangereen returned no narration voices")
	}
	return options, nil
}

func NarrationSettingsHandler(w http.ResponseWriter, r *http.Request) {
	options, err := fetchNarrationOptions()
	if err != nil {
		sendJobResponse(w, 502, nil, err.Error())
		return
	}
	sendJobResponse(w, 200, options, "")
}

// Proxy existing static samples; API credentials stay server-side and no TTS is billed.
func NarrationVoiceSampleHandler(w http.ResponseWriter, r *http.Request) {
	voice := r.PathValue("voice")
	options, err := fetchNarrationOptions()
	if err != nil {
		sendJobResponse(w, 502, nil, err.Error())
		return
	}
	valid := false
	for _, candidate := range options.Voices {
		if voice == candidate {
			valid = true
			break
		}
	}
	if !valid || strings.ContainsAny(voice, "/\\.") {
		sendJobResponse(w, 400, nil, "Unsupported narration voice")
		return
	}
	endpoint, _, err := narrationService()
	if err != nil {
		sendJobResponse(w, 503, nil, err.Error())
		return
	}
	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, endpoint+"/voices/sample-"+url.PathEscape(voice)+".mp3", nil)
	if err != nil {
		sendJobResponse(w, 502, nil, "Could not load voice sample")
		return
	}
	client := &http.Client{Timeout: 15 * time.Second, CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse }}
	response, err := client.Do(req)
	if err != nil {
		sendJobResponse(w, 502, nil, "Could not load voice sample")
		return
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		sendJobResponse(w, 502, nil, "Voice sample is unavailable")
		return
	}
	const limit = 5 << 20
	data, err := io.ReadAll(io.LimitReader(response.Body, limit+1))
	if err != nil || len(data) == 0 || len(data) > limit {
		sendJobResponse(w, 502, nil, "Invalid voice sample")
		return
	}
	w.Header().Set("Content-Type", "audio/mpeg")
	w.Header().Set("Cache-Control", "private, max-age=86400")
	w.Header().Set("Content-Length", fmt.Sprint(len(data)))
	_, _ = w.Write(data)
}

func validNarrationSettings(settings narrationSettings, options narrationOptions) bool {
	found := false
	for _, voice := range options.Voices {
		if voice == settings.Voice {
			found = true
			break
		}
	}
	if !found {
		return false
	}
	if settings.Language == "" {
		return true
	}
	for _, language := range options.Languages {
		if language == settings.Language {
			return true
		}
	}
	return false
}

func narrationService() (string, string, error) {
	endpoint := strings.TrimRight(strings.TrimSpace(os.Getenv("TANJREEN_API_URL")), "/")
	if endpoint == "" {
		endpoint = "https://tanjreen.shrood.app"
	}
	key := strings.TrimSpace(os.Getenv("TANJREEN_API_KEY"))
	parsed, err := url.Parse(endpoint)
	if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") || key == "" {
		return "", "", fmt.Errorf("configure TANJREEN_API_URL and TANJREEN_API_KEY before narration")
	}
	return endpoint, key, nil
}

func VirtualNarrationHandler(w http.ResponseWriter, r *http.Request) {
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
	if err != nil || !models.IsVirtualSource(source) {
		sendJobResponse(w, 403, nil, "Narration is only available for Virtuals")
		return
	}
	research := models.Research{Title: topic, UserID: owner}
	if r.Method == http.MethodPost && role != models.CourseRoleOwner {
		sendJobResponse(w, 403, nil, "Only the owner can narrate a Virtual")
		return
	}
	conn := models.ModelsRepo.DB.Conn
	var id, status, phase, message string
	var progress int
	var remaining sql.NullInt64
	settings := narrationSettings{Voice: "echo"}
	err = conn.QueryRow(`SELECT id, status, phase, progress, remaining_seconds, error, voice, language, sanitize FROM virtual_narrations WHERE course_id = ? ORDER BY rowid DESC LIMIT 1`, courseID).
		Scan(&id, &status, &phase, &progress, &remaining, &message, &settings.Voice, &settings.Language, &settings.Sanitize)
	if err != nil && err != sql.ErrNoRows {
		sendJobResponse(w, 500, nil, "Could not check narration status")
		return
	}
	if r.Method == http.MethodGet || status == "running" {
		var seconds interface{}
		if remaining.Valid {
			seconds = remaining.Int64
		}
		sendJobResponse(w, 200, map[string]interface{}{"id": id, "status": status, "phase": phase, "progress": progress, "remainingSeconds": seconds, "error": message, "audioUrl": research.NarrationURL(), "settings": settings}, "")
		return
	}
	if _, _, err := narrationService(); err != nil {
		sendJobResponse(w, 503, nil, err.Error())
		return
	}
	options, err := fetchNarrationOptions()
	if err != nil {
		sendJobResponse(w, 502, nil, err.Error())
		return
	}
	settings = options.Defaults
	if r.ContentLength != 0 {
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&settings); err != nil {
			sendJobResponse(w, 400, nil, "Invalid narration settings")
			return
		}
	}
	if !validNarrationSettings(settings, options) {
		sendJobResponse(w, 400, nil, "Choose a supported voice and translation language")
		return
	}
	content, err := research.ReadContent()
	if err != nil || strings.TrimSpace(content) == "" {
		sendJobResponse(w, 400, nil, "Could not read Virtual content")
		return
	}
	if len(content) > 7<<20 {
		sendJobResponse(w, 413, nil, "Virtual is too large to narrate")
		return
	}
	bibliography, err := research.ReadBibliography()
	if err != nil {
		sendJobResponse(w, 500, nil, "Could not read Virtual bibliography")
		return
	}
	random := make([]byte, 16)
	if _, err := rand.Read(random); err != nil {
		sendJobResponse(w, 500, nil, "Could not initialize narration")
		return
	}
	id = hex.EncodeToString(random)
	_, err = conn.Exec(`INSERT INTO virtual_narrations (id, course_id, revision, content, voice, language, sanitize) VALUES (?, ?, ?, ?, ?, ?, ?)`, id, courseID, models.ContentRevision(content, bibliography), content, settings.Voice, settings.Language, settings.Sanitize)
	if err != nil {
		sendJobResponse(w, 409, nil, "Could not start narration; one may already be running")
		return
	}
	launchNarration(id)
	sendJobResponse(w, 202, map[string]interface{}{"id": id, "status": "running", "phase": "queued", "progress": 0, "audioUrl": research.NarrationURL(), "settings": settings}, "")
}

// Resume persisted requests after a Go restart; Tangereen deduplicates by the same job ID.
func StartVirtualNarrationWorkers() {
	go func() {
		for {
			rows, err := models.ModelsRepo.DB.Conn.Query(`SELECT id FROM virtual_narrations WHERE status = 'running'`)
			if err != nil {
				log.Printf("Narration recovery: %v", err)
				time.Sleep(5 * time.Second)
				continue
			}
			var ids []string
			for rows.Next() {
				var id string
				if rows.Scan(&id) == nil {
					ids = append(ids, id)
				}
			}
			rows.Close()
			for _, id := range ids {
				launchNarration(id)
			}
			time.Sleep(5 * time.Second)
		}
	}()
}

func launchNarration(id string) {
	if _, exists := narrationWorkers.LoadOrStore(id, true); exists {
		return
	}
	go func() {
		defer narrationWorkers.Delete(id)
		if err := runVirtualNarration(id); err != nil {
			log.Printf("Virtual narration %s: %v", id, err)
			if _, updateErr := models.ModelsRepo.DB.Conn.Exec(`UPDATE virtual_narrations SET status = 'failed', phase = 'failed', content = '', error = ?, remaining_seconds = NULL WHERE id = ? AND status = 'running'`, err.Error(), id); updateErr != nil {
				log.Printf("Virtual narration %s could not save failure: %v", id, updateErr)
			}
		}
	}()
}

func runVirtualNarration(id string) error {
	conn := models.ModelsRepo.DB.Conn
	var content, revision string
	var settings narrationSettings
	if err := conn.QueryRow(`SELECT content, revision, voice, language, sanitize FROM virtual_narrations WHERE id = ? AND status = 'running'`, id).Scan(&content, &revision, &settings.Voice, &settings.Language, &settings.Sanitize); err != nil {
		return err
	}
	endpoint, key, err := narrationService()
	if err != nil {
		return err
	}
	client := &http.Client{Timeout: 30 * time.Second, CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse }}
	request := func(method, path string, body io.Reader) (*http.Response, error) {
		req, err := http.NewRequest(method, endpoint+path, body)
		if err != nil {
			return nil, err
		}
		req.Header.Set("X-API-Key", key)
		if body != nil {
			req.Header.Set("Content-Type", "application/json")
		}
		return client.Do(req)
	}
	payload, err := json.Marshal(map[string]interface{}{"jobId": id, "content": content, "voice": settings.Voice, "language": settings.Language, "sanitize": settings.Sanitize})
	if err != nil {
		return err
	}
	response, err := request(http.MethodPost, "/api/narrations", bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("could not reach Tangereen narration API; check its local server")
	}
	io.Copy(io.Discard, io.LimitReader(response.Body, 4096))
	response.Body.Close()
	if response.StatusCode != 202 {
		return fmt.Errorf("Tangereen rejected narration (HTTP %d); check its API configuration", response.StatusCode)
	}
	type upstreamJob struct {
		Status           string `json:"status"`
		Phase            string `json:"phase"`
		Progress         int    `json:"progress"`
		RemainingSeconds *int   `json:"remainingSeconds"`
		FileSize         int64  `json:"fileSize"`
	}
	deadline := time.Now().Add(12 * time.Hour)
	var job upstreamJob
	for time.Now().Before(deadline) {
		response, err = request(http.MethodGet, "/api/narrations/"+id, nil)
		if err != nil {
			time.Sleep(3 * time.Second)
			continue
		}
		decodeErr := json.NewDecoder(io.LimitReader(response.Body, 65536)).Decode(&job)
		response.Body.Close()
		if response.StatusCode != 200 || decodeErr != nil {
			return fmt.Errorf("could not read Tangereen narration status (HTTP %d)", response.StatusCode)
		}
		if job.Status == "failed" {
			return fmt.Errorf("Tangereen narration failed. Check its server logs and try again")
		}
		if job.Status == "completed" {
			break
		}
		if job.Status != "running" {
			return fmt.Errorf("Tangereen returned an invalid narration state")
		}
		progress := max(0, min(94, job.Progress))
		if job.Phase == "concatenating" {
			progress = 95
		}
		if _, err := conn.Exec(`UPDATE virtual_narrations SET phase = ?, progress = MAX(progress, ?), remaining_seconds = ? WHERE id = ?`, job.Phase, progress, job.RemainingSeconds, id); err != nil {
			return err
		}
		time.Sleep(time.Second)
	}
	if job.Status != "completed" {
		return fmt.Errorf("narration timed out; please try again")
	}
	if job.FileSize <= 0 || job.FileSize > 2<<30 {
		return fmt.Errorf("Tangereen returned an invalid finished MP3 size")
	}
	if _, err := conn.Exec(`UPDATE virtual_narrations SET phase = 'saving', progress = 98, remaining_seconds = NULL WHERE id = ?`, id); err != nil {
		return err
	}
	var title, source string
	var owner uint
	if err := conn.QueryRow(`SELECT c.title, c.user_id, c.source FROM courses c JOIN virtual_narrations j ON j.course_id = c.id WHERE j.id = ?`, id).Scan(&title, &owner, &source); err != nil {
		return err
	}
	if !models.IsVirtualSource(source) {
		return fmt.Errorf("this item is no longer a Virtual")
	}
	research := models.Research{Title: title, UserID: owner}
	client.Timeout = 30 * time.Minute
	response, err = request(http.MethodGet, "/api/narrations/"+id+"/audio", nil)
	if err != nil {
		return fmt.Errorf("could not download the finished narration")
	}
	defer response.Body.Close()
	if response.StatusCode != 200 || !strings.HasPrefix(response.Header.Get("Content-Type"), "audio/") {
		return fmt.Errorf("Tangereen did not return the finished MP3")
	}
	err = research.SaveVirtualNarration(response.Body, job.FileSize, func() error {
		current, err := research.ReadContent()
		if err != nil {
			return err
		}
		bibliography, err := research.ReadBibliography()
		if err != nil {
			return err
		}
		if models.ContentRevision(current, bibliography) != revision {
			return fmt.Errorf("the Virtual changed during narration; its previous audio was preserved. Narrate again")
		}
		return nil
	})
	if err != nil {
		return err
	}
	_, err = conn.Exec(`UPDATE virtual_narrations SET status = 'completed', phase = 'completed', progress = 100, content = '', error = '', remaining_seconds = NULL WHERE id = ?`, id)
	return err
}
