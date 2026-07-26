-- User-defined highlights (replaces hardcoded colors).
CREATE TABLE IF NOT EXISTS highlights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    label VARCHAR(255) NOT NULL,
    color VARCHAR(255) NOT NULL,
    description TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

DROP TRIGGER IF EXISTS trigger_course_highlights_updated_at;

-- Recreate course_highlights to reference a user-defined highlight by id.
DROP TABLE IF EXISTS course_highlights;

CREATE TABLE IF NOT EXISTS course_highlights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    highlight_id INTEGER NOT NULL,
    chapter VARCHAR(255) NOT NULL DEFAULT '',
    text TEXT NOT NULL,
    note TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (highlight_id) REFERENCES highlights(id) ON DELETE CASCADE
);

CREATE TRIGGER IF NOT EXISTS trigger_course_highlights_updated_at
AFTER UPDATE ON course_highlights
FOR EACH ROW
BEGIN
    UPDATE course_highlights SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
