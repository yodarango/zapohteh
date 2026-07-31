-- Sticky notes per course, positioned and sized freely by the user.
CREATE TABLE IF NOT EXISTS stickies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    x INTEGER NOT NULL DEFAULT 100,
    y INTEGER NOT NULL DEFAULT 100,
    width INTEGER NOT NULL DEFAULT 240,
    height INTEGER NOT NULL DEFAULT 180,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

DROP TRIGGER IF EXISTS trigger_stickies_updated_at;
CREATE TRIGGER trigger_stickies_updated_at
AFTER UPDATE ON stickies
FOR EACH ROW
BEGIN
    UPDATE stickies SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
