export const ROUTE_HOME = "/";
export const ROUTE_AUTH = "/auth";
export const ROUTE_AUTH_VERIFY = "/auth/verify";
export const ROUTE_LEARN = "/learn";
export const ROUTE_COURSES = "/courses";

// api base
export const API_BASE = import.meta.env.VITE_API_BASE || "/api";

// api auth routes
export const API_POST_LOGIN = API_BASE + "/login";
export const API_POST_SIGNUP = API_BASE + "/signup";
export const API_GET_VERIFY_EMAIL = API_BASE + "/verify-email";
export const API_POST_FORGOT_PASSWORD = API_BASE + "/forgot-password";
export const API_POST_CHANGE_PASSWORD = API_BASE + "/change-password";
export const API_POST_UPDATE_PROFILE = API_BASE + "/update-profile";

// api learn routes
export const API_POST_LEARN_ABOUT = API_BASE + "/learn-about";
export const API_GET_TOPIC = API_BASE + "/topic";
export const API_GET_COURSES = API_BASE + "/courses";

// user statuses
export const USER_STATUS_PENDING = "pending";
export const USER_STATUS_ACTIVE = "active";
export const USER_STATUS_DELETED = "deleted";
