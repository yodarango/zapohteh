import { Button, Portal } from "@ds";

export const ConfirmationModal = ({
  open,
  onClose,
  onConfirm,
  title = "Confirm",
  message = "Are you sure?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmVariant = "danger",
  cancelVariant = "secondary",
  isLoading = false,
  zIndex = 20,
}) => {
  if (!open) return null;

  const handleBackdropClick = () => {
    if (onClose && !isLoading) onClose();
  };

  const handleContentClick = (e) => {
    e.stopPropagation();
  };

  return (
    <Portal>
      <div
        className='fixed inset-0 z-10 flex items-center justify-center p-4'
        style={{ zIndex: zIndex + 1 }}
        onClick={handleBackdropClick}
      >
        <div
          className='relative w-full max-w-[28rem] overflow-hidden rounded-2xl border border-dr-border bg-dr-surface p-6 shadow-lg'
          style={{ zIndex: zIndex + 2 }}
          onClick={handleContentClick}
        >
          <h4 className='mb-2 text-center text-lg font-bold text-dr-text'>
            {title}
          </h4>
          <p className='mb-6 text-center text-sm text-dr-text-muted'>
            {message}
          </p>
          <div className='flex items-center justify-center gap-3'>
            <Button
              onClick={onClose}
              disabled={isLoading}
              className='w-1/2'
              {...{ [cancelVariant]: true }}
            >
              {cancelText}
            </Button>
            <Button
              onClick={onConfirm}
              isLoading={isLoading}
              className='w-1/2'
              {...{ [confirmVariant]: true }}
            >
              {confirmText}
            </Button>
          </div>
        </div>
      </div>
      <div
        className='fixed inset-0 bg-dr-accent/40'
        style={{ zIndex }}
        onClick={handleBackdropClick}
      />
    </Portal>
  );
};
