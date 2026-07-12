import { useAppContext } from "@views/context/appContextProvider";
import { ROUTE_AUTH, ROUTE_AUTH_VERIFY } from "@constants";
import { Navigate, Outlet } from "react-router-dom";

export const ProtectedRoute = () => {
  const { state } = useAppContext();
  const { isAuthenticated, isPending, isLoading } = state;

  if (isLoading) {
    return <></>;
  }

  // Not authenticated -> login
  if (!isAuthenticated) {
    return <Navigate to={ROUTE_AUTH} replace />;
  }

  // Authenticated but not verified -> verification
  if (isPending) {
    return <Navigate to={ROUTE_AUTH_VERIFY} replace />;
  }

  return <Outlet />;
};
