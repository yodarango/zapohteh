-- Store user text highlights per course chapter.
CREATE TABLE IF NOT EXISTS course_highlights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    chapter VARCHAR(255) NOT NULL DEFAULT '',
    text TEXT NOT NULL,
    color VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

DROP TRIGGER IF EXISTS trigger_course_highlights_updated_at;
CREATE TRIGGER trigger_course_highlights_updated_at
AFTER UPDATE ON course_highlights
FOR EACH ROW
BEGIN
    UPDATE course_highlights SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
