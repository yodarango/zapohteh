export const ROUTE_HOME = "/";
export const ROUTE_CREATE = "/create";
export const ROUTE_AUTH = "/auth";
export const ROUTE_AUTH_VERIFY = "/auth/verify";
export const ROUTE_LEARN = "/learn";
export const ROUTE_COURSES = "/courses";
export const ROUTE_USERS_ME = "/users/me";

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
export const API_DELETE_COURSE = API_BASE + "/courses";
export const API_PUT_COURSE = API_BASE + "/courses";
export const API_GET_COURSE_IMAGES = API_BASE + "/course-images";
export const API_PUT_COURSE_COVER = API_BASE + "/course-cover";
export const API_GET_COURSE_MD = API_BASE + "/course-md";
export const API_PUT_COURSE_MD = API_BASE + "/course-md";
export const API_GET_COURSE_HIGHLIGHTS = API_BASE + "/course-highlights";
export const API_PUT_COURSE_HIGHLIGHTS = API_BASE + "/course-highlights";
export const API_POST_COURSE_COVER_IMAGE = API_BASE + "/course-cover-image";
export const API_POST_CHAPTER_IMAGE = API_BASE + "/chapter-image";
export const API_GET_READING_PROGRESS = API_BASE + "/reading-progress";
export const API_POST_READING_PROGRESS = API_BASE + "/reading-progress";
export const API_GET_SUBJECTS = API_BASE + "/subjects";
export const API_POST_SUBJECTS = API_BASE + "/subjects";
export const API_PUT_SUBJECTS = API_BASE + "/subjects";
export const API_DELETE_SUBJECTS = API_BASE + "/subjects";
export const API_GET_COURSE_SUBJECTS = API_BASE + "/course-subjects";
export const API_POST_COURSE_SUBJECTS = API_BASE + "/course-subjects";
export const API_GET_CHAT = API_BASE + "/chat";
export const API_POST_CHAT = API_BASE + "/chat";

// tanjreen audiobook transformation API
export const TANJREEN_API_URL = import.meta.env.TANJREEN_API_URL;
export const TANJREEN_API_KEY = import.meta.env.TANJREEN_API_KEY;

export const ROUTE_SUBJECTS = "/subjects";

// user statuses
export const USER_STATUS_PENDING = "pending";
export const USER_STATUS_ACTIVE = "active";
export const USER_STATUS_DELETED = "deleted";
