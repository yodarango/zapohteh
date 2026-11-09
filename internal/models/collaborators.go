package models

import (
	"database/sql"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"zapohteh/internal/utils"
)

// Collaboration roles returned by ResolveCourseAccess.
const (
	CourseRoleOwner        = "owner"
	CourseRoleCollaborator = "collaborator"
)

// UserSearchResult is a single user match for the invite autocomplete.
type UserSearchResult struct {
	ID        int    `json:"id"`
	Username  string `json:"username"`
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
	Avatar    string `json:"avatar"`
}

/**************************************************************************************
* SearchUsers returns up to 8 active users whose username, first name or last name
* contains the query, excluding the requester. Used by the collaborate modal to find
* people to invite.
**************************************************************************************/
func SearchUsers(requesterId uint, query string) ([]UserSearchResult, error) {
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return nil, fmt.Errorf("database is not available")
	}
	query = strings.TrimSpace(query)
	if query == "" {
		return []UserSearchResult{}, nil
	}

	like := "%" + query + "%"
	rows, err := ModelsRepo.DB.Conn.Query(`
		SELECT id, username, first_name, last_name, COALESCE(avatar, '')
		FROM users
		WHERE status = 'active' AND id != ?
			AND (username LIKE ? OR first_name LIKE ? OR last_name LIKE ?)
		ORDER BY username
		LIMIT 8
	`, requesterId, like, like, like)
	if err != nil {
		return nil, fmt.Errorf("failed to search users: %w", err)
	}
	defer rows.Close()

	results := []UserSearchResult{}
	for rows.Next() {
		var u UserSearchResult
		if err := rows.Scan(&u.ID, &u.Username, &u.FirstName, &u.LastName, &u.Avatar); err != nil {
			return nil, fmt.Errorf("failed to scan user: %w", err)
		}
		results = append(results, u)
	}
	return results, nil
}

// Collaborator is a single invited or accepted participant of a course.
type Collaborator struct {
	UserID    uint      `json:"userId"`
	Username  string    `json:"username"`
	FirstName string    `json:"firstName"`
	LastName  string    `json:"lastName"`
	Avatar    string    `json:"avatar"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"createdAt"`
}

/**************************************************************************************
* InviteCollaborator sends a collaboration request for one of the owner's courses to
* the user with the given username. Re-inviting a user who declined resets the row
* back to pending.
**************************************************************************************/
func InviteCollaborator(ownerId uint, courseTitle, username string) error {
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return fmt.Errorf("database is not available")
	}

	// getCourseID errors when the course does not belong to the owner.
	courseId, err := getCourseID(ownerId, courseTitle)
	if err != nil {
		return fmt.Errorf("course not found")
	}

	username = strings.TrimSpace(username)
	if username == "" {
		return fmt.Errorf("username is required")
	}

	var inviteeId uint
	err = ModelsRepo.DB.Conn.QueryRow(
		"SELECT id FROM users WHERE username = ? AND status = 'active'",
		username,
	).Scan(&inviteeId)
	if err == sql.ErrNoRows {
		return fmt.Errorf("no active user found with this username")
	}
	if err != nil {
		return fmt.Errorf("failed to look up user: %w", err)
	}
	if inviteeId == ownerId {
		return fmt.Errorf("you cannot invite yourself")
	}

	_, err = ModelsRepo.DB.Conn.Exec(`
		INSERT INTO course_collaborators (course_id, user_id, invited_by, status)
		VALUES (?, ?, ?, 'pending')
		ON CONFLICT(course_id, user_id) DO UPDATE SET
			status = 'pending',
			invited_by = excluded.invited_by,
			updated_at = CURRENT_TIMESTAMP
	`, courseId, inviteeId, ownerId)
	if err != nil {
		return fmt.Errorf("failed to send invitation: %w", err)
	}
	return nil
}

