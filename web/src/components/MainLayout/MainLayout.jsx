import { useEffect, useState } from "react";
import { Outlet, useMatch } from "react-router-dom";
import { ROUTE_LEARN } from "@constants";
import { Sidebar } from "./Sidebar/Sidebar";
import { Topbar } from "./Topbar/Topbar";

export const MainLayout = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [desktopNotesOpen, setDesktopNotesOpen] = useState(false);
  const [mobileNotesOpen, setMobileNotesOpen] = useState(false);
  const [desktopNavExpanded, setDesktopNavExpanded] = useState(false);
  const [mobileNavExpanded, setMobileNavExpanded] = useState(false);
  const isStudyPage = !!useMatch(`${ROUTE_LEARN}/:topic`);

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
        <div className={`sticky top-0 z-20 hidden h-screen shrink-0 self-start lg:block ${isStudyPage && !desktopNotesOpen && !desktopNavExpanded ? "w-16" : "w-[280px]"}`}>
          <Sidebar compact={isStudyPage && !desktopNavExpanded} notesOpen={desktopNotesOpen} onNotesToggle={() => setDesktopNotesOpen((open) => !open)} onExpandToggle={() => { setDesktopNavExpanded((expanded) => !expanded); if (desktopNavExpanded) setDesktopNotesOpen(false); }} />
        </div>

        {/* Mobile drawer */}
        {mobileMenuOpen && (
          <>
            <div
              className='fixed inset-0 z-30 bg-dr-text/50 backdrop-blur-sm lg:hidden'
              onClick={closeMobileMenu}
            />
            <div id='main-navigation' className={`fixed left-0 top-0 z-40 h-full lg:hidden ${isStudyPage && !mobileNotesOpen && !mobileNavExpanded ? "w-16" : "w-64"}`}>
              <Sidebar onClose={closeMobileMenu} compact={isStudyPage && !mobileNavExpanded} notesOpen={mobileNotesOpen} onNotesToggle={() => setMobileNotesOpen((open) => !open)} onExpandToggle={() => { setMobileNavExpanded((expanded) => !expanded); if (mobileNavExpanded) setMobileNotesOpen(false); }} />
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
          <main className='mx-auto w-full max-w-[100rem] min-w-0 flex-1 px-4 py-6 lg:px-8'>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};
