import {
  IndexView,
  AuthView,
  AuthVerifyView,
  LearnView,
  CoursesView,
  SubjectsView,
  HighlightsView,
  MeView,
} from "@views";
import { MainLayout, ProtectedRoute, AuthRoute } from "@components";
import {
  createRoutesFromElements,
  createBrowserRouter,
  RouterProvider,
  Route,
  Outlet,
} from "react-router-dom";
import {
  ROUTE_AUTH_VERIFY,
  ROUTE_HOME,
  ROUTE_AUTH,
  ROUTE_LEARN,
  ROUTE_SUBJECTS,
  ROUTE_USERS_ME,
  ROUTE_CREATE,
  ROUTE_HIGHLIGHTS,
} from "@constants";

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<Outlet />}>
      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />} errorElement={<></>}>
          <Route path={ROUTE_HOME} element={<CoursesView />} />
          <Route path={ROUTE_CREATE} element={<IndexView />} />
          <Route path={ROUTE_SUBJECTS} element={<SubjectsView />} />
          <Route path={ROUTE_HIGHLIGHTS} element={<HighlightsView />} />
          <Route path={ROUTE_USERS_ME} element={<MeView />} />
          <Route path={`${ROUTE_LEARN}/:topic`} element={<LearnView />} />
        </Route>
      </Route>

      <Route element={<AuthRoute />}>
        <Route path={ROUTE_AUTH} element={<AuthView />} />
        <Route path={ROUTE_AUTH_VERIFY} element={<AuthVerifyView />} />
      </Route>
    </Route>,
  ),
);

export default function App() {
  return <RouterProvider router={router} />;
}