/**************************************************************************************
* ListCollaborators returns the pending and accepted collaborators of one of the
* owner's courses.
**************************************************************************************/
func ListCollaborators(ownerId uint, courseTitle string) ([]Collaborator, error) {
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return nil, fmt.Errorf("database is not available")
	}

	courseId, err := getCourseID(ownerId, courseTitle)
	if err != nil {
		return nil, fmt.Errorf("course not found")
	}

	rows, err := ModelsRepo.DB.Conn.Query(`
		SELECT cc.user_id, u.username, u.first_name, u.last_name, COALESCE(u.avatar, ''), cc.status, cc.created_at
		FROM course_collaborators cc
		JOIN users u ON u.id = cc.user_id
		WHERE cc.course_id = ? AND cc.status IN ('pending', 'accepted')
		ORDER BY cc.created_at
	`, courseId)
	if err != nil {
		return nil, fmt.Errorf("failed to list collaborators: %w", err)
	}
	defer rows.Close()

	collaborators := []Collaborator{}
	for rows.Next() {
		var c Collaborator
		if err := rows.Scan(&c.UserID, &c.Username, &c.FirstName, &c.LastName, &c.Avatar, &c.Status, &c.CreatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan collaborator: %w", err)
		}
		collaborators = append(collaborators, c)
	}
	return collaborators, nil
}

// Invite is a pending collaboration request shown in the invitee's inbox.
type Invite struct {
	ID              int       `json:"id"`
	CourseID        int       `json:"courseId"`
	CourseTitle     string    `json:"courseTitle"`
	InviterUsername string    `json:"inviterUsername"`
	InviterAvatar   string    `json:"inviterAvatar"`
	CreatedAt       time.Time `json:"createdAt"`
}

/**************************************************************************************
* ListPendingInvites returns the collaboration requests waiting for the user's
* response, newest first.
**************************************************************************************/
func ListPendingInvites(userId uint) ([]Invite, error) {
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return nil, fmt.Errorf("database is not available")
	}

	rows, err := ModelsRepo.DB.Conn.Query(`
		SELECT cc.id, cc.course_id, c.title, u.username, COALESCE(u.avatar, ''), cc.created_at
		FROM course_collaborators cc
		JOIN courses c ON c.id = cc.course_id
		JOIN users u ON u.id = cc.invited_by
		WHERE cc.user_id = ? AND cc.status = 'pending'
		ORDER BY cc.created_at DESC
	`, userId)
	if err != nil {
		return nil, fmt.Errorf("failed to list invitations: %w", err)
	}
	defer rows.Close()

	invites := []Invite{}
	for rows.Next() {
		var inv Invite
		if err := rows.Scan(&inv.ID, &inv.CourseID, &inv.CourseTitle, &inv.InviterUsername, &inv.InviterAvatar, &inv.CreatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan invitation: %w", err)
		}
		invites = append(invites, inv)
	}
	return invites, nil
}

/**************************************************************************************
* RespondToInvite marks a pending invitation as accepted or declined. Only the
* invitee can respond, and only while the invitation is still pending.
**************************************************************************************/
func RespondToInvite(userId uint, inviteId int, accept bool) error {
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return fmt.Errorf("database is not available")
	}

	status := "declined"
	if accept {
		status = "accepted"
	}

	res, err := ModelsRepo.DB.Conn.Exec(`
		UPDATE course_collaborators
		SET status = ?, updated_at = CURRENT_TIMESTAMP
		WHERE id = ? AND user_id = ? AND status = 'pending'
	`, status, inviteId, userId)
	if err != nil {
		return fmt.Errorf("failed to respond to invitation: %w", err)
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check invitation response: %w", err)
	}
	if affected == 0 {
		return fmt.Errorf("invitation not found")
	}
	return nil
}

/**************************************************************************************
* RemoveCollaborator removes a collaborator (pending or accepted) from one of the
* owner's courses.
**************************************************************************************/
func RemoveCollaborator(ownerId uint, courseTitle string, collaboratorId uint) error {
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return fmt.Errorf("database is not available")
	}

	courseId, err := getCourseID(ownerId, courseTitle)
	if err != nil {
		return fmt.Errorf("course not found")
	}

	res, err := ModelsRepo.DB.Conn.Exec(
		"DELETE FROM course_collaborators WHERE course_id = ? AND user_id = ?",
		courseId, collaboratorId,
	)
	if err != nil {
		return fmt.Errorf("failed to remove collaborator: %w", err)
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check collaborator removal: %w", err)
	}
	if affected == 0 {
		return fmt.Errorf("collaborator not found")
	}
	return nil
}

