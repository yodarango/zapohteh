package api

import (
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"zapohteh/constants"
	"zapohteh/internal/models"
)

/************************************************************************
* Enables the public share link for a course and returns its token. The link
* is stable: sharing an already shared course returns the existing token.
*********************************************************************/
func ShareCourse(w http.ResponseWriter, r *http.Request) {
	var httpResponse models.HttpResponse

	authUser, ok := r.Context().Value(constants.USER_CONTEXT_AUTH_KEY).(*models.AuthUser)
	if !ok {
		httpResponse.Error = "Authentication required"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	courseID, err := url.PathUnescape(r.PathValue("id"))
	if err != nil || strings.TrimSpace(courseID) == "" {
		httpResponse.Error = "Invalid course id"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	token, err := models.EnableCourseShare(authUser.Id, courseID)
	if err != nil {
		httpResponse.Error = fmt.Sprintf("%v", err)
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	httpResponse.Data = map[string]string{"shareToken": token}
	httpResponse.Success = true
	httpResponse.Error = nil
	httpResponse.Send(w)
}

/************************************************************************
* Disables the public share link for a course. Anyone holding the old link
* gets an error from then on.
*********************************************************************/
func UnshareCourse(w http.ResponseWriter, r *http.Request) {
	var httpResponse models.HttpResponse

	authUser, ok := r.Context().Value(constants.USER_CONTEXT_AUTH_KEY).(*models.AuthUser)
	if !ok {
		httpResponse.Error = "Authentication required"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	courseID, err := url.PathUnescape(r.PathValue("id"))
	if err != nil || strings.TrimSpace(courseID) == "" {
		httpResponse.Error = "Invalid course id"
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	if err := models.DisableCourseShare(authUser.Id, courseID); err != nil {
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
* Serves a shared lesson publicly, without requiring authentication: the
* assembled markdown content, cover image, language and notes of the single
* course the share token belongs to, and nothing else.
*********************************************************************/
func GetSharedLesson(w http.ResponseWriter, r *http.Request) {
	var httpResponse models.HttpResponse

	shared, err := models.GetSharedCourse(r.PathValue("token"))
	if err != nil {
		httpResponse.Error = fmt.Sprintf("%v", err)
		httpResponse.Success = false
		httpResponse.Data = nil
		httpResponse.Send(w)
		return
	}

	httpResponse.Data = shared
	httpResponse.Success = true
	httpResponse.Error = nil
	httpResponse.Send(w)
}
