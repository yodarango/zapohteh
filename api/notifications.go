package api

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"zapohteh/constants"
	"zapohteh/internal/models"
)

type inboxNotification struct {
	ID               int64  `json:"id"`
	Type             string `json:"type"`
	JobID            *int64 `json:"jobId"`
	InvitationID     *int64 `json:"invitationId"`
	CourseTitle      string `json:"courseTitle"`
	CourseAvailable  bool   `json:"courseAvailable"`
	ActorUsername    string `json:"actorUsername"`
	InvitationStatus string `json:"invitationStatus"`
	Read             bool   `json:"read"`
	Archived         bool   `json:"archived"`
	CreatedAt        string `json:"createdAt"`
}

func ListNotifications(w http.ResponseWriter, r *http.Request) {
	user := r.Context().Value(constants.USER_CONTEXT_AUTH_KEY).(*models.AuthUser)
	view, kind := r.URL.Query().Get("view"), r.URL.Query().Get("type")
	if view == "" {
		view = "all"
	}
	if kind == "" {
		kind = "all"
	}
	if (view != "all" && view != "unread" && view != "archived") || (kind != "all" && kind != "course" && kind != "invitation") {
		sendJobResponse(w, 400, nil, "Invalid notification filter")
		return
	}
	before := int64(0)
	if value := r.URL.Query().Get("before"); value != "" {
		var err error
		before, err = strconv.ParseInt(value, 10, 64)
		if err != nil || before <= 0 {
			sendJobResponse(w, 400, nil, "Invalid pagination cursor")
			return
		}
	}
	query := `SELECT n.id,n.type,n.job_id,n.invitation_id,COALESCE(c.title,n.course_title),
		CASE WHEN c.id IS NOT NULL AND (n.type <> 'course_succeeded' OR c.user_id=n.user_id) THEN 1 ELSE 0 END,
		n.actor_username,n.invitation_status,n.read_at IS NOT NULL,n.archived_at IS NOT NULL,n.created_at
		FROM notifications n LEFT JOIN courses c ON c.id=n.course_id WHERE n.user_id=?`
	args := []interface{}{user.Id}
	if view == "archived" {
		query += ` AND n.archived_at IS NOT NULL`
	} else {
		query += ` AND n.archived_at IS NULL`
		if view == "unread" {
			query += ` AND n.read_at IS NULL`
		}
	}
	if kind == "course" {
		query += ` AND n.type IN ('course_succeeded','course_failed','course_interrupted')`
	} else if kind == "invitation" {
		query += ` AND n.type='invitation'`
	}
	if before > 0 {
		query += ` AND n.id < ?`
		args = append(args, before)
	}
	query += ` ORDER BY n.id DESC LIMIT 31`
	rows, err := RouterConfig.DB.Conn.Query(query, args...)
	if err != nil {
		sendJobResponse(w, 500, nil, "Could not load notifications")
		return
	}
	defer rows.Close()
	items := []inboxNotification{}
	for rows.Next() {
		var n inboxNotification
		var jobID, invitationID sql.NullInt64
		if err := rows.Scan(&n.ID, &n.Type, &jobID, &invitationID, &n.CourseTitle, &n.CourseAvailable, &n.ActorUsername, &n.InvitationStatus, &n.Read, &n.Archived, &n.CreatedAt); err != nil {
			sendJobResponse(w, 500, nil, "Could not load notifications")
			return
		}
		if jobID.Valid {
			n.JobID = &jobID.Int64
		}
		if invitationID.Valid {
			n.InvitationID = &invitationID.Int64
		}
		items = append(items, n)
	}
	if rows.Err() != nil {
		sendJobResponse(w, 500, nil, "Could not load notifications")
		return
	}
	var next *int64
	if len(items) > 30 {
		items = items[:30]
		cursor := items[len(items)-1].ID
		next = &cursor
	}
	sendJobResponse(w, 200, map[string]interface{}{"items": items, "nextCursor": next}, "")
}

func NotificationUnreadCount(w http.ResponseWriter, r *http.Request) {
	user := r.Context().Value(constants.USER_CONTEXT_AUTH_KEY).(*models.AuthUser)
	var count int
	if err := RouterConfig.DB.Conn.QueryRow(`SELECT COUNT(*) FROM notifications WHERE user_id=? AND read_at IS NULL AND archived_at IS NULL`, user.Id).Scan(&count); err != nil {
		sendJobResponse(w, 500, nil, "Could not load unread count")
		return
	}
	sendJobResponse(w, 200, map[string]int{"count": count}, "")
}

