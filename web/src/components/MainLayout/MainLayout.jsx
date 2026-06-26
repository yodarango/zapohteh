import { useAppContext } from "../../views/context/appContextProvider";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Header } from "./Header/Header";
import { Footer } from "./Footer/Footer";
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
    <div className='flex min-h-screen flex-col'>
      <Header />
      <main className='mx-auto w-[92%] max-w-[60rem] flex-1 px-4 py-4 md:px-8'>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};
