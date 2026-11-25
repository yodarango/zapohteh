package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"zapohteh/constants"
	"zapohteh/internal/lib"
	"zapohteh/internal/models"
	"zapohteh/internal/utils"
)

type courseJobInput struct {
	Source       string `json:"source"`
	Title        string `json:"title"`
	Input        string `json:"input"`
	URL          string `json:"url"`
	Level        string `json:"level"`
	Language     string `json:"language"`
	WritingStyle string `json:"writingStyle"`
	SearchWeb    bool   `json:"searchWeb"`
	SubjectIDs   []int  `json:"subjectIds"`
	NotifyEmail  bool   `json:"notifyEmail"`
	RequestKey   string `json:"requestKey"`
}

// Prevent orphan cleanup from racing with a PDF upload before its job is recorded.
var jobUploadMutex sync.Mutex

type courseJob struct {
	ID                 int64    `json:"id"`
	Source             string   `json:"source"`
	Title              string   `json:"title"`
	Status             string   `json:"status"`
	Phase              string   `json:"phase"`
	Detail             string   `json:"detail"`
	Chapters           []string `json:"chapters"`
	Completed          []string `json:"completed"`
	Warning            string   `json:"warning"`
	Error              string   `json:"error"`
	CourseTitle        string   `json:"courseTitle"`
	NotifyEmail        bool     `json:"notifyEmail"`
	NotificationStatus string   `json:"notificationStatus"`
	CreatedAt          string   `json:"createdAt"`
}

const jobColumns = `j.id, j.source, j.title, j.status, j.phase, j.detail, j.chapters_json, j.completed_json, j.warning, j.error, j.course_title, j.notify_email, COALESCE(n.status, ''), j.created_at`

func scanCourseJob(row interface{ Scan(...interface{}) error }) (courseJob, error) {
	var j courseJob
	var chapters, completed string
	err := row.Scan(&j.ID, &j.Source, &j.Title, &j.Status, &j.Phase, &j.Detail, &chapters, &completed, &j.Warning, &j.Error, &j.CourseTitle, &j.NotifyEmail, &j.NotificationStatus, &j.CreatedAt)
	if err != nil {
		return j, err
	}
	if err = json.Unmarshal([]byte(chapters), &j.Chapters); err != nil {
		return j, err
	}
	if err = json.Unmarshal([]byte(completed), &j.Completed); err != nil {
		return j, err
	}
	return j, nil
}

func sendJobResponse(w http.ResponseWriter, status int, data interface{}, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(models.HttpResponse{Success: message == "", Data: data, Error: message})
}

// jobUploadDir is outside the public content directory and must be on persistent storage.
func jobUploadDir() (string, error) {
	content, err := filepath.Abs(utils.ContentDir())
	if err != nil {
		return "", err
	}
	dir := strings.TrimSpace(os.Getenv("JOB_UPLOAD_DIR"))
	if dir == "" {
		dir = filepath.Join(filepath.Dir(content), ".course-job-uploads")
	}
	dir, err = filepath.Abs(dir)
	if err != nil {
		return "", err
	}
	rel, err := filepath.Rel(content, dir)
	if err != nil || rel == "." || (rel != ".." && !strings.HasPrefix(rel, ".."+string(os.PathSeparator))) {
		return "", errors.New("JOB_UPLOAD_DIR must be outside CONTENT_DIR")
	}
	return dir, nil
}

