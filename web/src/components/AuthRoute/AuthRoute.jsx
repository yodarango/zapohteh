import { useAppContext } from "@views/context/appContextProvider";
import { ROUTE_AUTH, ROUTE_AUTH_VERIFY, ROUTE_HOME } from "@constants";
import { Navigate, Outlet, useLocation } from "react-router-dom";

export const AuthRoute = () => {
  const { state } = useAppContext();
  const { isAuthenticated, isPending, isLoading } = state;
  const location = useLocation();

  if (isLoading) {
    return <></>;
  }

  // Verified users should never see auth/verify pages.
  if (isAuthenticated && !isPending) {
    return <Navigate to={ROUTE_HOME} replace />;
  }

  // Unauthenticated users can only access the login page.
  if (!isAuthenticated && location.pathname === ROUTE_AUTH_VERIFY) {
    return <Navigate to={ROUTE_AUTH} replace />;
  }

  // Pending users must finish on the verification page.
  if (isPending && location.pathname === ROUTE_AUTH) {
    return <Navigate to={ROUTE_AUTH_VERIFY} replace />;
  }

  return <Outlet />;
};
