package api

import (
	"encoding/json"
	"net/http"
	"strings"

	"zapohteh/constants"
	"zapohteh/internal/models"
)

func filterLibrary(items []models.Course, kind string) []models.Course {
	if kind != "courses" && kind != "virtuals" {
		return items
	}
	filtered := make([]models.Course, 0, len(items))
	for _, item := range items {
		if models.IsVirtualSource(item.Source) == (kind == "virtuals") {
			filtered = append(filtered, item)
		}
	}
	return filtered
}

func VirtualCheckpointHandler(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(constants.USER_CONTEXT_AUTH_KEY).(*models.AuthUser)
	if !ok {
		sendJobResponse(w, http.StatusUnauthorized, nil, "Authentication required")
		return
	}
	topic := r.URL.Query().Get("topic")
	ownerID, courseID, _, err := models.ResolveCourseAccess(user.Id, topic)
	if err != nil {
		sendJobResponse(w, http.StatusNotFound, nil, "Virtual not found")
		return
	}
	source, err := models.CourseSourceByID(courseID)
	if err != nil || !models.IsVirtualSource(source) {
		sendJobResponse(w, http.StatusNotFound, nil, "Virtual not found")
		return
	}
	if r.Method == http.MethodGet {
		checkpoint, err := models.GetVirtualCheckpoint(user.Id, courseID)
		if err != nil {
			sendJobResponse(w, http.StatusInternalServerError, nil, "Could not load reading checkpoint")
			return
		}
		sendJobResponse(w, http.StatusOK, checkpoint, "")
		return
	}
	var checkpoint models.VirtualCheckpoint
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&checkpoint); err != nil ||
		checkpoint.WordIndex < 0 || checkpoint.WordCount <= checkpoint.WordIndex || !strings.HasPrefix(checkpoint.Revision, "v1-") {
		sendJobResponse(w, http.StatusBadRequest, nil, "Invalid reading checkpoint")
		return
	}
	research := models.Research{Title: topic, UserID: ownerID}
	content, contentErr := research.ReadContent()
	bibliography, bibliographyErr := research.ReadBibliography()
	if contentErr != nil || bibliographyErr != nil {
		sendJobResponse(w, http.StatusInternalServerError, nil, "Could not verify the Virtual document")
		return
	}
	if checkpoint.Revision != models.ContentRevision(content, bibliography) {
		sendJobResponse(w, http.StatusConflict, nil, "This document changed. Reload it before setting a checkpoint.")
		return
	}
	if err := models.SaveVirtualCheckpoint(user.Id, courseID, checkpoint); err != nil {
		sendJobResponse(w, http.StatusInternalServerError, nil, "Could not save reading checkpoint")
		return
	}
	sendJobResponse(w, http.StatusOK, checkpoint, "")
}
