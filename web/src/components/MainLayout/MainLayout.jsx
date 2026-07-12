import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar/Sidebar";
import { Topbar } from "./Topbar/Topbar";

export const MainLayout = () => {
  return (
    <div className='min-h-screen bg-dr-bg p-3 md:p-6'>
      <div className='mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-[80rem] gap-3 md:gap-4 md:min-h-[calc(100vh-3rem)]'>
        <div className='sticky top-3 z-20 h-[80vh] w-60 shrink-0 self-start md:top-6'>
          <Sidebar />
        </div>
        <div className='flex min-w-0 flex-1 flex-col gap-3 md:gap-4'>
          <div className='sticky top-0 z-10'>
            <Topbar />
          </div>
          <main className='flex-1 overflow-y-auto rounded-3xl border border-dr-border bg-dr-surface px-5 py-6 shadow-sm md:px-8'>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};
