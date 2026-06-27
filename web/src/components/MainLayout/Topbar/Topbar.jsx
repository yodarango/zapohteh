// Top bar of the dashboard shell: notifications on the left of a search box,
// mirroring the reference design.
export const Topbar = () => {
  return (
    <header className='flex items-center justify-end gap-4 border-b border-dr-border px-6 py-4'>
      <button
        type='button'
        className='flex items-center gap-2 text-sm font-medium text-dr-text-muted transition-colors hover:text-dr-text'
      >
        <ion-icon name='notifications-outline' className='text-lg'></ion-icon>
        <span className='hidden sm:inline'>Notifications</span>
      </button>

      <div className='relative w-full max-w-xs'>
        <ion-icon
          name='search-outline'
          className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dr-text-muted'
        ></ion-icon>
        <input
          type='search'
          placeholder='Search courses'
          className='w-full rounded-xl border border-dr-border bg-dr-surface-light py-2 pl-9 pr-3 text-sm text-dr-text outline-none transition-colors placeholder:text-dr-text-muted focus:border-dr-accent'
        />
      </div>
    </header>
  );
};
