import { USER_STATUS_ACTIVE, USER_STATUS_PENDING, API_NOTIFICATIONS } from "@constants";
import { initialAppData, AppContext } from "./appContext";
import { useContext, useEffect, useState, useCallback } from "react";
import update from "immutability-helper";
import { Toast } from "@ds";

export const AppContextProvider = (props) => {
  const { children } = props;

  const [state, setState] = useState(initialAppData.state);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const refreshNotifications = useCallback(async () => {
    if (!state.isAuthenticated) return;
    const token = localStorage.getItem("auth");
    try {
      const response = await fetch(`${API_NOTIFICATIONS}/unread-count`, {
        headers: { Authorization: "Bearer " + token },
      });
      const result = await response.json();
      if (response.ok && result.success && localStorage.getItem("auth") === token) setUnreadNotifications(result.data.count);
    } catch {
      // Keep the previous count until the next successful refresh.
    }
  }, [state.isAuthenticated]);

  useEffect(() => {
    if (!state.isAuthenticated) return;
    refreshNotifications();
    const timer = setInterval(refreshNotifications, 15000);
    const onFocus = () => refreshNotifications();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [state.isAuthenticated, refreshNotifications]);

  function toggleMenu() {
    setState((prevState) =>
      update(prevState, {
        isModalOpen: { $set: !prevState.isModalOpen },
      }),
    );
  }

  function toggleLearnMenu() {
    setState((prevState) =>
      update(prevState, {
        isLearnMenuOpen: { $set: !prevState.isLearnMenuOpen },
      }),
    );
  }

  function openLearnMenu() {
    setState((prevState) =>
      update(prevState, {
        isLearnMenuOpen: { $set: true },
      }),
    );
  }

  function closeLearnMenu() {
    setState((prevState) =>
      update(prevState, {
        isLearnMenuOpen: { $set: false },
      }),
    );
  }

  // Get auth token from localStorage and decode user data
  function setupAuth() {
    const token = localStorage.getItem("auth");
    const userData = getUserFromToken();

    if (!token || !userData.id) {
      setState((prevState) =>
        update(prevState, {
          isAuthenticated: { $set: false },
          isLoading: { $set: false },
          auth: { $set: {} },
          user: { $set: {} },
        }),
      );
      return;
    }

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
      }),
    );
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
        username: payload.username,
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
    setUnreadNotifications(0);
    setState((prevState) =>
      update(prevState, {
        isAuthenticated: { $set: false },
        auth: { $set: {} },
        user: { $set: {} },
      }),
    );
  }

  // Show toast with given parameters
  const showToast = useCallback((toast) => {
    setState((prevState) =>
      update(prevState, {
        toast: { $set: toast },
      }),
    );
  }, []);

  // Hide toast
  const handleHideToast = useCallback(() => {
    setState((prevState) =>
      update(prevState, {
        toast: { $set: null },
      }),
    );
  }, []);

  useEffect(() => {
    setupAuth();
  }, []);

  return (
    <AppContext.Provider
      value={{
        getUserFromToken,
        toggleMenu,
        toggleLearnMenu,
        openLearnMenu,
        closeLearnMenu,
        setupAuth,
        showToast,
        unreadNotifications,
        refreshNotifications,
        logout,
        state,
      }}
    >
      <Toast
        style={{ zIndex: state.toast?.zIndex || 100 }}
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
