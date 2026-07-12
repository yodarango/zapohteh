import { useState, useEffect } from "react";
import {
  Button,
  Input,
  TextArea,
  Loading,
  ConfirmationModal,
} from "@ds";
import {
  API_GET_SUBJECTS,
  API_POST_SUBJECTS,
  API_PUT_SUBJECTS,
  API_DELETE_SUBJECTS,
} from "@constants";
import { useGet, authHeaders } from "@utils";
import { useAppContext } from "@views/context/appContextProvider";

export const SubjectsView = () => {
  const { showToast } = useAppContext();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data, loading, error, refetch } = useGet({ url: API_GET_SUBJECTS });
  const subjects = data || [];

  useEffect(() => {
    if (error) {
      showToast({
        type: "danger",
        message: String(error),
      });
    }
  }, [error, showToast]);

  const resetForm = () => {
    setName("");
    setDescription("");
    setColor("");
    setEditingId(null);
  };

  const startEdit = (subject) => {
    setName(subject.name);
    setDescription(subject.description || "");
    setColor(subject.color);
    setEditingId(subject.id);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !color.trim() || saving) {
      showToast({
        type: "danger",
        message: "Please enter a name and a color",
      });
      return;
    }

    setSaving(true);
    try {
      const isEditing = editingId != null;
      const url = isEditing
        ? `${API_PUT_SUBJECTS}/${editingId}`
        : API_POST_SUBJECTS;
      const res = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          color: color.trim(),
        }),
      });
      const result = await res.json();
      if (result.error || !result.success) {
        showToast({
          type: "danger",
          message: String(result.error || "Failed to save subject"),
        });
      } else {
        showToast({
          type: "success",
          message: isEditing ? "Subject updated" : "Subject created",
        });
        resetForm();
        refetch();
      }
    } catch (err) {
      showToast({
        type: "danger",
        message: err.message || "Something went wrong",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`${API_DELETE_SUBJECTS}/${deletingId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const result = await res.json();
      if (result.error || !result.success) {
        showToast({
          type: "danger",
          message: String(result.error || "Failed to delete subject"),
        });
      } else {
        showToast({ type: "success", message: "Subject deleted" });
        if (editingId === deletingId) {
          resetForm();
        }
        refetch();
      }
    } catch (err) {
      showToast({
        type: "danger",
        message: err.message || "Something went wrong",
      });
    } finally {
      setIsDeleting(false);
      setDeletingId(null);
    }
  };

  return (
    <section>
      <h1 className='mb-1 text-2xl font-bold text-dr-text'>Subjects</h1>
      <p className='mb-6 text-sm text-dr-text-muted'>
        Organize your courses by subject.
      </p>

      <form
        onSubmit={handleSubmit}
        className='mb-8 rounded-2xl border border-dr-border bg-dr-surface p-4'
      >
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <Input
            label='Name'
            placeholder='e.g. History'
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div>
            <label className='mb-1 block text-sm font-medium text-dr-text'>
              Color
            </label>
            <div className='flex items-center gap-3'>
              <input
                type='color'
                value={color || "#000000"}
                onChange={(e) => setColor(e.target.value)}
                className='h-10 w-10 cursor-pointer rounded-lg border border-dr-border bg-transparent'
              />
              <Input
                placeholder='#3b82f6 or rgb(59, 130, 246)'
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className='flex-1'
              />
            </div>
          </div>
        </div>
        <div className='mt-4'>
          <TextArea
            label='Description'
            placeholder='Brief description of the subject'
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className='mt-4 flex items-center justify-end gap-3'>
          {editingId != null && (
            <Button
              type='button'
              secondary
              onClick={resetForm}
              disabled={saving}
            >
              Cancel
            </Button>
          )}
          <Button primary disabled={saving} isLoading={saving}>
            {editingId != null ? "Update subject" : "Create subject"}
          </Button>
        </div>
      </form>

      <ConfirmationModal
        open={deletingId != null}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title='Delete subject'
        message='Are you sure you want to delete this subject? This action cannot be undone.'
        confirmText='Delete'
        cancelText='Cancel'
        confirmVariant='danger'
        isLoading={isDeleting}
      />

      {loading && (
        <div className='flex justify-center py-12'>
          <Loading size={40} />
        </div>
      )}

      {!loading && !error && subjects.length === 0 && (
        <p className='py-12 text-center text-dr-text-muted'>
          No subjects yet. Create one above.
        </p>
      )}

      {!loading && !error && subjects.length > 0 && (
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
          {subjects.map((subject) => (
            <div
              key={subject.id}
              className='rounded-2xl border border-dr-border bg-dr-surface p-4'
            >
              <div className='mb-3 flex items-center justify-between gap-2'>
                <div className='flex items-center gap-2 min-w-0'>
                  <span
                    className='inline-block h-3 w-3 shrink-0 rounded-full'
                    style={{ backgroundColor: subject.color }}
                  />
                  <span className='truncate font-semibold text-dr-text'>
                    {subject.name}
                  </span>
                </div>
                <div className='flex shrink-0 items-center gap-1'>
                  <button
                    type='button'
                    onClick={() => startEdit(subject)}
                    className='flex h-8 w-8 items-center justify-center rounded-lg border-none bg-transparent text-dr-accent transition-colors hover:bg-dr-accent-light'
                    aria-label='Edit subject'
                    title='Edit subject'
                  >
                    <ion-icon name='create-outline' />
                  </button>
                  <button
                    type='button'
                    onClick={() => setDeletingId(subject.id)}
                    className='flex h-8 w-8 items-center justify-center rounded-lg border-none bg-transparent text-dr-danger transition-colors hover:bg-dr-danger/10'
                    aria-label='Delete subject'
                    title='Delete subject'
                  >
                    <ion-icon name='trash-outline' />
                  </button>
                </div>
              </div>
              {subject.description && (
                <p className='text-sm text-dr-text-muted'>
                  {subject.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
