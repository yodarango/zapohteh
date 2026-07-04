CREATE TABLE IF NOT EXISTS course_subjects (
    course_title VARCHAR(255) NOT NULL,
    subject_id INTEGER NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (course_title, subject_id),
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
);