/**************************************************************************************
* LeaveCourse removes the user's own collaboration from a course they do not own.
**************************************************************************************/
func LeaveCourse(userId uint, courseTitle string) error {
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return fmt.Errorf("database is not available")
	}

	res, err := ModelsRepo.DB.Conn.Exec(`
		DELETE FROM course_collaborators
		WHERE user_id = ?
			AND course_id IN (SELECT id FROM courses WHERE title = ? AND user_id != ?)
	`, userId, courseTitle, userId)
	if err != nil {
		return fmt.Errorf("failed to leave course: %w", err)
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check leave: %w", err)
	}
	if affected == 0 {
		return fmt.Errorf("you are not a collaborator on this course")
	}
	return nil
}

/**************************************************************************************
* ResolveCourseAccess returns the owner's user id, the course id and the caller's role
* ("owner" or "collaborator") for a course title. The caller's own course wins title
* collisions; otherwise an accepted collaboration grants access to the owner's course.
* It returns an error when the caller has no access to any course with this title.
**************************************************************************************/
func ResolveCourseAccess(userId uint, title string) (ownerId uint, courseId int, role string, err error) {
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return 0, 0, "", fmt.Errorf("database is not available")
	}

	// own course first: it wins when a collaborated course shares the same title
	err = ModelsRepo.DB.Conn.QueryRow(
		"SELECT id FROM courses WHERE user_id = ? AND title = ?",
		userId, title,
	).Scan(&courseId)
	if err == nil {
		return userId, courseId, CourseRoleOwner, nil
	}
	if err != sql.ErrNoRows {
		return 0, 0, "", fmt.Errorf("failed to resolve course access: %w", err)
	}

	err = ModelsRepo.DB.Conn.QueryRow(`
		SELECT c.user_id, c.id
		FROM courses c
		JOIN course_collaborators cc ON cc.course_id = c.id
		WHERE cc.user_id = ? AND cc.status = 'accepted' AND c.title = ?
	`, userId, title).Scan(&ownerId, &courseId)
	if err == nil {
		return ownerId, courseId, CourseRoleCollaborator, nil
	}
	if err != sql.ErrNoRows {
		return 0, 0, "", fmt.Errorf("failed to resolve course access: %w", err)
	}

	return 0, 0, "", fmt.Errorf("course not found")
}

// NoteWithAuthor is a course note enriched with its author's identity so shared
// lessons can show who wrote each note.
type NoteWithAuthor struct {
	Note
	AuthorUsername string `json:"authorUsername"`
	AuthorAvatar   string `json:"authorAvatar"`
	AuthorName     string `json:"authorName"`
}

/**************************************************************************************
* GetCourseNotesWithAuthors returns every note attached to a course, from all of its
* participants (owner and collaborators), newest first, enriched with the author's
* username, avatar and display name.
**************************************************************************************/
func GetCourseNotesWithAuthors(courseId int) ([]NoteWithAuthor, error) {
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return nil, fmt.Errorf("database is not available")
	}

	rows, err := ModelsRepo.DB.Conn.Query(`
		SELECT n.id, n.user_id, n.course_id, n.body, n.created_at, n.updated_at,
			u.username, COALESCE(u.avatar, ''), u.first_name, u.last_name
		FROM notes n
		JOIN users u ON u.id = n.user_id
		WHERE n.course_id = ?
		ORDER BY n.updated_at DESC
	`, courseId)
	if err != nil {
		return nil, fmt.Errorf("failed to load notes: %w", err)
	}
	defer rows.Close()

	notes := []NoteWithAuthor{}
	for rows.Next() {
		var n NoteWithAuthor
		var firstName, lastName string
		if err := rows.Scan(
			&n.ID, &n.UserID, &n.CourseID, &n.Body, &n.CreatedAt, &n.UpdatedAt,
			&n.AuthorUsername, &n.AuthorAvatar, &firstName, &lastName,
		); err != nil {
			return nil, fmt.Errorf("failed to scan note: %w", err)
		}
		n.AuthorName = strings.TrimSpace(firstName + " " + lastName)
		notes = append(notes, n)
	}
	return notes, nil
}

