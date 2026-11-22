CREATE TABLE course_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_key TEXT NOT NULL,
    source TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    input_json TEXT NOT NULL,
    upload_path TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'queued',
    phase TEXT NOT NULL DEFAULT 'queued',
    detail TEXT NOT NULL DEFAULT '',
    chapters_json TEXT NOT NULL DEFAULT '[]',
    completed_json TEXT NOT NULL DEFAULT '[]',
    warning TEXT NOT NULL DEFAULT '',
    error TEXT NOT NULL DEFAULT '',
    course_title TEXT NOT NULL DEFAULT '',
    notify_email INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, request_key)
);
CREATE INDEX idx_course_jobs_user ON course_jobs(user_id, id DESC);
CREATE UNIQUE INDEX idx_course_jobs_active_title ON course_jobs(user_id, title COLLATE NOCASE)
    WHERE status IN ('queued', 'running') AND title <> '';

CREATE TABLE course_job_notifications (
    job_id INTEGER PRIMARY KEY REFERENCES course_jobs(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_error TEXT NOT NULL DEFAULT ''
);