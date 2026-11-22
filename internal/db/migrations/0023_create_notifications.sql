-- In-app notifications are independent of the course email-delivery queue.
CREATE TABLE notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK(type IN ('invitation','course_succeeded','course_failed','course_interrupted')),
    job_id INTEGER,
    invitation_id INTEGER,
    course_id INTEGER,
    course_title TEXT NOT NULL DEFAULT '',
    actor_username TEXT NOT NULL DEFAULT '',
    invitation_status TEXT NOT NULL DEFAULT '',
    read_at TEXT,
    archived_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_notifications_inbox ON notifications(user_id, archived_at, id DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id, read_at, archived_at);
CREATE UNIQUE INDEX idx_notifications_job ON notifications(job_id) WHERE job_id IS NOT NULL;

-- Retain existing actionable invitations when the old bell dropdown is removed.
INSERT INTO notifications (user_id, type, invitation_id, course_id, course_title, actor_username, invitation_status, created_at)
SELECT cc.user_id, 'invitation', cc.id, cc.course_id, c.title, u.username, 'pending', cc.created_at
FROM course_collaborators cc JOIN courses c ON c.id = cc.course_id JOIN users u ON u.id = cc.invited_by
WHERE cc.status = 'pending';

CREATE TRIGGER notify_course_job_result AFTER UPDATE OF status ON course_jobs
WHEN OLD.status <> NEW.status AND NEW.status IN ('succeeded', 'failed', 'interrupted')
BEGIN
    INSERT OR IGNORE INTO notifications(user_id, type, job_id, course_id, course_title)
    VALUES (NEW.user_id, 'course_' || NEW.status, NEW.id,
        (SELECT id FROM courses WHERE user_id = NEW.user_id AND title = NEW.course_title),
        COALESCE(NULLIF(NEW.course_title, ''), NULLIF(NEW.title, ''), 'Imported lesson'));
END;

CREATE TRIGGER notify_invitation_insert AFTER INSERT ON course_collaborators
WHEN NEW.status = 'pending'
BEGIN
    INSERT INTO notifications(user_id, type, invitation_id, course_id, course_title, actor_username, invitation_status)
    SELECT NEW.user_id, 'invitation', NEW.id, NEW.course_id, c.title, u.username, 'pending'
    FROM courses c JOIN users u ON u.id = NEW.invited_by WHERE c.id = NEW.course_id;
END;

CREATE TRIGGER notify_invitation_reinvite AFTER UPDATE OF status ON course_collaborators
WHEN NEW.status = 'pending' AND OLD.status <> 'pending'
BEGIN
    INSERT INTO notifications(user_id, type, invitation_id, course_id, course_title, actor_username, invitation_status)
    SELECT NEW.user_id, 'invitation', NEW.id, NEW.course_id, c.title, u.username, 'pending'
    FROM courses c JOIN users u ON u.id = NEW.invited_by WHERE c.id = NEW.course_id;
END;

CREATE TRIGGER notify_invitation_response AFTER UPDATE OF status ON course_collaborators
WHEN OLD.status = 'pending' AND NEW.status <> 'pending'
BEGIN
    UPDATE notifications SET invitation_status = NEW.status, read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
    WHERE invitation_id = NEW.id AND type = 'invitation' AND invitation_status = 'pending';
END;

CREATE TRIGGER notify_invitation_withdrawn BEFORE DELETE ON course_collaborators
BEGIN
    UPDATE notifications SET invitation_status = 'withdrawn'
    WHERE invitation_id = OLD.id AND type = 'invitation' AND invitation_status = 'pending';
END;

-- Course IDs are retained for links while they exist, but never reused for a
-- different course after deletion. Historical titles remain in the inbox.
CREATE TRIGGER notify_course_deleted BEFORE DELETE ON courses
BEGIN
    UPDATE notifications SET course_title = OLD.title, course_id = NULL WHERE course_id = OLD.id;
END;