import { useState, useEffect } from "react";
import {
  Button,
  Input,
  TextArea,
  Loading,
  ConfirmationModal,
} from "@ds";
import {
  API_GET_HIGHLIGHTS,
  API_POST_HIGHLIGHTS,
  API_PUT_HIGHLIGHTS,
  API_DELETE_HIGHLIGHTS,
} from "@constants";
import { useGet, authHeaders } from "@utils";
import { useAppContext } from "@views/context/appContextProvider";

const isValidColor = (color) => {
  const trimmed = color.trim();
  if (!trimmed) return false;
  const s = new Option().style;
  s.color = trimmed;
  if (s.color !== "") return true;
  // Accept cmyk(...) format strings.
  return /^cmyk\(\s*[\d.]+%?\s*(,\s*[\d.]+%?\s*){3,4}\s*\)$/i.test(trimmed);
};

export const HighlightsView = () => {
  const { showToast } = useAppContext();
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data, loading, error, refetch } = useGet({ url: API_GET_HIGHLIGHTS });
  const highlights = data || [];

  useEffect(() => {
    if (error) {
      showToast({
        type: "danger",
        message: String(error),
      });
    }
  }, [error, showToast]);

  const resetForm = () => {
    setLabel("");
    setDescription("");
    setColor("");
    setEditingId(null);
  };

  const startEdit = (highlight) => {
    setLabel(highlight.label);
    setDescription(highlight.description || "");
    setColor(highlight.color);
    setEditingId(highlight.id);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!label.trim() || !color.trim() || saving) {
      showToast({
        type: "danger",
        message: "Please enter a label and a color",
      });
      return;
    }
    if (!isValidColor(color)) {
      showToast({
        type: "danger",
        message: "Please enter a valid color (hex, rgb, rgba, hsl, cmyk)",
      });
      return;
    }

    setSaving(true);
    try {
      const isEditing = editingId != null;
      const url = isEditing
        ? `${API_PUT_HIGHLIGHTS}/${editingId}`
        : API_POST_HIGHLIGHTS;
      const res = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          label: label.trim(),
          color: color.trim(),
          description: description.trim(),
        }),
      });
      const result = await res.json();
      if (result.error || !result.success) {
        showToast({
          type: "danger",
          message: String(result.error || "Failed to save highlight"),
        });
      } else {
        showToast({
          type: "success",
          message: isEditing ? "Highlight updated" : "Highlight created",
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
      const res = await fetch(`${API_DELETE_HIGHLIGHTS}/${deletingId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const result = await res.json();
      if (result.error || !result.success) {
        showToast({
          type: "danger",
          message: String(result.error || "Failed to delete highlight"),
        });
      } else {
        showToast({ type: "success", message: "Highlight deleted" });
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
      <h1 className='mb-1 text-2xl font-bold text-dr-text'>Highlights</h1>
      <p className='mb-6 text-sm text-dr-text-muted'>
        Create reusable highlight styles for your course notes.
      </p>

      <form
        onSubmit={handleSubmit}
        className='mb-8 rounded-2xl border border-dr-border bg-dr-surface p-4'
      >
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <Input
            label='Label'
            placeholder='e.g. Important'
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <div>
            <label className='mb-1 block text-sm font-medium text-dr-text'>
              Color
            </label>
            <div className='flex items-center gap-3'>
              <input
                type='color'
                value={isValidColor(color) ? color : "#000000"}
                onChange={(e) => setColor(e.target.value)}
                className='h-10 w-10 cursor-pointer rounded-lg border border-dr-border bg-transparent'
              />
              <Input
                placeholder='#3b82f6, rgb(...), hsl(...), cmyk(...)'
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
            placeholder='Optional description of when to use this highlight'
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
            {editingId != null ? "Update highlight" : "Create highlight"}
          </Button>
        </div>
      </form>

      <ConfirmationModal
        open={deletingId != null}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title='Delete highlight'
        message='Are you sure you want to delete this highlight? This action cannot be undone.'
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

      {!loading && !error && highlights.length === 0 && (
        <p className='py-12 text-center text-dr-text-muted'>
          No highlights yet. Create one above.
        </p>
      )}

      {!loading && !error && highlights.length > 0 && (
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
          {highlights.map((highlight) => (
            <div
              key={highlight.id}
              className='rounded-2xl border border-dr-border bg-dr-surface p-4'
            >
              <div className='mb-3 flex items-center justify-between gap-2'>
                <div className='flex min-w-0 items-center gap-2'>
                  <span
                    className='inline-block h-3 w-3 shrink-0 rounded-full'
                    style={{ backgroundColor: highlight.color }}
                  />
                  <span className='truncate font-semibold text-dr-text'>
                    {highlight.label}
                  </span>
                </div>
                <div className='flex shrink-0 items-center gap-1'>
                  <button
                    type='button'
                    onClick={() => startEdit(highlight)}
                    className='flex h-8 w-8 items-center justify-center rounded-lg border-none bg-transparent text-dr-accent transition-colors hover:bg-dr-accent-light'
                    aria-label='Edit highlight'
                    title='Edit highlight'
                  >
                    <ion-icon name='create-outline' />
                  </button>
                  <button
                    type='button'
                    onClick={() => setDeletingId(highlight.id)}
                    className='flex h-8 w-8 items-center justify-center rounded-lg border-none bg-transparent text-dr-danger transition-colors hover:bg-dr-danger/10'
                    aria-label='Delete highlight'
                    title='Delete highlight'
                  >
                    <ion-icon name='trash-outline' />
                  </button>
                </div>
              </div>
              {highlight.description && (
                <p className='text-sm text-dr-text-muted'>
                  {highlight.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
