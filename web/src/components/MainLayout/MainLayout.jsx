import { useEffect, useRef, useState } from "react";
import { Outlet, useMatch } from "react-router-dom";
import { ROUTE_LEARN, ROUTE_VIRTUAL_READER } from "@constants";
import { Sidebar } from "./Sidebar/Sidebar";
import { Topbar } from "./Topbar/Topbar";

const MIN_SIDEBAR_WIDTH = 280;
const MAX_SIDEBAR_WIDTH = 600;
const DEFAULT_NOTES_WIDTH = 350;

const clampWidth = (width, maxWidth = MAX_SIDEBAR_WIDTH) =>
  Math.max(Math.min(MIN_SIDEBAR_WIDTH, maxWidth), Math.min(maxWidth, width));

const ResizeHandle = ({ width, onResize, mobile = false, compact = false }) => {
  const drag = useRef(null);
  const maxWidth = mobile ? Math.min(MAX_SIDEBAR_WIDTH, window.innerWidth - 16) : MAX_SIDEBAR_WIDTH;
  const currentWidth = compact ? 64 : clampWidth(width, maxWidth);

  const resize = (nextWidth) => {
    if (compact && nextWidth <= 64) return;
    onResize(clampWidth(nextWidth, maxWidth));
  };

  return (
    <div
      role='separator'
      aria-label='Resize study sidebar'
      aria-orientation='vertical'
      aria-valuemin={compact ? 64 : Math.min(MIN_SIDEBAR_WIDTH, maxWidth)}
      aria-valuemax={maxWidth}
      aria-valuenow={currentWidth}
      tabIndex={0}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        drag.current = { x: event.clientX, width: currentWidth };
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
      }}
      onPointerMove={(event) => {
        if (drag.current) resize(drag.current.width + event.clientX - drag.current.x);
      }}
      onPointerUp={() => { drag.current = null; }}
      onPointerCancel={() => { drag.current = null; }}
      onLostPointerCapture={() => { drag.current = null; }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          resize(currentWidth + (event.key === "ArrowRight" ? 10 : -10));
        } else if (event.key === "Home" || event.key === "End") {
          event.preventDefault();
          resize(event.key === "Home" ? (compact ? 64 : MIN_SIDEBAR_WIDTH) : maxWidth);
        }
      }}
      className='group absolute inset-y-0 right-0 z-10 flex w-2 cursor-col-resize touch-none items-center justify-center outline-none hover:bg-dr-accent/20 focus-visible:bg-dr-accent/30'
    >
      <span aria-hidden='true' className='h-10 w-0.5 rounded-full bg-dr-border group-hover:bg-dr-accent group-focus-visible:bg-dr-accent' />
    </div>
  );
};

export const MainLayout = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [desktopNotesOpen, setDesktopNotesOpen] = useState(false);
  const [mobileNotesOpen, setMobileNotesOpen] = useState(false);
  const [desktopNavExpanded, setDesktopNavExpanded] = useState(false);
  const [mobileNavExpanded, setMobileNavExpanded] = useState(false);
  const [desktopNotesWidth, setDesktopNotesWidth] = useState(DEFAULT_NOTES_WIDTH);
  const [mobileNotesWidth, setMobileNotesWidth] = useState(DEFAULT_NOTES_WIDTH);
  const [desktopNavWidth, setDesktopNavWidth] = useState(MIN_SIDEBAR_WIDTH);
  const [mobileNavWidth, setMobileNavWidth] = useState(MIN_SIDEBAR_WIDTH);
  const studyMatch = useMatch(`${ROUTE_LEARN}/:topic`);
  const virtualMatch = useMatch(`${ROUTE_VIRTUAL_READER}/:topic`);
  const isStudyPage = !!(studyMatch || virtualMatch);

  useEffect(() => {
    if (!isStudyPage) {
      setDesktopNotesOpen(false);
      setMobileNotesOpen(false);
      setDesktopNavExpanded(false);
      setMobileNavExpanded(false);
    }
  }, [isStudyPage]);

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
    setMobileNotesOpen(false);
    setMobileNavExpanded(false);
  };

  return (
    <div className='min-h-screen bg-dr-bg'>
      <div className='flex min-h-screen'>
        {/* Desktop sidebar */}
        <div
          className='sticky top-0 z-20 hidden h-screen shrink-0 self-start lg:block'
          style={{ width: isStudyPage ? (desktopNotesOpen ? desktopNotesWidth : desktopNavExpanded ? desktopNavWidth : 64) : 280 }}
        >
          <Sidebar compact={isStudyPage && !desktopNavExpanded} notesOpen={desktopNotesOpen} onNotesToggle={() => setDesktopNotesOpen((open) => !open)} onExpandToggle={() => { setDesktopNavExpanded((expanded) => !expanded); if (desktopNavExpanded) setDesktopNotesOpen(false); }} />
          {isStudyPage && (
            <ResizeHandle
              compact={!desktopNotesOpen && !desktopNavExpanded}
              width={desktopNotesOpen ? desktopNotesWidth : desktopNavExpanded ? desktopNavWidth : 64}
              onResize={(width) => {
                if (desktopNotesOpen) setDesktopNotesWidth(width);
                else { setDesktopNavWidth(width); setDesktopNavExpanded(true); }
              }}
            />
          )}
        </div>

        {/* Mobile drawer */}
        {mobileMenuOpen && (
          <>
            <div
              className='fixed inset-0 z-30 bg-dr-text/50 backdrop-blur-sm lg:hidden'
              onClick={closeMobileMenu}
            />
            <div
              id='main-navigation'
              className='fixed left-0 top-0 z-40 h-full max-w-[calc(100vw-1rem)] lg:hidden'
              style={{ width: isStudyPage ? (mobileNotesOpen ? mobileNotesWidth : mobileNavExpanded ? mobileNavWidth : 64) : 256 }}
            >
              <Sidebar onClose={closeMobileMenu} compact={isStudyPage && !mobileNavExpanded} notesOpen={mobileNotesOpen} onNotesToggle={() => setMobileNotesOpen((open) => !open)} onExpandToggle={() => { setMobileNavExpanded((expanded) => !expanded); if (mobileNavExpanded) setMobileNotesOpen(false); }} />
              {isStudyPage && (
                <ResizeHandle
                  mobile
                  compact={!mobileNotesOpen && !mobileNavExpanded}
                  width={mobileNotesOpen ? mobileNotesWidth : mobileNavExpanded ? mobileNavWidth : 64}
                  onResize={(width) => {
                    if (mobileNotesOpen) setMobileNotesWidth(width);
                    else { setMobileNavWidth(width); setMobileNavExpanded(true); }
                  }}
                />
              )}
            </div>
          </>
        )}

        <div className='flex min-w-0 flex-1 flex-col'>
          <div className='sticky top-0 z-10'>
            <Topbar
              onMenuToggle={() => setMobileMenuOpen((v) => !v)}
              isMenuOpen={mobileMenuOpen}
            />
          </div>
          <main className={isStudyPage ? 'w-full min-w-0 flex-1' : 'mx-auto w-full max-w-[100rem] min-w-0 flex-1 px-4 py-6 lg:px-8'}>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};
