export const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className='mt-20 border-t border-dr-accent bg-dr-surface py-4 md:py-6 lg:py-8 px-4 md:px-8'>
      <div className='mx-auto max-w-[1200px] text-center'>
        <p className='m-0 text-sm md:text-base text-dr-text opacity-70'>
          © {currentYear} Goilerplate. Built as a starting point for your next
          app.
        </p>
      </div>
    </footer>
  );
};