func CourseJobsHandler(w http.ResponseWriter, r *http.Request) {
	user := r.Context().Value(constants.USER_CONTEXT_AUTH_KEY).(*models.AuthUser)
	db := RouterConfig.DB.Conn
	if r.Method == http.MethodGet {
		rows, err := db.Query(`SELECT `+jobColumns+` FROM course_jobs j LEFT JOIN course_job_notifications n ON n.job_id=j.id WHERE j.user_id=? ORDER BY CASE WHEN j.status IN ('queued','running') THEN 0 ELSE 1 END, j.id DESC LIMIT 3`, user.Id)
		if err != nil {
			sendJobResponse(w, 500, nil, "Could not load creation jobs")
			return
		}
		defer rows.Close()
		jobs := []courseJob{}
		for rows.Next() {
			j, err := scanCourseJob(rows)
			if err != nil {
				sendJobResponse(w, 500, nil, "Could not load creation jobs")
				return
			}
			jobs = append(jobs, j)
		}
		if rows.Err() != nil {
			sendJobResponse(w, 500, nil, "Could not load creation jobs")
			return
		}
		sendJobResponse(w, 200, jobs, "")
		return
	}
	if r.Method != http.MethodPost {
		sendJobResponse(w, 405, nil, "Method not allowed")
		return
	}
	var input courseJobInput
	var uploadPath string
	if strings.HasPrefix(r.Header.Get("Content-Type"), "multipart/form-data") {
		jobUploadMutex.Lock()
		defer jobUploadMutex.Unlock()
		r.Body = http.MaxBytesReader(w, r.Body, maxSourceUploadSize+(1<<20))
		if err := r.ParseMultipartForm(1 << 20); err != nil {
			sendJobResponse(w, 400, nil, "Invalid upload or file exceeds 25 MB")
			return
		}
		defer r.MultipartForm.RemoveAll()
		file, header, err := r.FormFile("file")
		if err != nil {
			sendJobResponse(w, 400, nil, "A PDF file is required")
			return
		}
		defer file.Close()
		if !isPDFFile(header) {
			sendJobResponse(w, 400, nil, "Only PDF files are supported")
			return
		}
		input = courseJobInput{Source: "doc", Title: r.FormValue("title"), Language: r.FormValue("language"), WritingStyle: r.FormValue("writingStyle"), SubjectIDs: parseIntList(r.FormValue("subjectIds")), NotifyEmail: r.FormValue("notifyEmail") == "true", RequestKey: r.FormValue("requestKey")}
		if strings.TrimSpace(input.Title) == "" {
			input.Title = strings.TrimSuffix(header.Filename, filepath.Ext(header.Filename))
		}
		dir, err := jobUploadDir()
		if err != nil {
			sendJobResponse(w, 500, nil, "Upload storage is not configured safely")
			return
		}
		if err = os.MkdirAll(dir, 0700); err != nil {
			sendJobResponse(w, 500, nil, "Could not store upload")
			return
		}
		resolvedDir, resolveErr := filepath.EvalSymlinks(dir)
		content, contentErr := filepath.Abs(utils.ContentDir())
		if contentErr == nil {
			if resolvedContent, err := filepath.EvalSymlinks(content); err == nil {
				content = resolvedContent
			}
		}
		rel, relErr := filepath.Rel(content, resolvedDir)
		if resolveErr != nil || contentErr != nil || relErr != nil || rel == "." || (rel != ".." && !strings.HasPrefix(rel, ".."+string(os.PathSeparator))) {
			sendJobResponse(w, 500, nil, "Upload storage is not configured safely")
			return
		}
		dir = resolvedDir
		tmp, err := os.CreateTemp(dir, "upload-*.pdf")
		if err != nil {
			sendJobResponse(w, 500, nil, "Could not store upload")
			return
		}
		uploadPath = tmp.Name()
		defer func() {
			if uploadPath != "" {
				_ = os.Remove(uploadPath)
			}
		}()
		size, copyErr := io.Copy(tmp, io.LimitReader(file, maxSourceUploadSize+1))
		closeErr := tmp.Close()
		if copyErr != nil || closeErr != nil || size == 0 || size > maxSourceUploadSize {
			sendJobResponse(w, 400, nil, "Invalid upload or file exceeds 25 MB")
			return
		}
	} else {
		r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			sendJobResponse(w, 400, nil, "Invalid job request")
			return
		}
	}
	input.Title = utils.SanitizeFilename(input.Title)
	if len(input.RequestKey) < 16 || len(input.RequestKey) > 128 {
		sendJobResponse(w, 400, nil, "A valid request key is required")
		return
	}
	if input.Source != "ai" && input.Source != "doc" && input.Source != "web" {
		sendJobResponse(w, 400, nil, "Invalid source")
		return
	}
	if input.Source == "doc" && uploadPath == "" {
		sendJobResponse(w, 400, nil, "A PDF file is required")
		return
	}
	if input.Source == "ai" && (input.Title == "" || strings.TrimSpace(input.Input) == "") {
		sendJobResponse(w, 400, nil, "Title and topic are required")
		return
	}
	if input.Source == "web" && strings.TrimSpace(input.URL) == "" {
		sendJobResponse(w, 400, nil, "A URL is required")
		return
	}
	payload, err := json.Marshal(input)
	if err != nil {
		sendJobResponse(w, 400, nil, "Invalid job request")
		return
	}
	res, err := db.Exec(`INSERT INTO course_jobs (user_id,request_key,source,title,input_json,upload_path,notify_email) VALUES (?,?,?,?,?,?,?) ON CONFLICT(user_id,request_key) DO NOTHING`, user.Id, input.RequestKey, input.Source, input.Title, string(payload), uploadPath, input.NotifyEmail)
	if err != nil {
		var existingID int64
		if lookupErr := db.QueryRow(`SELECT id FROM course_jobs WHERE user_id=? AND request_key=?`, user.Id, input.RequestKey).Scan(&existingID); lookupErr == nil {
			sendJobResponse(w, http.StatusAccepted, map[string]int64{"id": existingID}, "")
			return
		}
		var collision int
		if input.Title != "" && db.QueryRow(`SELECT COUNT(*) FROM course_jobs WHERE user_id=? AND title=? COLLATE NOCASE AND status IN ('queued','running')`, user.Id, input.Title).Scan(&collision) == nil && collision > 0 {
			sendJobResponse(w, 409, nil, "A creation job with this title is already active")
		} else {
			log.Printf("could not queue course job: %v", err)
			sendJobResponse(w, 500, nil, "Could not queue course")
		}
		return
	}
	n, err := res.RowsAffected()
	if err != nil {
		sendJobResponse(w, 500, nil, "Could not confirm job")
		return
	}
	var id int64
	if n == 0 {
		err = db.QueryRow(`SELECT id FROM course_jobs WHERE user_id=? AND request_key=?`, user.Id, input.RequestKey).Scan(&id)
	} else {
		id, err = res.LastInsertId()
		uploadPath = ""
	}
	if err != nil {
		sendJobResponse(w, 500, nil, "Could not confirm job")
		return
	}
	sendJobResponse(w, http.StatusAccepted, map[string]int64{"id": id}, "")
}

