package constants

const ROUTE_API_BASE = "/api"

const ROUTE_POST_LOGIN = ROUTE_API_BASE + "/login"
const ROUTE_POST_SIGNUP = ROUTE_API_BASE + "/signup"
const ROUTE_POST_VERIFY_EMAIL = ROUTE_API_BASE + "/verify-email"
const ROUTE_POST_FORGOT_PASSWORD = ROUTE_API_BASE + "/forgot-password"
const ROUTE_POST_CHANGE_PASSWORD = ROUTE_API_BASE + "/change-password"
const ROUTE_POST_UPDATE_PROFILE = ROUTE_API_BASE + "/update-profile"

// sample
const ROUTE_GET_AUTH_SAMPLE = ROUTE_API_BASE + "/auth-sample"
const ROUTE_GET_PUBLIC_SAMPLE = ROUTE_API_BASE + "/public-sample"

// learn about
const ROUTE_POST_LEARN_ABOUT = ROUTE_API_BASE + "/learn-about"
const ROUTE_GET_TOPIC = ROUTE_API_BASE + "/topic"
const ROUTE_GET_COURSES = ROUTE_API_BASE + "/courses"
const ROUTE_DELETE_COURSE = "DELETE " + ROUTE_API_BASE + "/courses/{id}"
const ROUTE_PUT_COURSE = "PUT " + ROUTE_API_BASE + "/courses/{id}"
const ROUTE_GET_COURSE_IMAGES = ROUTE_API_BASE + "/course-images"
const ROUTE_PUT_COURSE_COVER = ROUTE_API_BASE + "/course-cover"
const ROUTE_POST_COURSE_COVER_IMAGE = ROUTE_API_BASE + "/course-cover-image"
const ROUTE_POST_CHAPTER_IMAGE = ROUTE_API_BASE + "/chapter-image"
const ROUTE_GET_READING_PROGRESS = ROUTE_API_BASE + "/reading-progress"
const ROUTE_POST_READING_PROGRESS = ROUTE_API_BASE + "/reading-progress"
const ROUTE_GET_SUBJECTS = ROUTE_API_BASE + "/subjects"
const ROUTE_POST_SUBJECTS = ROUTE_API_BASE + "/subjects"
const ROUTE_PUT_SUBJECTS = ROUTE_API_BASE + "/subjects/"
const ROUTE_DELETE_SUBJECTS = ROUTE_API_BASE + "/subjects/"
const ROUTE_GET_COURSE_SUBJECTS = ROUTE_API_BASE + "/course-subjects"
const ROUTE_POST_COURSE_SUBJECTS = ROUTE_API_BASE + "/course-subjects"

// chat
const ROUTE_GET_CHAT = ROUTE_API_BASE + "/chat"
const ROUTE_POST_CHAT = ROUTE_API_BASE + "/chat"

// static files for generated research data (images, etc.)
const ROUTE_DATA_FILES = "/data/"

// tanjreen audiobook transformation API
const ROUTE_POST_TRANSFORM = ROUTE_API_BASE + "/transform"
const ROUTE_GET_DOWNLOAD = "GET " + ROUTE_API_BASE + "/download/{requestId}/{filename}"

// context must have a predefined custom context key type
type contextKey string
const USER_CONTEXT_AUTH_KEY contextKey = "currentUser"
const API_KEY_CONTEXT_KEY contextKey = "apiKey"
