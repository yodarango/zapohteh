import { createContext } from "react";

export const initialAppData = {
  state: {
    isAuthenticated: false,
    isModalOpen: false,
    isLearnMenuOpen: false,
    isPending: false,
    isLoading: true,
    isActive: false,
    toast: null,
    auth: {},
    user: {},
  },
};

export const defaultAppContext = {
  state: initialAppData.state,
  getUserFromToken: () => {},
  toggleMenu: () => {},
  openLearnMenu: () => {},
  closeLearnMenu: () => {},
  toggleLearnMenu: () => {},
  setupAuth: () => {},
  showToast: () => {},
  logout: () => {},
};

export const AppContext = createContext(defaultAppContext);
