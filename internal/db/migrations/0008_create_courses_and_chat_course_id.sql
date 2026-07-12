-- Create a proper courses table and link chat_messages to it via course_id.
-- The old course_subjects table is split into courses and a new course_subjects join table.

PRAGMA foreign_keys = OFF;

-- 1. Courses table
CREATE TABLE courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, title)
);

INSERT INTO courses (user_id, title, created_at, updated_at)
SELECT DISTINCT user_id, course_title, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM course_subjects;

DROP TRIGGER IF EXISTS trigger_courses_updated_at;
CREATE TRIGGER trigger_courses_updated_at
AFTER UPDATE ON courses
FOR EACH ROW
BEGIN
    UPDATE courses SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- 2. New course_subjects join table
CREATE TABLE course_subjects_new (
    course_id INTEGER NOT NULL,
    subject_id INTEGER NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (course_id, subject_id),
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
);

INSERT INTO course_subjects_new (course_id, subject_id, created_at)
SELECT c.id, cs.subject_id, cs.created_at
FROM course_subjects cs
JOIN courses c ON c.user_id = cs.user_id AND c.title = cs.course_title;

DROP TABLE course_subjects;
ALTER TABLE course_subjects_new RENAME TO course_subjects;

-- 3. Recreate chat_messages with course_id instead of course
CREATE TABLE chat_messages_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    chapter TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

INSERT INTO chat_messages_new (id, user_id, course_id, chapter, role, content, created_at)
SELECT cm.id, cm.user_id, c.id, cm.chapter, cm.role, cm.content, cm.created_at
FROM chat_messages cm
JOIN courses c ON c.user_id = cm.user_id AND c.title = cm.course;

DROP TABLE chat_messages;
ALTER TABLE chat_messages_new RENAME TO chat_messages;

PRAGMA foreign_keys = ON;