/**************************************************************************************
* ListSharedCourses returns the courses that involve other people: the caller's own
* courses that have at least one accepted collaborator (role "owner") and the courses
* owned by others where the caller is an accepted collaborator (role "collaborator",
* with Owner set to the owner's username). Entries are enriched like ListCourses.
**************************************************************************************/
func ListSharedCourses(userId uint) ([]Course, error) {
	if ModelsRepo == nil || ModelsRepo.DB == nil || ModelsRepo.DB.Conn == nil {
		return nil, fmt.Errorf("database is not available")
	}

	shared := []Course{}

	// (a) my own courses that have at least one accepted collaborator. Reuse
	// ListCourses so these entries are enriched exactly like the courses page.
	ownedTitles := make(map[string]bool)
	rows, err := ModelsRepo.DB.Conn.Query(`
		SELECT DISTINCT c.title
		FROM courses c
		JOIN course_collaborators cc ON cc.course_id = c.id
		WHERE c.user_id = ? AND cc.status = 'accepted'
	`, userId)
	if err != nil {
		return nil, fmt.Errorf("failed to list shared courses: %w", err)
	}
	for rows.Next() {
		var title string
		if err := rows.Scan(&title); err == nil {
			ownedTitles[utils.SanitizeFilename(title)] = true
		}
	}
	rows.Close()

	if len(ownedTitles) > 0 {
		all, err := ListCourses(userId)
		if err != nil {
			return nil, err
		}
		for _, c := range all {
			if ownedTitles[c.ID] {
				c.Role = CourseRoleOwner
				shared = append(shared, c)
			}
		}
	}

	// (b) courses owned by others where I am an accepted collaborator.
	collabRows, err := ModelsRepo.DB.Conn.Query(`
		SELECT c.user_id, c.title, c.cover_image_path, c.language, c.source, c.created_at, u.username
		FROM course_collaborators cc
		JOIN courses c ON c.id = cc.course_id
		JOIN users u ON u.id = c.user_id
		WHERE cc.user_id = ? AND cc.status = 'accepted'
		ORDER BY c.title
	`, userId)
	if err != nil {
		return nil, fmt.Errorf("failed to list collaborated courses: %w", err)
	}
	defer collabRows.Close()

	// reading progress of the viewing user, keyed by course title
	readCounts := make(map[string]int)
	lastReadAts := make(map[string]*time.Time)
	progRows, err := ModelsRepo.DB.Conn.Query(
		"SELECT course_title, COUNT(*), MAX(updated_at) FROM reading_progress WHERE user_id = ? AND read = 1 GROUP BY course_title",
		userId,
	)
	if err == nil {
		defer progRows.Close()
		for progRows.Next() {
			var title string
			var count int
			var lastRead sql.NullString
			if err := progRows.Scan(&title, &count, &lastRead); err == nil {
				readCounts[title] = count
				if lastRead.Valid {
					if t, err := time.Parse("2006-01-02 15:04:05", lastRead.String); err == nil {
						lastReadAts[title] = &t
					}
				}
			}
		}
	}

	for collabRows.Next() {
		var (
			ownerId   uint
			title     string
			cover     sql.NullString
			language  sql.NullString
			source    sql.NullString
			createdAt time.Time
			ownerName string
		)
		if err := collabRows.Scan(&ownerId, &title, &cover, &language, &source, &createdAt, &ownerName); err != nil {
			return nil, fmt.Errorf("failed to scan collaborated course: %w", err)
		}

		folderName := utils.SanitizeFilename(title)
		folder := filepath.Join(utils.ContentDir(), fmt.Sprintf("user_%d", ownerId), folderName)

		src := source.String
		if src == "" {
			src = CourseSourceAI
		}

		shared = append(shared, Course{
			ID:             folderName,
			Name:           utils.ToTitleCase(folderName),
			CoverImagePath: cover.String,
			Language:       language.String,
			Source:         src,
			TotalChapters:  countChapters(folder),
			ReadChapters:   readCounts[title],
			CreatedAt:      createdAt,
			LastReadAt:     lastReadAts[title],
			Role:           CourseRoleCollaborator,
			Owner:          ownerName,
		})
	}

	return shared, nil
}