func CourseJobHandler(w http.ResponseWriter, r *http.Request) {
	user := r.Context().Value(constants.USER_CONTEXT_AUTH_KEY).(*models.AuthUser)
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		sendJobResponse(w, 404, nil, "Job not found")
		return
	}
	j, err := scanCourseJob(RouterConfig.DB.Conn.QueryRow(`SELECT `+jobColumns+` FROM course_jobs j LEFT JOIN course_job_notifications n ON n.job_id=j.id WHERE j.id=? AND j.user_id=?`, id, user.Id))
	if err == sql.ErrNoRows {
		sendJobResponse(w, 404, nil, "Job not found")
		return
	}
	if err != nil {
		sendJobResponse(w, 500, nil, "Could not load job")
		return
	}
	sendJobResponse(w, 200, j, "")
}

// StartCourseJobWorkers must be called once per deployment, after database setup.
func StartCourseJobWorkers() error {
	db := RouterConfig.DB.Conn
	_, err := db.Exec(`UPDATE course_jobs SET status='interrupted', error='The server restarted during creation. Partial content may remain; use a new title to try again.', updated_at=CURRENT_TIMESTAMP WHERE status='running'`)
	if err != nil {
		return err
	}
	if err := cleanupJobUploads(); err != nil {
		log.Printf("course upload cleanup: %v", err)
	}
	_, err = db.Exec(`UPDATE course_job_notifications SET status='pending' WHERE status='sending'`)
	if err != nil {
		return err
	}
	go func() {
		for {
			if err := processCourseJob(); err != nil {
				log.Printf("course job worker: %v", err)
			}
			time.Sleep(2 * time.Second)
		}
	}()
	go func() {
		for {
			if err := cleanupJobUploads(); err != nil {
				log.Printf("course upload cleanup: %v", err)
			}
			time.Sleep(time.Hour)
		}
	}()
	go func() {
		for {
			if err := processCourseNotification(); err != nil {
				log.Printf("course notification worker: %v", err)
			}
			time.Sleep(5 * time.Second)
		}
	}()
	return nil
}

