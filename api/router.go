package api

import (
	"encoding/json"
	"fmt"
	"goilerplate/constants"
	"goilerplate/internal/models"
	"goilerplate/internal/utils"
	"net/http"
	"os"
	"strings"
)

func Router () http.Handler {

	mux := http.NewServeMux()

	mux.HandleFunc(constants.ROUTE_GET_AUTH_SAMPLE, models.Authenticate(SampleAuth))
	mux.HandleFunc(constants.ROUTE_GET_PUBLIC_SAMPLE, SamplePub)
	mux.HandleFunc(constants.ROUTE_POST_LEARN_ABOUT, LearnAbout)
	mux.HandleFunc(constants.ROUTE_GET_TOPIC, GetTopic)
	mux.HandleFunc(constants.ROUTE_GET_COURSES, GetCourses)
	mux.HandleFunc(constants.ROUTE_POST_CHAPTER_IMAGE, ChapterImage)
	mux.HandleFunc(constants.ROUTE_GET_READING_PROGRESS, ReadingProgressHandler)
	mux.HandleFunc(constants.ROUTE_GET_SUBJECTS, SubjectsHandler)
	mux.HandleFunc(constants.ROUTE_GET_COURSE_SUBJECTS, CourseSubjectsHandler)

	// serve generated research data (e.g. chapter images) from the data directory
	mux.Handle(
		constants.ROUTE_DATA_FILES,
		http.StripPrefix(constants.ROUTE_DATA_FILES, http.FileServer(http.Dir("data"))),
	)

	// auth routes (no authentication required)
	mux.HandleFunc(constants.ROUTE_POST_CHANGE_PASSWORD, models.Authenticate(ChangePassword))
	mux.HandleFunc(constants.ROUTE_POST_UPDATE_PROFILE, models.Authenticate(UpdateProfile))
	mux.HandleFunc(constants.ROUTE_POST_FORGOT_PASSWORD, ForgotPassword)
	mux.HandleFunc(constants.ROUTE_POST_VERIFY_EMAIL, VerifyEmail)
	mux.HandleFunc(constants.ROUTE_POST_SIGNUP, Signup)
	mux.HandleFunc(constants.ROUTE_POST_LOGIN, Login)


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

	if len(research.SubjectIDs) == 0 {
		http.Error(w, "at least one subject is required", http.StatusBadRequest)
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

	// attach the selected subjects to the newly created course
	if err := models.SetCourseSubjects(name, research.SubjectIDs); err != nil {
		sendEvent("error", fmt.Sprintf("%v", err))
		return
	}

	sendEvent("done", map[string]string{"topic": name})
}

/************************************************************************
* Lists every researched topic stored in the data directory so the
* frontend can render a courses landing page.
*********************************************************************/
func GetCourses(w http.ResponseWriter, r *http.Request) {
	var httpResponse models.HttpResponse

	courses, err := models.ListCourses()
	if err != nil {
		httpResponse.Error = fmt.Sprintf("%v", err)
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	search := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("search")))
	if search != "" {
		filtered := make([]models.Course, 0, len(courses))
		for _, c := range courses {
			if strings.Contains(strings.ToLower(c.Name), search) {
				filtered = append(filtered, c)
			}
		}
		courses = filtered
	}

	httpResponse.Data = courses
	httpResponse.Success = true
	httpResponse.Error = nil
	httpResponse.Send(w)
}

/************************************************************************
* Serves the assembled markdown content of a previously researched topic.
*********************************************************************/
func GetTopic(w http.ResponseWriter, r *http.Request) {
	var httpResponse models.HttpResponse

	name := r.URL.Query().Get("name")
	if strings.TrimSpace(name) == "" {
		httpResponse.Error = "topic name is required"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	research := models.Research{Title: name}
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
		"coverImagePath": models.GetCoverImagePath(name),
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

	research := models.Research{Title: requestBody.Topic}
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
* Returns the list of chapters that have been marked as read for a course.
*********************************************************************/
func GetReadingProgress(w http.ResponseWriter, r *http.Request) {
	var httpResponse models.HttpResponse

	course := r.URL.Query().Get("course")
	if strings.TrimSpace(course) == "" {
		httpResponse.Error = "course is required"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	chapters, err := models.GetReadChapters(course)
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
* Marks a chapter as read or unread for a course.
*********************************************************************/
func PostReadingProgress(w http.ResponseWriter, r *http.Request) {
	var httpResponse models.HttpResponse

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

	err = models.SaveReadingProgress(requestBody.Course, requestBody.Chapter, requestBody.Read)
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
* Lists all subjects.
*********************************************************************/
func GetSubjects(w http.ResponseWriter, r *http.Request) {
	var httpResponse models.HttpResponse

	subjects, err := models.ListSubjects()
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
* Creates a new subject.
*********************************************************************/
func PostSubjects(w http.ResponseWriter, r *http.Request) {
	var httpResponse models.HttpResponse

	var subject models.Subject
	err := json.NewDecoder(r.Body).Decode(&subject)
	if err != nil {
		httpResponse.Error = "Invalid request format"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	err = subject.Create()
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
* Returns the subjects attached to a course.
*********************************************************************/
func GetCourseSubjects(w http.ResponseWriter, r *http.Request) {
	var httpResponse models.HttpResponse

	course := r.URL.Query().Get("course")
	if strings.TrimSpace(course) == "" {
		httpResponse.Error = "course is required"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	subjects, err := models.GetCourseSubjects(course)
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

	err = models.SetCourseSubjects(requestBody.Course, requestBody.SubjectIDs)
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
* Updates user profile (first name and last name)
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

	// Call the Update method from the user model
	err = user.Update(authUser.Id)
	if err != nil {
		httpResponse.Error = fmt.Sprintf("%v", err)
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	httpResponse.Data = map[string]string{
		"message": "Profile updated successfully",
	}
	httpResponse.Success = true
	httpResponse.Error = nil
	httpResponse.Send(w)
}
