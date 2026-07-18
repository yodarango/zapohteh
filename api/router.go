package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"zapohteh/constants"
	"zapohteh/internal/models"
	"zapohteh/internal/utils"
)

func Router () http.Handler {

	mux := http.NewServeMux()

	mux.HandleFunc(constants.ROUTE_GET_AUTH_SAMPLE, models.Authenticate(SampleAuth))
	mux.HandleFunc(constants.ROUTE_GET_PUBLIC_SAMPLE, SamplePub)
	mux.HandleFunc(constants.ROUTE_POST_LEARN_ABOUT, models.Authenticate(LearnAbout))
	mux.HandleFunc(constants.ROUTE_GET_TOPIC, models.Authenticate(GetTopic))
	mux.HandleFunc(constants.ROUTE_GET_COURSES, models.Authenticate(GetCourses))
	mux.HandleFunc(constants.ROUTE_DELETE_COURSE, models.Authenticate(DeleteCourse))
	mux.HandleFunc(constants.ROUTE_PUT_COURSE, models.Authenticate(PutCourse))
	mux.HandleFunc(constants.ROUTE_GET_COURSE_IMAGES, models.Authenticate(GetCourseImages))
	mux.HandleFunc(constants.ROUTE_PUT_COURSE_COVER, models.Authenticate(PutCourseCover))
	mux.HandleFunc(constants.ROUTE_GET_COURSE_MD, models.Authenticate(GetCourseMD))
	mux.HandleFunc(constants.ROUTE_PUT_COURSE_MD, models.Authenticate(PutCourseMD))
	mux.HandleFunc(constants.ROUTE_GET_COURSE_HIGHLIGHTS, models.Authenticate(GetCourseHighlights))
	mux.HandleFunc(constants.ROUTE_PUT_COURSE_HIGHLIGHTS, models.Authenticate(PutCourseHighlights))
	mux.HandleFunc(constants.ROUTE_POST_COURSE_COVER_IMAGE, models.Authenticate(CreateCourseCoverImage))
	mux.HandleFunc(constants.ROUTE_POST_CHAPTER_IMAGE, models.Authenticate(ChapterImage))
	mux.HandleFunc(constants.ROUTE_GET_READING_PROGRESS, models.Authenticate(ReadingProgressHandler))
	mux.HandleFunc(constants.ROUTE_GET_SUBJECTS, models.Authenticate(SubjectsHandler))
	mux.HandleFunc("PUT /api/subjects/{id}", models.Authenticate(PutSubject))
	mux.HandleFunc("DELETE /api/subjects/{id}", models.Authenticate(DeleteSubject))
	mux.HandleFunc(constants.ROUTE_GET_COURSE_SUBJECTS, models.Authenticate(CourseSubjectsHandler))

	// tanjreen audiobook transformation API (API key auth, separate from JWT UI auth)
	mux.HandleFunc(constants.ROUTE_POST_TRANSFORM, models.AuthenticateAPIKey(Transform))
	mux.HandleFunc(constants.ROUTE_GET_DOWNLOAD, models.AuthenticateAPIKey(DownloadAudiobook))

	// serve generated research data (e.g. chapter images) from the configured content directory
	mux.Handle(
		constants.ROUTE_DATA_FILES,
		http.StripPrefix(constants.ROUTE_DATA_FILES, http.FileServer(http.Dir(utils.ContentDir()))),
	)

	// auth routes (no authentication required)
	mux.HandleFunc(constants.ROUTE_POST_CHANGE_PASSWORD, models.Authenticate(ChangePassword))
	mux.HandleFunc(constants.ROUTE_POST_UPDATE_PROFILE, models.Authenticate(UpdateProfile))
	mux.HandleFunc(constants.ROUTE_POST_FORGOT_PASSWORD, ForgotPassword)
	mux.HandleFunc(constants.ROUTE_POST_VERIFY_EMAIL, VerifyEmail)
	mux.HandleFunc(constants.ROUTE_POST_SIGNUP, Signup)
	mux.HandleFunc(constants.ROUTE_POST_LOGIN, Login)

	// lesson chat routes (GET and POST share the same path)
	mux.HandleFunc(constants.ROUTE_GET_CHAT, models.Authenticate(ChatHandler))


	// Serve static files from the frontend build
	staticPath := os.Getenv("STATIC_PATH")
	if staticPath == "" {
		staticPath = "frontend/dist"
	}
	spa := spaHandler{staticPath: staticPath, indexPath: "index.html"}
	mux.Handle("/", spa)

	return utils.EnableCORS(mux)
}

// spaHandler implements the http.Handler interface for serving a SPA
type spaHandler struct {
	staticPath string
	indexPath  string
}

func (h spaHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	path := h.staticPath + r.URL.Path

	// Check if file exists
	if _, err := os.Stat(path); os.IsNotExist(err) {
		// File does not exist, serve index.html
		http.ServeFile(w, r, h.staticPath+"/"+h.indexPath)
		return
	}

	// Serve the file
	http.FileServer(http.Dir(h.staticPath)).ServeHTTP(w, r)
}

