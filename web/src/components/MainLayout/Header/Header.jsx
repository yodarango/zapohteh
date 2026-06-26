import { Link } from "react-router-dom";
import { ROUTE_HOME } from "@constants";
import goilerplateLogo from "../../../../public/logo.png";

export const Header = () => {
  return (
    <header className='sticky top-0 z-10 mb-20 border-b border-dr-accent bg-dr-surface/95 backdrop-blur'>
      <div className='mx-auto flex w-full max-w-[1200px] items-center justify-between px-4 py-4 md:px-8'>
        <Link
          to={ROUTE_HOME}
          className='flex items-center gap-3 text-dr-text no-underline transition-opacity duration-200 hover:opacity-80'
        >
          <div className='flex h-14 w-14 items-center justify-center rounded-lg bg-gradient-to-br from-dr-accent to-dr-accent-light text-white'>
            <img
              src={goilerplateLogo}
              alt='Goilerplate Logo'
              className='h-full w-full'
            />
          </div>
          <span className='text-2xl font-bold text-dr-text'>Goilerplate</span>
        </Link>
      </div>
    </header>
  );
};
