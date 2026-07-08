-- Chat messages for the lesson AI assistant
CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    course TEXT NOT NULL,
    chapter TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
