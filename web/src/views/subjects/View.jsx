import { useState, useEffect } from "react";
import { Button, Input, TextArea, Loading, ConfirmationModal } from "@ds";
import {
  API_GET_SUBJECTS,
  API_POST_SUBJECTS,
  API_PUT_SUBJECTS,
  API_DELETE_SUBJECTS,
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
  return /^cmyk\(\s*[\d.]+%?\s*(,\s*[\d.]+%?\s*){3,4}\s*\)$/i.test(trimmed);
};

const TabButton = ({ active, onClick, children }) => (
  <button
    type='button'
    onClick={onClick}
    className={`px-4 py-2 text-sm font-semibold transition-colors ${
      active ? "border-b-3 border-blue-500" : "text-dr-text-muted"
    }`}
  >
    {children}
  </button>
);

export const SubjectsView = () => {
  const { showToast } = useAppContext();
  const [activeTab, setActiveTab] = useState("subjects");

  // Subject form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("");
  const [editingSubjectId, setEditingSubjectId] = useState(null);
  const [savingSubject, setSavingSubject] = useState(false);
  const [deletingSubjectId, setDeletingSubjectId] = useState(null);
  const [isDeletingSubject, setIsDeletingSubject] = useState(false);

  const {
    data: subjectsData,
    loading: subjectsLoading,
    error: subjectsError,
    refetch: refetchSubjects,
  } = useGet({ url: API_GET_SUBJECTS });
  const subjects = subjectsData || [];

  useEffect(() => {
    if (subjectsError) {
      showToast({ type: "danger", message: String(subjectsError) });
    }
  }, [subjectsError, showToast]);

  const resetSubjectForm = () => {
    setName("");
    setDescription("");
    setColor("");
    setEditingSubjectId(null);
  };

  const startEditSubject = (subject) => {
    setName(subject.name);
    setDescription(subject.description || "");
    setColor(subject.color);
    setEditingSubjectId(subject.id);
  };

  const handleSubjectSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !color.trim() || savingSubject) {
      showToast({ type: "danger", message: "Please enter a name and a color" });
      return;
    }

    setSavingSubject(true);
    try {
      const isEditing = editingSubjectId != null;
      const url = isEditing
        ? `${API_PUT_SUBJECTS}/${editingSubjectId}`
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
        resetSubjectForm();
        refetchSubjects();
      }
    } catch (err) {
      showToast({
        type: "danger",
        message: err.message || "Something went wrong",
      });
    } finally {
      setSavingSubject(false);
    }
  };

  const handleSubjectDelete = async () => {
    if (!deletingSubjectId) return;
    setIsDeletingSubject(true);
    try {
      const res = await fetch(`${API_DELETE_SUBJECTS}/${deletingSubjectId}`, {
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
        if (editingSubjectId === deletingSubjectId) {
          resetSubjectForm();
        }
        refetchSubjects();
      }
    } catch (err) {
      showToast({
        type: "danger",
        message: err.message || "Something went wrong",
      });
    } finally {
      setIsDeletingSubject(false);
      setDeletingSubjectId(null);
    }
  };

  // Highlight form state
  const [label, setLabel] = useState("");
  const [highlightDescription, setHighlightDescription] = useState("");
  const [highlightColor, setHighlightColor] = useState("");
  const [editingHighlightId, setEditingHighlightId] = useState(null);
  const [savingHighlight, setSavingHighlight] = useState(false);
  const [deletingHighlightId, setDeletingHighlightId] = useState(null);
  const [isDeletingHighlight, setIsDeletingHighlight] = useState(false);

  const {
    data: highlightsData,
    loading: highlightsLoading,
    error: highlightsError,
    refetch: refetchHighlights,
  } = useGet({ url: API_GET_HIGHLIGHTS });
  const highlights = highlightsData || [];

  useEffect(() => {
    if (highlightsError) {
      showToast({ type: "danger", message: String(highlightsError) });
    }
  }, [highlightsError, showToast]);

  const resetHighlightForm = () => {
    setLabel("");
    setHighlightDescription("");
    setHighlightColor("");
    setEditingHighlightId(null);
  };

  const startEditHighlight = (highlight) => {
    setLabel(highlight.label);
    setHighlightDescription(highlight.description || "");
    setHighlightColor(highlight.color);
    setEditingHighlightId(highlight.id);
  };

  const handleHighlightSubmit = async (e) => {
    e.preventDefault();
    if (!label.trim() || !highlightColor.trim() || savingHighlight) {
      showToast({
        type: "danger",
        message: "Please enter a label and a color",
      });
      return;
    }
    if (!isValidColor(highlightColor)) {
      showToast({
        type: "danger",
        message: "Please enter a valid color (hex, rgb, rgba, hsl, cmyk)",
      });
      return;
    }

    setSavingHighlight(true);
    try {
      const isEditing = editingHighlightId != null;
      const url = isEditing
        ? `${API_PUT_HIGHLIGHTS}/${editingHighlightId}`
        : API_POST_HIGHLIGHTS;
      const res = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          label: label.trim(),
          color: highlightColor.trim(),
          description: highlightDescription.trim(),
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
        resetHighlightForm();
        refetchHighlights();
      }
    } catch (err) {
      showToast({
        type: "danger",
        message: err.message || "Something went wrong",
      });
    } finally {
      setSavingHighlight(false);
    }
  };

  const handleHighlightDelete = async () => {
    if (!deletingHighlightId) return;
    setIsDeletingHighlight(true);
    try {
      const res = await fetch(
        `${API_DELETE_HIGHLIGHTS}/${deletingHighlightId}`,
        {
          method: "DELETE",
          headers: authHeaders(),
        },
      );
      const result = await res.json();
      if (result.error || !result.success) {
        showToast({
          type: "danger",
          message: String(result.error || "Failed to delete highlight"),
        });
      } else {
        showToast({ type: "success", message: "Highlight deleted" });
        if (editingHighlightId === deletingHighlightId) {
          resetHighlightForm();
        }
        refetchHighlights();
      }
    } catch (err) {
      showToast({
        type: "danger",
        message: err.message || "Something went wrong",
      });
    } finally {
      setIsDeletingHighlight(false);
      setDeletingHighlightId(null);
    }
  };

  return (
    <section>
      <h1 className='mb-1 text-2xl font-bold text-dr-text'>Organization</h1>
      <p className='mb-6 text-sm text-dr-text-muted'>
        Manage subjects and reusable highlight styles.
      </p>

      <div className='mb-6 flex items-center gap-2'>
        <TabButton
          active={activeTab === "subjects"}
          onClick={() => setActiveTab("subjects")}
        >
          Subjects
        </TabButton>
        <TabButton
          active={activeTab === "highlights"}
          onClick={() => setActiveTab("highlights")}
        >
          Highlights
        </TabButton>
      </div>

      {activeTab === "subjects" && (
        <>
          <form
            onSubmit={handleSubjectSubmit}
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
              {editingSubjectId != null && (
                <Button
                  type='button'
                  secondary
                  onClick={resetSubjectForm}
                  disabled={savingSubject}
                >
                  Cancel
                </Button>
              )}
              <Button
                primary
                disabled={savingSubject}
                isLoading={savingSubject}
              >
                {editingSubjectId != null ? "Update subject" : "Create subject"}
              </Button>
            </div>
          </form>

          <ConfirmationModal
            open={deletingSubjectId != null}
            onClose={() => setDeletingSubjectId(null)}
            onConfirm={handleSubjectDelete}
            title='Delete subject'
            message='Are you sure you want to delete this subject? This action cannot be undone.'
            confirmText='Delete'
            cancelText='Cancel'
            confirmVariant='danger'
            isLoading={isDeletingSubject}
          />

          {subjectsLoading && (
            <div className='flex justify-center py-12'>
              <Loading size={40} />
            </div>
          )}

          {!subjectsLoading && !subjectsError && subjects.length === 0 && (
            <p className='py-12 text-center text-dr-text-muted'>
              No subjects yet. Create one above.
            </p>
          )}

          {!subjectsLoading && !subjectsError && subjects.length > 0 && (
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
                        onClick={() => startEditSubject(subject)}
                        className='flex h-8 w-8 items-center justify-center rounded-lg border-none bg-transparent text-dr-accent transition-colors hover:bg-dr-accent-light'
                        aria-label='Edit subject'
                        title='Edit subject'
                      >
                        <ion-icon name='create-outline' />
                      </button>
                      <button
                        type='button'
                        onClick={() => setDeletingSubjectId(subject.id)}
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
        </>
      )}

      {activeTab === "highlights" && (
        <>
          <form
            onSubmit={handleHighlightSubmit}
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
                    value={
                      isValidColor(highlightColor) ? highlightColor : "#000000"
                    }
                    onChange={(e) => setHighlightColor(e.target.value)}
                    className='h-10 w-10 cursor-pointer rounded-lg border border-dr-border bg-transparent'
                  />
                  <Input
                    placeholder='#3b82f6, rgb(...), hsl(...), cmyk(...)'
                    value={highlightColor}
                    onChange={(e) => setHighlightColor(e.target.value)}
                    className='flex-1'
                  />
                </div>
              </div>
            </div>
            <div className='mt-4'>
              <TextArea
                label='Description'
                placeholder='Optional description of when to use this highlight'
                value={highlightDescription}
                onChange={(e) => setHighlightDescription(e.target.value)}
              />
            </div>
            <div className='mt-4 flex items-center justify-end gap-3'>
              {editingHighlightId != null && (
                <Button
                  type='button'
                  secondary
                  onClick={resetHighlightForm}
                  disabled={savingHighlight}
                >
                  Cancel
                </Button>
              )}
              <Button
                primary
                disabled={savingHighlight}
                isLoading={savingHighlight}
              >
                {editingHighlightId != null
                  ? "Update highlight"
                  : "Create highlight"}
              </Button>
            </div>
          </form>

          <ConfirmationModal
            open={deletingHighlightId != null}
            onClose={() => setDeletingHighlightId(null)}
            onConfirm={handleHighlightDelete}
            title='Delete highlight'
            message='Are you sure you want to delete this highlight? This action cannot be undone.'
            confirmText='Delete'
            cancelText='Cancel'
            confirmVariant='danger'
            isLoading={isDeletingHighlight}
          />

          {highlightsLoading && (
            <div className='flex justify-center py-12'>
              <Loading size={40} />
            </div>
          )}

          {!highlightsLoading &&
            !highlightsError &&
            highlights.length === 0 && (
              <p className='py-12 text-center text-dr-text-muted'>
                No highlights yet. Create one above.
              </p>
            )}

          {!highlightsLoading && !highlightsError && highlights.length > 0 && (
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
                        onClick={() => startEditHighlight(highlight)}
                        className='flex h-8 w-8 items-center justify-center rounded-lg border-none bg-transparent text-dr-accent transition-colors hover:bg-dr-accent-light'
                        aria-label='Edit highlight'
                        title='Edit highlight'
                      >
                        <ion-icon name='create-outline' />
                      </button>
                      <button
                        type='button'
                        onClick={() => setDeletingHighlightId(highlight.id)}
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
        </>
      )}
    </section>
  );
};
