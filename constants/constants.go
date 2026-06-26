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

// context must have a predefined custom context key type
type contextKey string
const USER_CONTEXT_AUTH_KEY contextKey = "currentUser"
