CREATE TABLE virtual_checkpoints (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    revision TEXT NOT NULL,
    word_index INTEGER NOT NULL CHECK (word_index >= 0),
    word_count INTEGER NOT NULL CHECK (word_count > word_index),
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, course_id)
);