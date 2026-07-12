-- Link all created content to a user.
-- Existing rows are assigned to a default user_id of 0 so they do not conflict.

PRAGMA foreign_keys = OFF;

-- Recreate research with user_id
CREATE TABLE research_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 0,
    title VARCHAR(255) NOT NULL,
    cover_image_description TEXT,
    cover_image_path VARCHAR(255),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, title)
);

INSERT INTO research_new (id, user_id, title, cover_image_description, cover_image_path, created_at, updated_at)
SELECT id, 0, title, cover_image_description, cover_image_path, created_at, updated_at FROM research;

DROP TABLE research;
ALTER TABLE research_new RENAME TO research;

DROP TRIGGER IF EXISTS trigger_research_updated_at;
CREATE TRIGGER trigger_research_updated_at
AFTER UPDATE ON research
FOR EACH ROW
BEGIN
    UPDATE research SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Recreate reading_progress with user_id
CREATE TABLE reading_progress_new (
    user_id INTEGER NOT NULL DEFAULT 0,
    course_title VARCHAR(255) NOT NULL,
    chapter VARCHAR(255) NOT NULL,
    read BOOLEAN NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, course_title, chapter)
);

INSERT INTO reading_progress_new (user_id, course_title, chapter, read, updated_at)
SELECT 0, course_title, chapter, read, updated_at FROM reading_progress;

DROP TABLE reading_progress;
ALTER TABLE reading_progress_new RENAME TO reading_progress;

-- Recreate subjects with user_id
CREATE TABLE subjects_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 0,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, name)
);

INSERT INTO subjects_new (id, user_id, name, description, color, created_at, updated_at)
SELECT id, 0, name, description, color, created_at, updated_at FROM subjects;

DROP TABLE subjects;
ALTER TABLE subjects_new RENAME TO subjects;

DROP TRIGGER IF EXISTS trigger_subjects_updated_at;
CREATE TRIGGER trigger_subjects_updated_at
AFTER UPDATE ON subjects
FOR EACH ROW
BEGIN
    UPDATE subjects SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Recreate course_subjects with user_id
CREATE TABLE course_subjects_new (
    user_id INTEGER NOT NULL DEFAULT 0,
    course_title VARCHAR(255) NOT NULL,
    subject_id INTEGER NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, course_title, subject_id),
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
);

INSERT INTO course_subjects_new (user_id, course_title, subject_id, created_at)
SELECT 0, course_title, subject_id, created_at FROM course_subjects;

DROP TABLE course_subjects;
ALTER TABLE course_subjects_new RENAME TO course_subjects;

PRAGMA foreign_keys = ON;
