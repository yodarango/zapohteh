CREATE TABLE IF NOT EXISTS reading_progress (
    course_title VARCHAR(255) NOT NULL,
    chapter VARCHAR(255) NOT NULL,
    read BOOLEAN NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (course_title, chapter)
);
