import { useState } from "react";
import { ConfirmationModal } from "@ds";
import { API_DELETE_COURSE_HIGHLIGHTS } from "@constants";
import { authHeaders } from "@utils";
import { useAppContext } from "@views/context/appContextProvider";

export const HighlightCard = ({ highlight, onDelete }) => {
  const { showToast } = useAppContext();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const highlightColor = highlight.color || "#ffffff";

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`${API_DELETE_COURSE_HIGHLIGHTS}/${highlight.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
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

          <button
            type='button'
            onClick={() => setShowDeleteModal(true)}
            className='flex h-8 w-8 items-center justify-center rounded-lg border-none bg-transparent p-0 text-red-500 transition-colors hover:bg-red-50'
            aria-label='Delete highlight'
            title='Delete highlight'
          >
            <ion-icon name='trash-outline' className='text-xl'></ion-icon>
          </button>
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
              <ion-icon name='image-outline' className='text-5xl text-black/20' />
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
    </>
  );
};
