import { useState, useEffect, useRef } from 'react';
import {
  API_GET_NOTES,
  API_POST_NOTES,
  API_PUT_NOTES,
  API_DELETE_NOTES,
} from '@constants';
import { marked } from 'marked';
import { authHeaders } from '@utils';
import { useAppContext } from '@views/context/appContextProvider';
import zapohtehLogo from '../../../public/logo.webp';

const DEBOUNCE_MS = 3000;

export const NotesPanel = ({ topic }) => {
  const { showToast } = useAppContext();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${API_GET_NOTES}?course=${encodeURIComponent(topic)}`,
          { headers: authHeaders() },
        );
        const result = await res.json();
        if (!cancelled && result.success && Array.isArray(result.data)) {
          setNotes(result.data);
        }
      } catch (err) {
        if (!cancelled) {
          showToast({
            type: 'danger',
            message: err.message || 'Failed to load notes',
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [topic, showToast]);

  const createNote = async () => {
    const newNote = { body: '' };
    try {
      const res = await fetch(
        `${API_POST_NOTES}?course=${encodeURIComponent(topic)}`,
        {
          method: 'POST',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify(newNote),
        },
      );
      const result = await res.json();
      if (!res.ok || !result.success || result.error || result.errors) {
        throw new Error(
          result.error || result.errors || 'Failed to create note',
        );
      }
      if (!result.data) {
        throw new Error('Failed to create note');
      }
      setNotes((prev) => [result.data, ...prev]);
    } catch (err) {
      showToast({
        type: 'danger',
        message: err.message || 'Failed to create note',
      });
    }
  };

  const updateNote = async (id, body) => {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    const updated = { ...note, body };
    try {
      const res = await fetch(`${API_PUT_NOTES}/${id}`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      const result = await res.json();
      if (!res.ok || !result.success || result.error || result.errors) {
        throw new Error(result.error || result.errors || 'Failed to save note');
      }
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? result.data || updated : n)),
      );
    } catch (err) {
      showToast({
        type: 'danger',
        message: err.message || 'Failed to save note',
      });
    }
  };

  const deleteNote = async (id) => {
    try {
      const res = await fetch(`${API_DELETE_NOTES}/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const result = await res.json();
      if (!res.ok || !result.success || result.error || result.errors) {
        throw new Error(
          result.error || result.errors || 'Failed to delete note',
        );
      }
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      showToast({
        type: 'danger',
        message: err.message || 'Failed to delete note',
      });
    }
  };

  return (
    <div className='flex h-full flex-col gap-4 overflow-y-auto px-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'>
      <div className='flex items-center gap-3 rounded-xl border border-dr-border bg-dr-surface p-3 shadow-sm'>
        <img
          src={zapohtehLogo}
          alt='Logo'
          className='h-8 w-8 rounded-lg object-contain'
        />
        <span className='text-lg font-bold text-dr-text'>Zapohteh</span>
      </div>

      <button
        type='button'
        onClick={createNote}
        className='flex w-full items-center justify-end gap-2  text-dr-accent'
      >
        <span className='text-lg'>+</span>
        Add note
      </button>

      {loading && notes.length === 0 && (
        <p className='text-center text-xs text-dr-text-muted'>
          Loading notes...
        </p>
      )}

      <div className='flex flex-col gap-3'>
        {notes.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            onUpdate={updateNote}
            onDelete={deleteNote}
          />
        ))}
      </div>
    </div>
  );
};

const NoteCard = ({ note, onUpdate, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [body, setBody] = useState(note.body || '');
  const debounceTimerRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    setBody(note.body || '');
  }, [note.body]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const onBodyChange = (e) => {
    const value = e.target.value;
    setBody(value);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      onUpdate(note.id, value);
    }, DEBOUNCE_MS);
  };

  // Autogrow the textarea up to 70vh, then scroll.
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const maxHeight = window.innerHeight * 0.7;
    textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + 'px';
    textarea.style.overflowY =
      textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [body, expanded]);

  const handleBlur = () => {
    setExpanded(false);
  };

  const expand = () => setExpanded(true);

  const renderedMarkdown = marked.parse(body || '', { async: false });

  return (
    <div className='rounded-xl border border-dr-border bg-dr-surface p-3 shadow-sm transition-shadow hover:shadow-md'>
      <div className='mb-2 flex items-center justify-between'>
        <span className='text-xs text-dr-text-muted'>
          {new Date(note.updatedAt).toLocaleDateString()}
        </span>
        <div className='flex items-center gap-1'>
          <button
            type='button'
            onClick={(e) => {
              e.stopPropagation();
              setCollapsed((prev) => !prev);
            }}
            className='flex h-6 w-6 items-center justify-center rounded text-dr-accent transition-colors hover:bg-dr-surface-light'
            aria-label={collapsed ? 'Open note' : 'Collapse note'}
            title={collapsed ? 'Open note' : 'Collapse note'}
          >
            <ion-icon
              name={collapsed ? 'add-outline' : 'remove-outline'}
              className='text-base'
            />
          </button>
          <button
            type='button'
            onClick={(e) => {
              e.stopPropagation();
              onDelete(note.id);
            }}
            className='flex h-6 w-6 items-center justify-center rounded text-dr-danger transition-colors hover:bg-dr-surface-light'
            aria-label='Delete note'
            title='Delete note'
          >
            ×
          </button>
        </div>
      </div>
      {!collapsed &&
        (expanded ? (
          <textarea
            ref={textareaRef}
            value={body}
            onChange={onBodyChange}
            onBlur={handleBlur}
            placeholder='Write your note...'
            className='min-h-[8rem] w-full resize-none rounded-lg bg-dr-surface-light p-2 text-sm text-dr-text outline-none focus:ring-2 focus:ring-dr-accent/25'
            autoFocus
          />
        ) : (
          <div onClick={expand} className='cursor-pointer'>
            {body ? (
              <div
                className='research-content text-sm text-dr-text'
                dangerouslySetInnerHTML={{ __html: renderedMarkdown }}
              />
            ) : (
              <span className='text-sm text-dr-text-muted'>Empty note</span>
            )}
          </div>
        ))}
    </div>
  );
};