func cleanupJobUploads() error {
	jobUploadMutex.Lock()
	defer jobUploadMutex.Unlock()
	db := RouterConfig.DB.Conn
	rows, err := db.Query(`SELECT id, upload_path FROM course_jobs WHERE status IN ('interrupted','failed','succeeded') AND upload_path<>''`)
	if err != nil {
		return err
	}
	type upload struct {
		id   int64
		path string
	}
	var uploads []upload
	for rows.Next() {
		var u upload
		if err := rows.Scan(&u.id, &u.path); err != nil {
			rows.Close()
			return err
		}
		uploads = append(uploads, u)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return err
	}
	rows.Close()
	for _, u := range uploads {
		if err := os.Remove(u.path); err != nil && !os.IsNotExist(err) {
			log.Printf("course job %d upload cleanup: %v", u.id, err)
			continue
		}
		if _, err := db.Exec(`UPDATE course_jobs SET upload_path='' WHERE id=?`, u.id); err != nil {
			return err
		}
	}
	dir, err := jobUploadDir()
	if err != nil {
		return err
	}
	entries, err := os.ReadDir(dir)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasPrefix(entry.Name(), "upload-") {
			continue
		}
		info, err := entry.Info()
		if err != nil || time.Since(info.ModTime()) < 24*time.Hour {
			continue
		}
		path := filepath.Join(dir, entry.Name())
		var count int
		if err := db.QueryRow(`SELECT COUNT(*) FROM course_jobs WHERE upload_path=?`, path).Scan(&count); err != nil {
			return err
		}
		if count == 0 {
			if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
				log.Printf("orphan upload cleanup: %v", err)
			}
		}
	}
	return nil
}

func processCourseJob() error {
	db := RouterConfig.DB.Conn
	var id int64
	var userID uint
	var payload, uploadPath string
	err := db.QueryRow(`UPDATE course_jobs SET status='running', phase='starting', updated_at=CURRENT_TIMESTAMP WHERE id=(SELECT id FROM course_jobs WHERE status='queued' ORDER BY id LIMIT 1) AND status='queued' RETURNING id,user_id,input_json,upload_path`).Scan(&id, &userID, &payload, &uploadPath)
	if err == sql.ErrNoRows {
		return nil
	}
	if err != nil {
		return err
	}
	var input courseJobInput
	err = json.Unmarshal([]byte(payload), &input)
	if err == nil {
		err = runCourseJob(id, userID, input, uploadPath)
	}
	if err != nil {
		log.Printf("course job %d failed: %v", id, err)
		if _, updateErr := db.Exec(`UPDATE course_jobs SET status='failed', error=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`, err.Error(), id); updateErr != nil {
			return updateErr
		}
	}
	if uploadPath != "" {
		if removeErr := os.Remove(uploadPath); removeErr != nil && !os.IsNotExist(removeErr) {
			log.Printf("course job %d: upload cleanup: %v", id, removeErr)
		} else {
			_, _ = db.Exec(`UPDATE course_jobs SET upload_path='' WHERE id=?`, id)
		}
	}
	return nil
}

