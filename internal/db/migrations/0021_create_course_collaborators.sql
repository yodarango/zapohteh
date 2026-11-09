-- User-to-user lesson collaboration: a course owner invites another user, who
-- becomes a collaborator upon accepting. Collaborators can read the lesson and
-- manage their own notes; the public share link is unaffected.

CREATE TABLE IF NOT EXISTS course_collaborators (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    invited_by INTEGER NOT NULL,
    status VARCHAR(10) NOT NULL DEFAULT 'pending', -- pending|accepted|declined
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(course_id, user_id),
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_course_collaborators_user_status ON course_collaborators(user_id, status);
