import { USER_STATUS_ACTIVE, USER_STATUS_PENDING } from "@constants";
import { initialAppData, AppContext } from "./appContext";
import { useContext, useEffect, useState } from "react";
import update from "immutability-helper";
import { Toast } from "@ds";

export const AppContextProvider = (props) => {
  const { children } = props;

  const [state, setState] = useState(initialAppData.state);

  function toggleMenu() {
    setState((prevState) =>
      update(prevState, {
        isModalOpen: { $set: !prevState.isModalOpen },
      })
    );
  }

  // Get auth token from localStorage and decode user data
  function setupAuth() {
    const token = localStorage.getItem("auth");

    if (token) {
      const userData = getUserFromToken();

      if (userData) {
        setState((prevState) =>
          update(prevState, {
            isPending: {
              $set:
                userData.status === USER_STATUS_PENDING &&
                userData.status !== USER_STATUS_ACTIVE,
            },
            isActive: {
              $set:
                userData.status === USER_STATUS_ACTIVE &&
                userData.status !== USER_STATUS_PENDING,
            },
            isAuthenticated: { $set: true },
            isLoading: { $set: false },
            user: { $set: userData },
            auth: { $set: token },
          })
        );
      }
    }
  }

  // Function to decode JWT token and get user data
  function getUserFromToken() {
    const token = localStorage.getItem("auth");
    if (!token) return {};

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return {
        first_name: payload.first_name,
        last_name: payload.last_name,
        avatar: payload.avatar,
        status: payload.status,
        email: payload.email,
        id: payload.id,
      };
    } catch (error) {
      console.error("Error decoding token:", error);
      return {};
    }
  }

  // Logout function
  function logout() {
    localStorage.removeItem("auth");
    setState((prevState) =>
      update(prevState, {
        isAuthenticated: { $set: false },
        auth: { $set: {} },
        user: { $set: {} },
      })
    );
  }

  // Show toast with given parameters
  function showToast(toast) {
    setState((prevState) =>
      update(prevState, {
        toast: { $set: toast },
      })
    );
  }

  // Hide toast
  function handleHideToast() {
    setState((prevState) =>
      update(prevState, {
        toast: { $set: null },
      })
    );
  }

  useEffect(() => {
    setupAuth();
  }, []);

  return (
    <AppContext.Provider
      value={{
        getUserFromToken,
        toggleMenu,
        setupAuth,
        showToast,
        logout,
        state,
      }}
    >
      <Toast
        style={{ zIndex: state.toast?.zIndex || 15 }}
        onClose={handleHideToast}
        type={state.toast?.type}
        open={!!state.toast}
      >
        {state.toast?.message}
      </Toast>
      {children}
    </AppContext.Provider>
  );
};

export function useAppContext() {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error("useAppContext must be used within an AppContextProvider");
  }

  return context;
}
