import { useAppContext } from "../../views/context/appContextProvider";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar/Sidebar";
import { Topbar } from "./Topbar/Topbar";
import { ROUTE_AUTH_VERIFY, ROUTE_HOME, ROUTE_AUTH } from "@constants";

import { useEffect } from "react";

export const MainLayout = () => {
  const { state } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (state.isLoading) return;

    // If the user is logged in but still needs to verify their email
    if (
      location.pathname === ROUTE_HOME &&
      state.isAuthenticated &&
      state.isPending
    ) {
      return navigate(ROUTE_AUTH_VERIFY);
    }

    // If the user is verified and tries to access auth pages, send them home
    if (
      [ROUTE_AUTH, ROUTE_AUTH_VERIFY].includes(location.pathname) &&
      state.isActive
    ) {
      return navigate(ROUTE_HOME);
    }

    // If the user is not logged in but is trying to access the verification page
    if (location.pathname === ROUTE_AUTH_VERIFY && !state.isAuthenticated) {
      return navigate(ROUTE_AUTH);
    }
  }, [
    location,
    navigate,
    state.isAuthenticated,
    state.isActive,
    state.isLoading,
    state.isPending,
  ]);

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
