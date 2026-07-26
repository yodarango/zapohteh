import { useState } from "react";
import { ConfirmationModal, Modal, Button, TextArea } from "@ds";
import {
  API_DELETE_COURSE_HIGHLIGHTS,
  API_GET_COURSE_HIGHLIGHTS,
  API_PUT_COURSE_HIGHLIGHTS,
} from "@constants";
import { authHeaders } from "@utils";
import { useAppContext } from "@views/context/appContextProvider";

export const HighlightCard = ({
  highlight,
  userHighlights,
  onDelete,
  onUpdate,
}) => {
  const { showToast } = useAppContext();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editText, setEditText] = useState(highlight.text || "");
  const [editHighlightId, setEditHighlightId] = useState(
    highlight.highlightId || 0,
  );
  const [editNote, setEditNote] = useState(highlight.note || "");
  const highlightColor = highlight.color || "#ffffff";

  const openEditModal = () => {
    setEditText(highlight.text || "");
    setEditHighlightId(highlight.highlightId || 0);
    setEditNote(highlight.note || "");
    setShowEditModal(true);
  };

  const handleSave = async () => {
    if (!editHighlightId) {
      showToast({ type: "danger", message: "Please select a highlight color" });
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(
        `${API_GET_COURSE_HIGHLIGHTS}?topic=${encodeURIComponent(highlight.courseTitle)}`,
        { headers: authHeaders() },
      );
      const result = await res.json();
      if (!res.ok || result.error) {
        throw new Error(result.error || "Failed to load course highlights");
      }
      const courseHighlights = result.data?.highlights || [];
      const updatedHighlights = courseHighlights.map((h) =>
        h.text === highlight.text &&
        h.highlightId === highlight.highlightId &&
        h.chapter === highlight.chapter
          ? {
              ...h,
              text: editText.trim(),
              highlightId: Number(editHighlightId),
              note: editNote.trim(),
            }
          : h,
      );
      const saveRes = await fetch(API_PUT_COURSE_HIGHLIGHTS, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({
          topic: highlight.courseTitle,
          highlights: updatedHighlights,
        }),
      });
      const saveResult = await saveRes.json();
      if (!saveRes.ok || saveResult.error) {
        throw new Error(saveResult.error || "Failed to save highlights");
      }
      showToast({ type: "success", message: "Highlight updated" });
      setShowEditModal(false);
      onUpdate();
    } catch (err) {
      showToast({
        type: "danger",
        message: err.message || "Failed to update highlight",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(
        `${API_DELETE_COURSE_HIGHLIGHTS}/${highlight.id}`,
        {
          method: "DELETE",
          headers: authHeaders(),
        },
      );
      const result = await res.json();
      if (!res.ok || result.error) {
        throw new Error(result.error || "Failed to delete highlight");
      }
      showToast({ type: "success", message: "Highlight deleted" });
      onDelete(highlight.id);
    } catch (err) {
      showToast({
        type: "danger",
        message: err.message || "Failed to delete highlight",
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  return (
    <>
      <article className='w-full overflow-hidden rounded-2xl border border-dr-border bg-white min-[700px]:min-w-[330px] min-[700px]:max-w-[500px] min-[700px]:flex-1'>
        <header className='flex items-center gap-3 border-b border-black/10 px-4 py-3'>
          <div
            className='h-10 w-10 shrink-0 rounded-full border-2 border-black/10'
            style={{ backgroundColor: highlightColor }}
            aria-hidden='true'
          />

          <div className='min-w-0 flex-1'>
            <h3 className='truncate text-sm font-semibold text-black'>
              {highlight.courseTitle}
            </h3>

            {highlight.lessonTitle && (
              <p className='truncate text-xs text-black/60'>
                {highlight.lessonTitle}
              </p>
            )}

            {highlight.chapter && (
              <p className='truncate text-xs text-black/60'>
                {highlight.chapter}
              </p>
            )}
          </div>

          <div className='flex gap-2=1'>
            <button
              type='button'
              onClick={openEditModal}
              className='flex h-8 w-8 items-center justify-center rounded-lg border-none bg-transparent p-0 text-dr-accent transition-colors hover:bg-dr-accent/10'
              aria-label='Edit highlight'
              title='Edit highlight'
            >
              <ion-icon name='create-outline' className='text-xl'></ion-icon>
            </button>
            <button
              type='button'
              onClick={() => setShowDeleteModal(true)}
              className='flex h-8 w-8 items-center justify-center rounded-lg border-none bg-transparent p-0 text-red-500 transition-colors hover:bg-red-50'
              aria-label='Delete highlight'
              title='Delete highlight'
            >
              <ion-icon name='trash-outline' className='text-xl'></ion-icon>
            </button>
          </div>
        </header>

        <div className='relative aspect-square overflow-hidden bg-white'>
          {highlight.coverImagePath ? (
            <img
              src={highlight.coverImagePath}
              alt={highlight.courseTitle}
              className='absolute inset-0 h-full w-full object-cover opacity-30'
            />
          ) : (
            <div className='absolute inset-0 flex items-center justify-center bg-white'>
              <ion-icon
                name='image-outline'
                className='text-5xl text-black/20'
              />
            </div>
          )}

          <div className='absolute inset-0 bg-white/20' />

          <div className='relative z-10 flex h-full items-center justify-center p-8'>
            <blockquote className='max-w-md text-center text-xl font-bold leading-relaxed text-black sm:text-2xl'>
              “{highlight.text}”
            </blockquote>
          </div>
        </div>

        <div className='border-t border-black/10 bg-white px-4 py-4'>
          {highlight.note && (
            <p className='text-sm leading-relaxed text-black'>
              {highlight.subjects && highlight.subjects.length > 0 ? (
                highlight.subjects.map((subject) => (
                  <span
                    key={subject.id}
                    className='mr-2 inline-flex items-center gap-1.5'
                  >
                    <span
                      className='inline-block h-2.5 w-2.5 rounded-full'
                      style={{ backgroundColor: subject.color }}
                      title={subject.name}
                    />
                    <span className='font-semibold'>{subject.name}</span>
                  </span>
                ))
              ) : (
                <span className='mr-2 inline-flex items-center gap-1.5'>
                  <span className='inline-block h-2.5 w-2.5 rounded-full bg-gray-200' />
                  <span className='font-semibold'>General</span>
                </span>
              )}
              {highlight.note}
            </p>
          )}
        </div>
      </article>

      <ConfirmationModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title='Delete highlight'
        message={`Are you sure you want to delete this highlight from "${highlight.courseTitle}"? This action cannot be undone.`}
        confirmText='Delete'
        cancelText='Cancel'
        confirmVariant='danger'
        isLoading={isDeleting}
      />

      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title='Edit highlight'
        zIndex={30}
      >
        <div className='flex flex-col gap-4'>
          <TextArea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            placeholder='Highlighted text...'
            minRows={2}
            maxRows={6}
            className='text-sm'
          />
          {userHighlights.length === 0 ? (
            <p className='text-xs text-dr-text-muted'>
              No highlights yet. Create them in the Highlights page.
            </p>
          ) : (
            <div className='flex flex-wrap items-center gap-2'>
              {userHighlights.map((uh) => {
                const selected = editHighlightId === uh.id;
                return (
                  <button
                    key={uh.id}
                    type='button'
                    onClick={() => setEditHighlightId(uh.id)}
                    className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all ${
                      selected ? "border-dr-text" : "border-transparent"
                    }`}
                    style={{ backgroundColor: uh.color }}
                    title={uh.label}
                    aria-label={uh.label}
                  >
                    {selected && (
                      <ion-icon
                        name='checkmark-outline'
                        className='text-xs text-white'
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}
          <TextArea
            value={editNote}
            onChange={(e) => setEditNote(e.target.value)}
            placeholder='Add a note (optional)...'
            minRows={2}
            maxRows={4}
            className='text-sm'
          />
          <div className='flex justify-end gap-2'>
            <Button
              secondary
              onClick={() => setShowEditModal(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              primary
              disabled={!editHighlightId || isSaving}
              isLoading={isSaving}
              onClick={handleSave}
            >
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