/************************************************************************
* Simple Auth func
*********************************************************************/
func SampleAuth(w http.ResponseWriter, r *http.Request) {
	var httpResponse models.HttpResponse

	// Get authenticated user
	_, ok := r.Context().Value(constants.USER_CONTEXT_AUTH_KEY).(*models.AuthUser)
	if !ok {
		httpResponse.Error = "Authentication required"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	httpResponse.Data = map[string]interface{}{
		"message": "hello",
	}
	httpResponse.Success = true
	httpResponse.Error = nil
	httpResponse.Send(w)
}

/************************************************************************
* Simple Pub func
*********************************************************************/
func SamplePub(w http.ResponseWriter, r *http.Request) {
	var httpResponse models.HttpResponse


	httpResponse.Data = "Hello"
	httpResponse.Success = true
	httpResponse.Error = nil
	httpResponse.Send(w)
}

/************************************************************************
* Handles a research request from the homepage form. It breaks the topic
* down into chapters and elaborates each one using the AI model, streaming
* the progress back to the client using Server-Sent Events.
*********************************************************************/
func LearnAbout(w http.ResponseWriter, r *http.Request) {
	authUser, ok := r.Context().Value(constants.USER_CONTEXT_AUTH_KEY).(*models.AuthUser)
	if !ok {
		http.Error(w, "Authentication required", http.StatusUnauthorized)
		return
	}

	var research models.Research

	err := json.NewDecoder(r.Body).Decode(&research)
	if err != nil {
		http.Error(w, fmt.Sprintf("%v", err), http.StatusBadRequest)
		return
	}

	if strings.TrimSpace(research.Topic) == "" {
		http.Error(w, "topic is required", http.StatusBadRequest)
		return
	}

	research.UserID = authUser.Id

	// Persist the selected language early so the course row exists and has the
	// language even if later steps (e.g. cover image generation) fail or are skipped.
	courseTitle := research.Title
	if strings.TrimSpace(courseTitle) == "" {
		courseTitle = research.Topic
	}
	courseTitle = utils.SanitizeFilename(courseTitle)
	if err := models.SaveCourseLanguage(authUser.Id, courseTitle, research.Language); err != nil {
		http.Error(w, fmt.Sprintf("%v", err), http.StatusInternalServerError)
		return
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

	research.OnChapters = func(chapters []string) {
		sendEvent("chapters", chapters)
	}
	research.OnChapterDone = func(chapter string) {
		sendEvent("chapterDone", chapter)
	}
	research.OnCoverImage = func(phase string, data string) {
		sendEvent("coverImage", map[string]string{"phase": phase, "data": data})
	}

	err = research.Run()
	if err != nil {
		sendEvent("error", fmt.Sprintf("%v", err))
		return
	}

	// the folder is named after the title, so report it for navigation
	name := research.Title
	if strings.TrimSpace(name) == "" {
		name = research.Topic
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

/************************************************************************
* Lists every researched topic stored in the data directory so the
* frontend can render a courses landing page. Supports accumulative
* filtering by search, subject IDs, completion status, year and month.
*********************************************************************/
func GetCourses(w http.ResponseWriter, r *http.Request) {
	var httpResponse models.HttpResponse

	authUser, ok := r.Context().Value(constants.USER_CONTEXT_AUTH_KEY).(*models.AuthUser)
	if !ok {
		httpResponse.Error = "Authentication required"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	courses, err := models.ListCourses(authUser.Id)
	if err != nil {
		httpResponse.Error = fmt.Sprintf("%v", err)
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	q := r.URL.Query()

	search := strings.ToLower(strings.TrimSpace(q.Get("search")))
	if search != "" {
		filtered := make([]models.Course, 0, len(courses))
		for _, c := range courses {
			if strings.Contains(strings.ToLower(c.Name), search) {
				filtered = append(filtered, c)
			}
		}
		courses = filtered
	}

	if rawSubjects := q.Get("subjects"); rawSubjects != "" {
		wanted := parseIntList(rawSubjects)
		if len(wanted) > 0 {
			filtered := make([]models.Course, 0, len(courses))
			for _, c := range courses {
				for _, s := range c.Subjects {
					if containsInt(wanted, s.ID) {
						filtered = append(filtered, c)
						break
					}
				}
			}
			courses = filtered
		}
	}

	if status := strings.ToLower(q.Get("status")); status != "" {
		filtered := make([]models.Course, 0, len(courses))
		for _, c := range courses {
			complete := c.TotalChapters > 0 && c.ReadChapters == c.TotalChapters
			if status == "complete" && complete {
				filtered = append(filtered, c)
			} else if status == "incomplete" && !complete {
				filtered = append(filtered, c)
			}
		}
		courses = filtered
	}

	if rawYears := q.Get("year"); rawYears != "" {
		years := parseIntList(rawYears)
		if len(years) > 0 {
			filtered := make([]models.Course, 0, len(courses))
			for _, c := range courses {
				if containsInt(years, c.CreatedAt.Year()) {
					filtered = append(filtered, c)
				}
			}
			courses = filtered
		}
	}

	if rawMonths := q.Get("month"); rawMonths != "" {
		months := parseIntList(rawMonths)
		if len(months) > 0 {
			filtered := make([]models.Course, 0, len(courses))
			for _, c := range courses {
				if containsInt(months, int(c.CreatedAt.Month())) {
					filtered = append(filtered, c)
				}
			}
			courses = filtered
		}
	}

	httpResponse.Data = courses
	httpResponse.Success = true
	httpResponse.Error = nil
	httpResponse.Send(w)
}

/************************************************************************
* Deletes a user's course and its content folder after confirming the
* authenticated user owns it.
*********************************************************************/
func DeleteCourse(w http.ResponseWriter, r *http.Request) {
	var httpResponse models.HttpResponse

	authUser, ok := r.Context().Value(constants.USER_CONTEXT_AUTH_KEY).(*models.AuthUser)
	if !ok {
		httpResponse.Error = "Authentication required"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	rawID := r.PathValue("id")
	courseID, err := url.PathUnescape(rawID)
	if err != nil {
		httpResponse.Error = "Invalid course id"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	if err := models.DeleteCourse(authUser.Id, courseID); err != nil {
		httpResponse.Error = fmt.Sprintf("%v", err)
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	httpResponse.Success = true
	httpResponse.Error = nil
	httpResponse.Data = nil
	httpResponse.Send(w)
}

/************************************************************************
* Updates a course's title, language, and subjects. If the title changes
* the course folder is renamed and image references are updated to match.
*********************************************************************/
func PutCourse(w http.ResponseWriter, r *http.Request) {
	var httpResponse models.HttpResponse

	authUser, ok := r.Context().Value(constants.USER_CONTEXT_AUTH_KEY).(*models.AuthUser)
	if !ok {
		httpResponse.Error = "Authentication required"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	rawID := r.PathValue("id")
	oldCourseID, err := url.PathUnescape(rawID)
	if err != nil {
		httpResponse.Error = "Invalid course id"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	var requestBody struct {
		Title      string `json:"title"`
		Language   string `json:"language"`
		SubjectIDs []int  `json:"subjectIds"`
	}
	if err := json.NewDecoder(r.Body).Decode(&requestBody); err != nil {
		httpResponse.Error = "Invalid request format"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	if strings.TrimSpace(requestBody.Title) == "" {
		httpResponse.Error = "title is required"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	newCourseID, err := models.UpdateCourse(
		authUser.Id,
		oldCourseID,
		requestBody.Title,
		requestBody.Language,
		requestBody.SubjectIDs,
	)
	if err != nil {
		httpResponse.Error = fmt.Sprintf("%v", err)
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	httpResponse.Data = map[string]interface{}{
		"id":       newCourseID,
		"title":    requestBody.Title,
		"language": requestBody.Language,
	}
	httpResponse.Success = true
	httpResponse.Error = nil
	httpResponse.Send(w)
}

/************************************************************************
* Returns the web-absolute paths of all images stored in a course's images folder
* so the user can pick an existing image as the cover thumbnail.
*********************************************************************/
func GetCourseImages(w http.ResponseWriter, r *http.Request) {
	var httpResponse models.HttpResponse

	authUser, ok := r.Context().Value(constants.USER_CONTEXT_AUTH_KEY).(*models.AuthUser)
	if !ok {
		httpResponse.Error = "Authentication required"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	topic := r.URL.Query().Get("topic")
	if strings.TrimSpace(topic) == "" {
		httpResponse.Error = "topic is required"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	images, err := models.ListCourseImages(authUser.Id, topic)
	if err != nil {
		httpResponse.Error = fmt.Sprintf("%v", err)
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	httpResponse.Data = map[string]interface{}{
		"topic":  topic,
		"images": images,
	}
	httpResponse.Success = true
	httpResponse.Error = nil
	httpResponse.Send(w)
}

/************************************************************************
* Sets the cover image path for a course without generating a new image.
*********************************************************************/
func PutCourseCover(w http.ResponseWriter, r *http.Request) {
	var httpResponse models.HttpResponse

	authUser, ok := r.Context().Value(constants.USER_CONTEXT_AUTH_KEY).(*models.AuthUser)
	if !ok {
		httpResponse.Error = "Authentication required"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	var requestBody struct {
		Topic          string `json:"topic"`
		CoverImagePath string `json:"coverImagePath"`
	}
	if err := json.NewDecoder(r.Body).Decode(&requestBody); err != nil {
		httpResponse.Error = "Invalid request format"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	if strings.TrimSpace(requestBody.Topic) == "" {
		httpResponse.Error = "topic is required"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}
	if strings.TrimSpace(requestBody.CoverImagePath) == "" {
		httpResponse.Error = "coverImagePath is required"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	if err := models.SetCoverImagePath(authUser.Id, requestBody.Topic, requestBody.CoverImagePath); err != nil {
		httpResponse.Error = fmt.Sprintf("%v", err)
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	httpResponse.Data = map[string]interface{}{
		"topic":          requestBody.Topic,
		"coverImagePath": requestBody.CoverImagePath,
	}
	httpResponse.Success = true
	httpResponse.Error = nil
	httpResponse.Send(w)
}

/************************************************************************
* Returns the raw markdown content of a course so it can be edited.
*********************************************************************/
func GetCourseMD(w http.ResponseWriter, r *http.Request) {
	var httpResponse models.HttpResponse

	authUser, ok := r.Context().Value(constants.USER_CONTEXT_AUTH_KEY).(*models.AuthUser)
	if !ok {
		httpResponse.Error = "Authentication required"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	topic := r.URL.Query().Get("topic")
	if strings.TrimSpace(topic) == "" {
		httpResponse.Error = "topic is required"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	research := models.Research{Title: topic, UserID: authUser.Id}
	content, err := research.ReadRawContent()
	if err != nil {
		httpResponse.Error = fmt.Sprintf("%v", err)
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	httpResponse.Data = map[string]interface{}{
		"topic":   topic,
		"content": content,
	}
	httpResponse.Success = true
	httpResponse.Error = nil
	httpResponse.Send(w)
}

/************************************************************************
* Writes the edited markdown content back to the course folder as content.md.
*********************************************************************/
func PutCourseMD(w http.ResponseWriter, r *http.Request) {
	var httpResponse models.HttpResponse

	authUser, ok := r.Context().Value(constants.USER_CONTEXT_AUTH_KEY).(*models.AuthUser)
	if !ok {
		httpResponse.Error = "Authentication required"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	var requestBody struct {
		Topic   string `json:"topic"`
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&requestBody); err != nil {
		httpResponse.Error = "Invalid request format"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	if strings.TrimSpace(requestBody.Topic) == "" {
		httpResponse.Error = "topic is required"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	research := models.Research{Title: requestBody.Topic, UserID: authUser.Id}
	if err := research.WriteRawContent(requestBody.Content); err != nil {
		httpResponse.Error = fmt.Sprintf("%v", err)
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	httpResponse.Data = map[string]interface{}{
		"topic":   requestBody.Topic,
		"content": requestBody.Content,
	}
	httpResponse.Success = true
	httpResponse.Error = nil
	httpResponse.Send(w)
}

/************************************************************************
* Returns the saved text highlights for a course.
*********************************************************************/
func GetCourseHighlights(w http.ResponseWriter, r *http.Request) {
	var httpResponse models.HttpResponse

	authUser, ok := r.Context().Value(constants.USER_CONTEXT_AUTH_KEY).(*models.AuthUser)
	if !ok {
		httpResponse.Error = "Authentication required"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	topic := r.URL.Query().Get("topic")
	if strings.TrimSpace(topic) == "" {
		httpResponse.Error = "topic is required"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	highlights, err := models.ReadHighlights(authUser.Id, topic)
	if err != nil {
		httpResponse.Error = fmt.Sprintf("%v", err)
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	httpResponse.Data = map[string]interface{}{
		"topic":      topic,
		"highlights": highlights,
	}
	httpResponse.Success = true
	httpResponse.Error = nil
	httpResponse.Send(w)
}

/************************************************************************
* Saves the text highlights for a course.
*********************************************************************/
func PutCourseHighlights(w http.ResponseWriter, r *http.Request) {
	var httpResponse models.HttpResponse

	authUser, ok := r.Context().Value(constants.USER_CONTEXT_AUTH_KEY).(*models.AuthUser)
	if !ok {
		httpResponse.Error = "Authentication required"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	var requestBody struct {
		Topic      string                `json:"topic"`
		Highlights []models.Highlight    `json:"highlights"`
	}
	if err := json.NewDecoder(r.Body).Decode(&requestBody); err != nil {
		httpResponse.Error = "Invalid request format"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	if strings.TrimSpace(requestBody.Topic) == "" {
		httpResponse.Error = "topic is required"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	if err := models.WriteHighlights(authUser.Id, requestBody.Topic, requestBody.Highlights); err != nil {
		httpResponse.Error = fmt.Sprintf("%v", err)
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	httpResponse.Data = map[string]interface{}{
		"topic":      requestBody.Topic,
		"highlights": requestBody.Highlights,
	}
	httpResponse.Success = true
	httpResponse.Error = nil
	httpResponse.Send(w)
}

/************************************************************************
* Serves the assembled markdown content of a previously researched topic.
*********************************************************************/
func GetTopic(w http.ResponseWriter, r *http.Request) {
	var httpResponse models.HttpResponse

	authUser, ok := r.Context().Value(constants.USER_CONTEXT_AUTH_KEY).(*models.AuthUser)
	if !ok {
		httpResponse.Error = "Authentication required"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	name := r.URL.Query().Get("name")
	if strings.TrimSpace(name) == "" {
		httpResponse.Error = "topic name is required"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	research := models.Research{Title: name, UserID: authUser.Id}
	content, err := research.ReadContent()
	if err != nil {
		httpResponse.Error = fmt.Sprintf("%v", err)
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	httpResponse.Data = map[string]interface{}{
		"topic":          name,
		"content":        content,
		"coverImagePath": models.GetCoverImagePath(authUser.Id, name),
		"language":       models.GetCourseLanguage(authUser.Id, name),
	}
	httpResponse.Success = true
	httpResponse.Error = nil
	httpResponse.Send(w)
}

/************************************************************************
* Generates a summarizing image for a single chapter of a topic and
* returns the freshly assembled markdown content (which now references
* the new image) so the reader can see it.
*********************************************************************/
func ChapterImage(w http.ResponseWriter, r *http.Request) {
	var httpResponse models.HttpResponse

	authUser, ok := r.Context().Value(constants.USER_CONTEXT_AUTH_KEY).(*models.AuthUser)
	if !ok {
		httpResponse.Error = "Authentication required"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	var requestBody struct {
		Topic   string `json:"topic"`
		Chapter string `json:"chapter"`
	}

	err := json.NewDecoder(r.Body).Decode(&requestBody)
	if err != nil {
		httpResponse.Error = "Invalid request format"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	if strings.TrimSpace(requestBody.Topic) == "" || strings.TrimSpace(requestBody.Chapter) == "" {
		httpResponse.Error = "topic and chapter are required"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	research := models.Research{Title: requestBody.Topic, UserID: authUser.Id}
	err = research.GenerateChapterImage(requestBody.Chapter)
	if err != nil {
		httpResponse.Error = fmt.Sprintf("%v", err)
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	content, err := research.ReadContent()
	if err != nil {
		httpResponse.Error = fmt.Sprintf("%v", err)
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	httpResponse.Data = map[string]interface{}{
		"topic":   requestBody.Topic,
		"content": content,
	}
	httpResponse.Success = true
	httpResponse.Error = nil
	httpResponse.Send(w)
}

/************************************************************************
* Generates a new cover image for an existing course without removing the
* previous cover image file. The new path is returned in the response.
*********************************************************************/
func CreateCourseCoverImage(w http.ResponseWriter, r *http.Request) {
	var httpResponse models.HttpResponse

	authUser, ok := r.Context().Value(constants.USER_CONTEXT_AUTH_KEY).(*models.AuthUser)
	if !ok {
		httpResponse.Error = "Authentication required"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	var requestBody struct {
		Topic string `json:"topic"`
	}
	if err := json.NewDecoder(r.Body).Decode(&requestBody); err != nil {
		httpResponse.Error = "Invalid request format"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	if strings.TrimSpace(requestBody.Topic) == "" {
		httpResponse.Error = "topic is required"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	coverPath, err := models.GenerateCoverImageForCourse(authUser.Id, requestBody.Topic)
	if err != nil {
		httpResponse.Error = fmt.Sprintf("%v", err)
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	httpResponse.Data = map[string]interface{}{
		"topic":          requestBody.Topic,
		"coverImagePath": coverPath,
	}
	httpResponse.Success = true
	httpResponse.Error = nil
	httpResponse.Send(w)
}

/************************************************************************
* Returns the list of chapters that have been marked as read for a user's course.
*********************************************************************/
func GetReadingProgress(w http.ResponseWriter, r *http.Request) {
	var httpResponse models.HttpResponse

	authUser, ok := r.Context().Value(constants.USER_CONTEXT_AUTH_KEY).(*models.AuthUser)
	if !ok {
		httpResponse.Error = "Authentication required"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	course := r.URL.Query().Get("course")
	if strings.TrimSpace(course) == "" {
		httpResponse.Error = "course is required"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	chapters, err := models.GetReadChapters(authUser.Id, course)
	if err != nil {
		httpResponse.Error = fmt.Sprintf("%v", err)
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	httpResponse.Data = chapters
	httpResponse.Success = true
	httpResponse.Error = nil
	httpResponse.Send(w)
}

/************************************************************************
* Marks a chapter as read or unread for a user's course.
*********************************************************************/
func PostReadingProgress(w http.ResponseWriter, r *http.Request) {
	var httpResponse models.HttpResponse

	authUser, ok := r.Context().Value(constants.USER_CONTEXT_AUTH_KEY).(*models.AuthUser)
	if !ok {
		httpResponse.Error = "Authentication required"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	var requestBody struct {
		Course  string `json:"course"`
		Chapter string `json:"chapter"`
		Read    bool   `json:"read"`
	}

	err := json.NewDecoder(r.Body).Decode(&requestBody)
	if err != nil {
		httpResponse.Error = "Invalid request format"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	if strings.TrimSpace(requestBody.Course) == "" || strings.TrimSpace(requestBody.Chapter) == "" {
		httpResponse.Error = "course and chapter are required"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	err = models.SaveReadingProgress(authUser.Id, requestBody.Course, requestBody.Chapter, requestBody.Read)
	if err != nil {
		httpResponse.Error = fmt.Sprintf("%v", err)
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	httpResponse.Data = map[string]bool{"read": requestBody.Read}
	httpResponse.Success = true
	httpResponse.Error = nil
	httpResponse.Send(w)
}

/************************************************************************
* ReadingProgressHandler dispatches GET and POST requests for the reading
* progress endpoint.
*********************************************************************/
func ReadingProgressHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		GetReadingProgress(w, r)
		return
	}
	if r.Method == http.MethodPost {
		PostReadingProgress(w, r)
		return
	}
	http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
}

/************************************************************************
* Lists all subjects for the authenticated user.
*********************************************************************/
func GetSubjects(w http.ResponseWriter, r *http.Request) {
	var httpResponse models.HttpResponse

	authUser, ok := r.Context().Value(constants.USER_CONTEXT_AUTH_KEY).(*models.AuthUser)
	if !ok {
		httpResponse.Error = "Authentication required"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	subjects, err := models.ListSubjects(authUser.Id)
	if err != nil {
		httpResponse.Error = fmt.Sprintf("%v", err)
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	httpResponse.Data = subjects
	httpResponse.Success = true
	httpResponse.Error = nil
	httpResponse.Send(w)
}

/************************************************************************
* Creates a new subject for the authenticated user.
*********************************************************************/
func PostSubjects(w http.ResponseWriter, r *http.Request) {
	var httpResponse models.HttpResponse

	authUser, ok := r.Context().Value(constants.USER_CONTEXT_AUTH_KEY).(*models.AuthUser)
	if !ok {
		httpResponse.Error = "Authentication required"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	var subject models.Subject
	err := json.NewDecoder(r.Body).Decode(&subject)
	if err != nil {
		httpResponse.Error = "Invalid request format"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	err = subject.Create(authUser.Id)
	if err != nil {
		httpResponse.Error = fmt.Sprintf("%v", err)
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	httpResponse.Data = map[string]string{"message": "Subject created"}
	httpResponse.Success = true
	httpResponse.Error = nil
	httpResponse.Send(w)
}

/************************************************************************
* Returns the subjects attached to a course for the authenticated user.
*********************************************************************/
func GetCourseSubjects(w http.ResponseWriter, r *http.Request) {
	var httpResponse models.HttpResponse

	authUser, ok := r.Context().Value(constants.USER_CONTEXT_AUTH_KEY).(*models.AuthUser)
	if !ok {
		httpResponse.Error = "Authentication required"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	course := r.URL.Query().Get("course")
	if strings.TrimSpace(course) == "" {
		httpResponse.Error = "course is required"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	subjects, err := models.GetCourseSubjects(authUser.Id, course)
	if err != nil {
		httpResponse.Error = fmt.Sprintf("%v", err)
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	httpResponse.Data = subjects
	httpResponse.Success = true
	httpResponse.Error = nil
	httpResponse.Send(w)
}

/************************************************************************
* Sets the subjects attached to a course.
*********************************************************************/
func PostCourseSubjects(w http.ResponseWriter, r *http.Request) {
	var httpResponse models.HttpResponse

	authUser, ok := r.Context().Value(constants.USER_CONTEXT_AUTH_KEY).(*models.AuthUser)
	if !ok {
		httpResponse.Error = "Authentication required"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	var requestBody struct {
		Course     string `json:"course"`
		SubjectIDs []int  `json:"subjectIds"`
	}
	err := json.NewDecoder(r.Body).Decode(&requestBody)
	if err != nil {
		httpResponse.Error = "Invalid request format"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	if strings.TrimSpace(requestBody.Course) == "" {
		httpResponse.Error = "course is required"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	err = models.SetCourseSubjects(authUser.Id, requestBody.Course, requestBody.SubjectIDs)
	if err != nil {
		httpResponse.Error = fmt.Sprintf("%v", err)
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	httpResponse.Data = map[string]string{"message": "Course subjects updated"}
	httpResponse.Success = true
	httpResponse.Error = nil
	httpResponse.Send(w)
}

/************************************************************************
* Updates an existing subject for the authenticated user.
*********************************************************************/
func PutSubject(w http.ResponseWriter, r *http.Request) {
	var httpResponse models.HttpResponse

	authUser, ok := r.Context().Value(constants.USER_CONTEXT_AUTH_KEY).(*models.AuthUser)
	if !ok {
		httpResponse.Error = "Authentication required"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		httpResponse.Error = "invalid subject id"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	var subject models.Subject
	if err := json.NewDecoder(r.Body).Decode(&subject); err != nil {
		httpResponse.Error = "Invalid request format"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}
	subject.ID = id

	if err := subject.Update(authUser.Id); err != nil {
		httpResponse.Error = fmt.Sprintf("%v", err)
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	httpResponse.Data = map[string]string{"message": "Subject updated"}
	httpResponse.Success = true
	httpResponse.Error = nil
	httpResponse.Send(w)
}

/************************************************************************
* Deletes a subject for the authenticated user.
*********************************************************************/
func DeleteSubject(w http.ResponseWriter, r *http.Request) {
	var httpResponse models.HttpResponse

	authUser, ok := r.Context().Value(constants.USER_CONTEXT_AUTH_KEY).(*models.AuthUser)
	if !ok {
		httpResponse.Error = "Authentication required"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		httpResponse.Error = "invalid subject id"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	subject := models.Subject{ID: id}
	if err := subject.Delete(authUser.Id); err != nil {
		httpResponse.Error = fmt.Sprintf("%v", err)
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	httpResponse.Data = map[string]string{"message": "Subject deleted"}
	httpResponse.Success = true
	httpResponse.Error = nil
	httpResponse.Send(w)
}

/************************************************************************
* SubjectsHandler dispatches GET and POST requests for the subjects endpoint.
*********************************************************************/
func SubjectsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		GetSubjects(w, r)
		return
	}
	if r.Method == http.MethodPost {
		PostSubjects(w, r)
		return
	}
	http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
}

/************************************************************************
* CourseSubjectsHandler dispatches GET and POST requests for the course
* subjects endpoint.
*********************************************************************/
func CourseSubjectsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		GetCourseSubjects(w, r)
		return
	}
	if r.Method == http.MethodPost {
		PostCourseSubjects(w, r)
		return
	}
	http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
}

/************************************************************************
* Handles login
*
* status: ✅
************************************************************************/
func Login(w http.ResponseWriter, r *http.Request){
	var httpResponse models.HttpResponse
	var user models.User

	err := user.RequestToStruct(r.Body)

	if err != nil {
		httpResponse.Error = fmt.Sprintf("%v", err)
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	token, err := user.Login()

	if err != nil {
		httpResponse.Error = fmt.Sprintf("%v", err)
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	data := map[string]interface{}{
		"AuthToken": token,
		"User": user,
	}

	httpResponse.Data = data
	httpResponse.Success = true
	httpResponse.Error = nil
	httpResponse.Send(w)
}

/************************************************************************
* Handles signup
*
* status: ✅
************************************************************************/
func Signup(w http.ResponseWriter, r *http.Request){
	var httpResponse models.HttpResponse
	var user models.User

	err := user.RequestToStruct(r.Body)

	if err != nil {
		httpResponse.Error = fmt.Sprintf("%v", err)
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	token, err := user.Signup()

	if err != nil {
		httpResponse.Error = fmt.Sprintf("%v", err)
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	data := map[string]interface{}{
		"AuthToken": token,
		"User": user,
	}


	httpResponse.Success = false
	httpResponse.Data = data
	httpResponse.Error = nil
	httpResponse.Send(w)
}

/************************************************************************
* Handles email verification
*
* status: ✅
************************************************************************/
func VerifyEmail(w http.ResponseWriter, r *http.Request){
	var httpResponse models.HttpResponse
	var user models.User

	// Create struct to receive the code
	var requestBody struct {
		Code string `json:"code"`
	}

	err := json.NewDecoder(r.Body).Decode(&requestBody)
	if err != nil {
		httpResponse.Error = "Invalid request format"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	if len(requestBody.Code) == 0 {
		httpResponse.Error = "verification code is required"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	token, err := user.VerifyEmail(requestBody.Code)

	if err != nil {
		httpResponse.Error = fmt.Sprintf("%v", err)
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	data := map[string]interface{}{
		"AuthToken": token,
		"User": user,
	}

	httpResponse.Data = data
	httpResponse.Success = true
	httpResponse.Error = nil
	httpResponse.Send(w)
}

/************************************************************************
* Handles forgot password functionality by sending a temporary password
* to the user's email address. The user can then use this temporary
* password to log in and change their password.
*
* status: ✅
************************************************************************/
func ForgotPassword(w http.ResponseWriter, r *http.Request){
	var httpResponse models.HttpResponse
	var user models.User

	err := user.ForgotPassword(r.Body)

	if err != nil {
		httpResponse.Error = fmt.Sprintf("%v", err)
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	httpResponse.Data = map[string]string{
		"message": "Password reset email sent successfully",
	}
	httpResponse.Success = true
	httpResponse.Error = nil
	httpResponse.Send(w)
}

/************************************************************************
* Handles password change functionality. Requires authentication and
* current password verification before allowing the user to set a new password.
*
* status: ✅
************************************************************************/
func ChangePassword(w http.ResponseWriter, r *http.Request){
	var httpResponse models.HttpResponse
	var user models.User

	// Get authenticated user from context
	authUser, ok := r.Context().Value(constants.USER_CONTEXT_AUTH_KEY).(*models.AuthUser)
	if !ok {
		httpResponse.Error = "Authentication required"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	err := user.ChangePassword(r.Body, authUser.Id)

	if err != nil {
		httpResponse.Error = fmt.Sprintf("%v", err)
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	httpResponse.Data = map[string]string{
		"message": "Password changed successfully",
	}
	httpResponse.Success = true
	httpResponse.Error = nil
	httpResponse.Send(w)
}

/************************************************************************
* Updates user profile (first name, last name, username, email, avatar)
* status: ✅
************************************************************************/
func UpdateProfile(w http.ResponseWriter, r *http.Request){
	var httpResponse models.HttpResponse
	var user models.User

	// Parse request body
	err := user.RequestToStruct(r.Body)
	if err != nil {
		httpResponse.Error = fmt.Sprintf("Invalid request data: %v", err)
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	// Get authenticated user from context
	authUser, ok := r.Context().Value(constants.USER_CONTEXT_AUTH_KEY).(*models.AuthUser)
	if !ok {
		httpResponse.Error = "Authentication required"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	// Preserve existing values if not provided in the request
	if user.FirstName == "" {
		user.FirstName = authUser.FirstName
	}
	if user.LastName == "" {
		user.LastName = authUser.LastName
	}
	if user.Username == "" {
		user.Username = authUser.Username
	}
	if user.Email == "" {
		user.Email = authUser.Email
	}
	if user.Avatar == "" {
		user.Avatar = authUser.Avatar
	}

	// Call the Update method from the user model
	err = user.Update(authUser.Id)
	if err != nil {
		httpResponse.Error = fmt.Sprintf("%v", err)
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	// Generate a new token with the updated profile data
	updatedAuthUser := models.AuthUser{
		FirstName: user.FirstName,
		LastName:  user.LastName,
		Username:  user.Username,
		Email:     user.Email,
		Avatar:    user.Avatar,
		Status:    authUser.Status,
		Id:        authUser.Id,
	}
	token, err := updatedAuthUser.GenerateJWT()
	if err != nil {
		httpResponse.Error = fmt.Sprintf("%v", err)
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	httpResponse.Data = map[string]interface{}{
		"AuthToken": token,
		"User":      user,
	}
	httpResponse.Success = true
	httpResponse.Error = nil
	httpResponse.Send(w)
}


/************************************************************************
* Dispatches chat requests to the correct method handler.
************************************************************************/
func ChatHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		GetChatMessages(w, r)
	case http.MethodPost:
		CreateChatMessage(w, r)
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

/************************************************************************
* Returns all chat messages for a course in chronological order.
************************************************************************/
func GetChatMessages(w http.ResponseWriter, r *http.Request) {
	var httpResponse models.HttpResponse

	authUser, ok := r.Context().Value(constants.USER_CONTEXT_AUTH_KEY).(*models.AuthUser)
	if !ok {
		httpResponse.Error = "Authentication required"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	course := strings.TrimSpace(r.URL.Query().Get("course"))
	if course == "" {
		httpResponse.Error = "course is required"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	messages, err := models.GetChatMessagesByCourse(authUser.Id, course)
	if err != nil {
		httpResponse.Error = fmt.Sprintf("%v", err)
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	httpResponse.Data = messages
	httpResponse.Success = true
	httpResponse.Error = nil
	httpResponse.Send(w)
}

/************************************************************************
* Saves a user chat message and returns the AI assistant's response.
************************************************************************/
func CreateChatMessage(w http.ResponseWriter, r *http.Request) {
	var httpResponse models.HttpResponse

	authUser, ok := r.Context().Value(constants.USER_CONTEXT_AUTH_KEY).(*models.AuthUser)
	if !ok {
		httpResponse.Error = "Authentication required"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	var payload struct {
		Course  string `json:"course"`
		Chapter string `json:"chapter"`
		Content string `json:"content"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		httpResponse.Error = "Invalid request data"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	if payload.Course == "" || payload.Content == "" {
		httpResponse.Error = "course and content are required"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	if payload.Chapter == "" {
		payload.Chapter = "generic"
	}

	msg, err := models.AskChat(authUser.Id, payload.Course, payload.Chapter, payload.Content)
	if err != nil {
		httpResponse.Error = fmt.Sprintf("%v", err)
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	httpResponse.Data = msg
	httpResponse.Success = true
	httpResponse.Error = nil
	httpResponse.Send(w)
}

func parseIntList(s string) []int {
	parts := strings.Split(s, ",")
	out := make([]int, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		if n, err := strconv.Atoi(p); err == nil {
			out = append(out, n)
		}
	}
	return out
}

func containsInt(list []int, value int) bool {
	for _, v := range list {
		if v == value {
			return true
		}
	}
	return false
}


/************************************************************************
* Transform accepts images, PDFs or raw text and converts them into a
* single audiobook MP3. Progress is streamed back as Server-Sent Events.
*********************************************************************/
func Transform(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	req, err := models.NewAudiobookRequestFromHTTP(r)
	if err != nil {
		http.Error(w, fmt.Sprintf("%v", err), http.StatusBadRequest)
		return
	}

	originalText := req.Text

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}

	sendEvent := func(event string, data interface{}) {
		payload, _ := json.Marshal(data)
		fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event, payload)
		flusher.Flush()
	}

	language := interface{}(nil)
	if req.Language != "" {
		language = req.Language
	}

	sendEvent("status", map[string]interface{}{
		"requestId": req.RequestID,
		"status":    "started",
		"bookTitle": req.BookTitle,
		"voice":     req.Voice,
		"language":  language,
		"hasText":   originalText != "",
		"fileCount": len(req.Files),
	})

	req.OnProgress = func(step, totalSteps, progress int, message string, current *models.StepProgress) {
		sendEvent("progress", map[string]interface{}{
			"step":             step,
			"totalSteps":       totalSteps,
			"progress":         progress,
			"message":          message,
			"currentStepProcess": current,
		})
	}

	result, err := req.Run()
	if err != nil {
		req.Cleanup()
		sendEvent("error", map[string]string{"message": fmt.Sprintf("%v", err)})
		return
	}

	sendEvent("complete", result)
}

/************************************************************************
* DownloadAudiobook serves the generated MP3 file for a finished transform.
*********************************************************************/
func DownloadAudiobook(w http.ResponseWriter, r *http.Request) {
	requestID := r.PathValue("requestId")
	filename := r.PathValue("filename")
	if requestID == "" || filename == "" {
		http.Error(w, "requestId and filename are required", http.StatusBadRequest)
		return
	}

	requestID = filepath.Base(requestID)
	filename = filepath.Base(filename)

	filePath := filepath.Join("src", "content", "api_requests", requestID, "done", filename, filename+".mp3")
	info, err := os.Stat(filePath)
	if err != nil {
		http.Error(w, "file not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "audio/mpeg")
	w.Header().Set("Content-Length", strconv.FormatInt(info.Size(), 10))
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s.mp3\"", filename))
	http.ServeFile(w, r, filePath)
}