func runCourseJob(id int64, userID uint, input courseJobInput, uploadPath string) error {
	db := RouterConfig.DB.Conn
	update := func(query string, args ...interface{}) {
		args = append(args, id)
		if _, err := db.Exec(query, args...); err != nil {
			log.Printf("course job %d progress: %v", id, err)
		}
	}
	progress := func(phase, detail string) {
		update(`UPDATE course_jobs SET phase=?,detail=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`, phase, detail)
	}
	research := models.Research{Title: input.Title, Topic: input.Input, Level: input.Level, Language: input.Language, WritingStyle: input.WritingStyle, SearchWeb: input.SearchWeb, SubjectIDs: input.SubjectIDs, UserID: userID}
	if input.Source != "ai" {
		research.SourceType = input.Source
		progress("extract", "Extracting source content")
		var err error
		extractProgress := func(phase, detail string) { progress("extract", detail) }
		if input.Source == "doc" {
			var data []byte
			data, err = os.ReadFile(uploadPath)
			if err == nil {
				err = research.ExtractPDFSource(data, extractProgress)
			}
		} else {
			err = research.ExtractWebSource(input.URL, extractProgress)
		}
		if err != nil {
			return err
		}
		if research.Title == "" {
			research.Title = research.SourceTitle
		}
		if research.Title == "" {
			research.Title = titleFromURL(input.URL)
		}
		research.Title = utils.SanitizeFilename(research.Title)
		if research.Title == "" {
			research.Title = "Imported Lesson"
		}
		research.Topic = research.Title
	}
	progress("reserve", "Reserving course title")
	if err := models.CreateImportedCourse(userID, research.Title, research.Language, input.Source); err != nil {
		return err
	}
	if input.Source == "web" {
		if err := research.SaveWebSourceImages(func(_ string, detail string) { progress("extract", detail) }); err != nil {
			return err
		}
	}
	chapters, completed := []string{}, []string{}
	research.OnChapters = func(items []string) {
		chapters = items
		encoded, _ := json.Marshal(chapters)
		update(`UPDATE course_jobs SET phase='research',chapters_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`, string(encoded))
	}
	research.OnChapterDone = func(chapter string) {
		completed = append(completed, chapter)
		encoded, _ := json.Marshal(completed)
		update(`UPDATE course_jobs SET completed_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`, string(encoded))
	}
	research.OnCoverImage = func(phase, detail string) {
		if phase == "error" {
			update(`UPDATE course_jobs SET phase='thumbnail',warning=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`, detail)
		} else {
			progress("thumbnail", "Creating thumbnail")
		}
	}
	progress("chapters", "Preparing chapters")
	if err := research.Run(); err != nil {
		return err
	}
	if len(input.SubjectIDs) > 0 {
		if err := models.SetCourseSubjects(userID, research.Title, input.SubjectIDs); err != nil {
			return err
		}
	}
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err = tx.Exec(`UPDATE course_jobs SET status='succeeded',phase='done',detail='',course_title=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`, research.Title, id); err != nil {
		return err
	}
	if input.NotifyEmail {
		if _, err = tx.Exec(`INSERT INTO course_job_notifications(job_id) VALUES (?)`, id); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func processCourseNotification() error {
	db := RouterConfig.DB.Conn
	var id int64
	err := db.QueryRow(`UPDATE course_job_notifications SET status='sending',attempts=attempts+1 WHERE job_id=(SELECT job_id FROM course_job_notifications WHERE status='pending' AND next_attempt_at<=CURRENT_TIMESTAMP ORDER BY job_id LIMIT 1) AND status='pending' RETURNING job_id`).Scan(&id)
	if err == sql.ErrNoRows {
		return nil
	}
	if err != nil {
		return err
	}
	var email, firstName, title string
	var attempts int
	if err = db.QueryRow(`SELECT u.email,u.first_name,j.course_title,n.attempts FROM course_jobs j JOIN users u ON u.id=j.user_id JOIN course_job_notifications n ON n.job_id=j.id WHERE j.id=?`, id).Scan(&email, &firstName, &title, &attempts); err != nil {
		_, _ = db.Exec(`UPDATE course_job_notifications SET status='pending',next_attempt_at=datetime('now','+5 minutes') WHERE job_id=?`, id)
		return err
	}
	err = lib.NewEmailService().SendCourseReadyEmail(email, firstName, title)
	if err != nil {
		status := "pending"
		if attempts >= 3 {
			status = "failed"
		}
		_, updateErr := db.Exec(`UPDATE course_job_notifications SET status=?,last_error=?,next_attempt_at=datetime('now','+5 minutes') WHERE job_id=?`, status, err.Error(), id)
		if updateErr != nil {
			return updateErr
		}
		return fmt.Errorf("job %d email: %w", id, err)
	}
	_, err = db.Exec(`UPDATE course_job_notifications SET status='sent',last_error='' WHERE job_id=?`, id)
	return err
}
