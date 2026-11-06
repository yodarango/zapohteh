package api

import (
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"path"
	"path/filepath"
	"strings"

	"zapohteh/constants"
	"zapohteh/internal/models"
	"zapohteh/internal/utils"
)

// maxSourceUploadSize caps the PDF upload size accepted by LearnFromSource.
const maxSourceUploadSize = 25 << 20 // 25 MB

/************************************************************************
* Handles a lesson import request: an uploaded PDF document
* (multipart/form-data with a "file" field) or a web article URL (JSON body
* with a "url" field). The source content is extracted, reorganized into
* chapters by the AI and progress is streamed back with Server-Sent Events.
*********************************************************************/
func LearnFromSource(w http.ResponseWriter, r *http.Request) {
	authUser, ok := r.Context().Value(constants.USER_CONTEXT_AUTH_KEY).(*models.AuthUser)
	if !ok {
		http.Error(w, "Authentication required", http.StatusUnauthorized)
		return
	}

	var (
		sourceType   string
		title        string
		language     string
		writingStyle string
		subjectIDs   []int
		pdfData      []byte
		webURL       string
	)

	if strings.HasPrefix(r.Header.Get("Content-Type"), "multipart/form-data") {
		sourceType = models.CourseSourceDoc
		r.Body = http.MaxBytesReader(w, r.Body, maxSourceUploadSize)
		if err := r.ParseMultipartForm(maxSourceUploadSize); err != nil {
			http.Error(w, "the file is too large or the form is invalid (25 MB max)", http.StatusBadRequest)
			return
		}
		// The uploaded PDF is never persisted: it is processed in memory and any
		// temporary files the multipart parser may have spilled to disk are removed
		// when the request ends.
		defer func() {
			if r.MultipartForm != nil {
				r.MultipartForm.RemoveAll()
			}
		}()
		file, header, err := r.FormFile("file")
		if err != nil {
			http.Error(w, "file is required", http.StatusBadRequest)
			return
		}
		defer file.Close()
		if !isPDFFile(header) {
			http.Error(w, "only PDF files are supported", http.StatusBadRequest)
			return
		}
		data, err := io.ReadAll(file)
		if err != nil {
			http.Error(w, "could not read the uploaded file", http.StatusBadRequest)
			return
		}
		if len(data) == 0 {
			http.Error(w, "the uploaded file is empty", http.StatusBadRequest)
			return
		}
		pdfData = data
		title = r.FormValue("title")
		if strings.TrimSpace(title) == "" {
			title = strings.TrimSuffix(header.Filename, filepath.Ext(header.Filename))
		}
		language = r.FormValue("language")
		writingStyle = r.FormValue("writingStyle")
		subjectIDs = parseIntList(r.FormValue("subjectIds"))
	} else {
		sourceType = models.CourseSourceWeb
		var requestBody struct {
			URL          string `json:"url"`
			Title        string `json:"title"`
			Language     string `json:"language"`
			WritingStyle string `json:"writingStyle"`
			SubjectIDs   []int  `json:"subjectIds"`
		}
		if err := json.NewDecoder(r.Body).Decode(&requestBody); err != nil {
			http.Error(w, fmt.Sprintf("%v", err), http.StatusBadRequest)
			return
		}
		webURL = strings.TrimSpace(requestBody.URL)
		if webURL == "" {
			http.Error(w, "url is required", http.StatusBadRequest)
			return
		}
		title = requestBody.Title
		language = requestBody.Language
		writingStyle = requestBody.WritingStyle
		subjectIDs = requestBody.SubjectIDs
	}

	// configure the response as a Server-Sent Events stream
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}

	// sendEvent writes a single named SSE event with a JSON payload
	sendEvent := func(event string, data interface{}) {
		payload, _ := json.Marshal(data)
		fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event, payload)
		flusher.Flush()
	}

	research := models.Research{
		Title:        utils.SanitizeFilename(title),
		Language:     language,
		WritingStyle: writingStyle,
		UserID:       authUser.Id,
		SourceType:   sourceType,
		SubjectIDs:   subjectIDs,
	}

	// extract the source content first: for web imports the article title is
	// discovered during extraction and may become the lesson title
	progress := func(phase, detail string) {
		sendEvent("extracting", map[string]string{"phase": phase, "detail": detail})
	}

	var err error
	if sourceType == models.CourseSourceDoc {
		err = research.ExtractPDFSource(pdfData, progress)
	} else {
		err = research.ExtractWebSource(webURL, progress)
	}
	if err != nil {
		sendEvent("error", fmt.Sprintf("%v", err))
		return
	}

	// derive the lesson title: user provided > discovered in the source > URL
	// slug, then persist the course row with its language and source badge
	name := strings.TrimSpace(title)
	if name == "" {
		name = research.SourceTitle
	}
	if name == "" && webURL != "" {
		name = titleFromURL(webURL)
	}
	name = utils.SanitizeFilename(name)
	if name == "" {
		name = "Imported Lesson"
	}
	research.Title = name
	research.Topic = name

	if err := models.SaveCourseLanguage(authUser.Id, name, research.Language); err != nil {
		sendEvent("error", fmt.Sprintf("%v", err))
		return
	}
	if err := models.SetCourseSource(authUser.Id, name, sourceType); err != nil {
		sendEvent("error", fmt.Sprintf("%v", err))
		return
	}

	research.OnChapters = func(chapters []string) {
		sendEvent("chapters", chapters)
	}
	research.OnChapterDone = func(chapter string) {
		sendEvent("chapterDone", chapter)
	}
	research.OnCoverImage = func(phase string, data string) {
		sendEvent("coverImage", map[string]string{"phase": phase, "data": data})
	}

	if err := research.Run(); err != nil {
		sendEvent("error", fmt.Sprintf("%v", err))
		return
	}

	// attach the selected subjects to the newly created course when provided
	if len(research.SubjectIDs) > 0 {
		if err := models.SetCourseSubjects(authUser.Id, name, research.SubjectIDs); err != nil {
			sendEvent("error", fmt.Sprintf("%v", err))
			return
		}
	}

	sendEvent("done", map[string]string{"topic": name})
}

// isPDFFile reports whether an uploaded multipart file looks like a PDF.
func isPDFFile(header *multipart.FileHeader) bool {
	if header.Header.Get("Content-Type") == "application/pdf" {
		return true
	}
	return strings.HasSuffix(strings.ToLower(header.Filename), ".pdf")
}

// titleFromURL derives a human readable title fallback from a URL slug.
func titleFromURL(rawURL string) string {
	u, err := url.Parse(rawURL)
	if err != nil {
		return ""
	}
	base := path.Base(strings.TrimSuffix(u.Path, "/"))
	base = strings.TrimSuffix(base, path.Ext(base))
	base = strings.NewReplacer("-", " ", "_", " ").Replace(base)
	if strings.TrimSpace(base) == "" || base == "." {
		return u.Host
	}
	return base
}