// Respond to the specific notification generation, not just the reusable
// collaboration row, so a stale invitation cannot accept a later re-invite.
func RespondToNotificationInvitation(w http.ResponseWriter, r *http.Request) {
	user := r.Context().Value(constants.USER_CONTEXT_AUTH_KEY).(*models.AuthUser)
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		sendJobResponse(w, 404, nil, "Invitation not found")
		return
	}
	var body struct {
		Action string `json:"action"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 4096)
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || (body.Action != "accept" && body.Action != "decline") {
		sendJobResponse(w, 400, nil, "Invalid invitation action")
		return
	}
	status := "declined"
	if body.Action == "accept" {
		status = "accepted"
	}
	result, err := RouterConfig.DB.Conn.Exec(`UPDATE course_collaborators SET status=?,updated_at=CURRENT_TIMESTAMP
		WHERE user_id=? AND status='pending' AND id=(SELECT invitation_id FROM notifications WHERE id=? AND user_id=? AND type='invitation' AND invitation_status='pending')`, status, user.Id, id, user.Id)
	if err != nil {
		sendJobResponse(w, 500, nil, "Could not respond to invitation")
		return
	}
	affected, err := result.RowsAffected()
	if err != nil {
		sendJobResponse(w, 500, nil, "Could not respond to invitation")
		return
	}
	if affected == 0 {
		sendJobResponse(w, 409, nil, "This invitation is no longer available")
		return
	}
	sendJobResponse(w, 200, map[string]string{"message": "Invitation " + status}, "")
}

func NotificationActions(w http.ResponseWriter, r *http.Request) {
	user := r.Context().Value(constants.USER_CONTEXT_AUTH_KEY).(*models.AuthUser)
	var req struct {
		Action string  `json:"action"`
		IDs    []int64 `json:"ids"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 16384)
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendJobResponse(w, 400, nil, "Invalid request")
		return
	}
	if req.Action == "read_all" {
		if _, err := RouterConfig.DB.Conn.Exec(`UPDATE notifications SET read_at=COALESCE(read_at,CURRENT_TIMESTAMP) WHERE user_id=? AND archived_at IS NULL`, user.Id); err != nil {
			sendJobResponse(w, 500, nil, "Could not update notifications")
			return
		}
		sendJobResponse(w, 200, map[string]string{"message": "Notifications marked read"}, "")
		return
	}
	if len(req.IDs) == 0 || len(req.IDs) > 100 {
		sendJobResponse(w, 400, nil, "Select between 1 and 100 notifications")
		return
	}
	seen := map[int64]bool{}
	ids := []int64{}
	for _, id := range req.IDs {
		if id <= 0 {
			sendJobResponse(w, 400, nil, "Invalid notification ID")
			return
		}
		if !seen[id] {
			seen[id] = true
			ids = append(ids, id)
		}
	}
	placeholders := strings.TrimRight(strings.Repeat("?,", len(ids)), ",")
	args := []interface{}{user.Id}
	for _, id := range ids {
		args = append(args, id)
	}
	tx, err := RouterConfig.DB.Conn.Begin()
	if err != nil {
		sendJobResponse(w, 500, nil, "Could not update notifications")
		return
	}
	defer tx.Rollback()
	var count, pending int
	if err = tx.QueryRow(`SELECT COUNT(*),COALESCE(SUM(CASE WHEN type='invitation' AND invitation_status='pending' THEN 1 ELSE 0 END),0) FROM notifications WHERE user_id=? AND id IN (`+placeholders+`)`, args...).Scan(&count, &pending); err != nil {
		sendJobResponse(w, 500, nil, "Could not update notifications")
		return
	}
	if count != len(ids) {
		sendJobResponse(w, 404, nil, "Notification not found")
		return
	}
	if pending > 0 && (req.Action == "archive" || req.Action == "delete") {
		sendJobResponse(w, 409, nil, "Respond to pending invitations before archiving or deleting them")
		return
	}
	var query string
	switch req.Action {
	case "read":
		query = `UPDATE notifications SET read_at=COALESCE(read_at,CURRENT_TIMESTAMP)`
	case "unread":
		query = `UPDATE notifications SET read_at=NULL`
	case "archive":
		query = `UPDATE notifications SET archived_at=COALESCE(archived_at,CURRENT_TIMESTAMP)`
	case "restore":
		query = `UPDATE notifications SET archived_at=NULL`
	case "delete":
		query = `DELETE FROM notifications`
	default:
		sendJobResponse(w, 400, nil, "Invalid notification action")
		return
	}
	if _, err = tx.Exec(query+` WHERE user_id=? AND id IN (`+placeholders+`)`, args...); err != nil {
		sendJobResponse(w, 500, nil, "Could not update notifications")
		return
	}
	if err = tx.Commit(); err != nil {
		sendJobResponse(w, 500, nil, "Could not update notifications")
		return
	}
	sendJobResponse(w, 200, map[string]string{"message": fmt.Sprintf("Updated %d notifications", len(ids))}, "")
}
