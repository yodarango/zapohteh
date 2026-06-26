-- Drop tables if they exist (for clean reinstall)
DROP TABLE IF EXISTS users;

-- Users table
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    avatar VARCHAR(255) DEFAULT NULL,
    status CHAR(10) NOT NULL DEFAULT 'pending',
    verification_code CHAR(10) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Trigger to keep updated_at current on every row update (SQLite equivalent of MySQL's ON UPDATE CURRENT_TIMESTAMP)
DROP TRIGGER IF EXISTS trigger_users_updated_at;
CREATE TRIGGER trigger_users_updated_at
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;