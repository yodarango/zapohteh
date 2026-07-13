import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar/Sidebar";
import { Topbar } from "./Topbar/Topbar";

export const MainLayout = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className='min-h-screen bg-dr-bg p-3 md:p-6'>
      <div className='mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-[100rem] gap-3 md:gap-4 md:min-h-[calc(100vh-3rem)]'>
        {/* Desktop sidebar */}
        <div className='sticky top-3 z-20 hidden h-[80vh] w-60 shrink-0 self-start md:top-6 md:block'>
          <Sidebar />
        </div>

        {/* Mobile drawer */}
        {mobileMenuOpen && (
          <>
            <div
              className='fixed inset-0 z-30 bg-dr-text/50 backdrop-blur-sm md:hidden'
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className='fixed left-0 top-0 z-40 h-full w-64 md:hidden'>
              <Sidebar
                onClose={() => setMobileMenuOpen(false)}
                className='rounded-none border-y-0 border-l-0'
              />
            </div>
          </>
        )}

        <div className='flex min-w-0 flex-1 flex-col gap-3 md:gap-4'>
          <div className='sticky top-0 z-10'>
            <Topbar onMenuToggle={() => setMobileMenuOpen((v) => !v)} />
          </div>
          <main className='flex-1 overflow-y-auto rounded-3xl border border-dr-border bg-dr-surface px-5 py-6 shadow-sm md:px-8'>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};
