-- Distinguish chapters with the same title by storing their zero-based index in the course.
-- Existing progress is migrated to chapter_index 0 per course; users may need to re-mark
-- chapters after this migration.
CREATE TABLE reading_progress_new (
    user_id INTEGER NOT NULL,
    course_title VARCHAR(255) NOT NULL,
    chapter_index INTEGER NOT NULL DEFAULT 0,
    read BOOLEAN NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, course_title, chapter_index)
);

INSERT INTO reading_progress_new (user_id, course_title, chapter_index, read, updated_at)
SELECT user_id, course_title, 0, MAX(read), MAX(updated_at)
FROM reading_progress
GROUP BY user_id, course_title;

DROP TABLE reading_progress;
ALTER TABLE reading_progress_new RENAME TO reading_progress;
