import { useAppContext } from "../../views/context/appContextProvider";
import { ROUTE_AUTH, ROUTE_AUTH_VERIFY } from "@constants";
import { Navigate } from "react-router-dom";
import React from "react";

export const ProtectedRoute = ({ children }) => {
  const { state } = useAppContext();
  const { isAuthenticated, isPending, isLoading } = state;

  if (isLoading) {
    return <></>;
  }

  // if the user has not yet verified their eamil
  if (isPending) {
    return <Navigate to={ROUTE_AUTH_VERIFY} replace />;
  }

  // If user is not authenticated but it has already been verified, redirect to auth page
  if (!isAuthenticated) {
    return <Navigate to={ROUTE_AUTH} replace />;
  }

  return children;
};
