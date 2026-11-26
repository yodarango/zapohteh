import {
  IndexView,
  AuthView,
  AuthVerifyView,
  LearnView,
  CoursesView,
  SubjectsView,
  HighlightsView,
  MeView,
  ShareView,
  NotificationsView,
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
  ROUTE_VIRTUALS,
  ROUTE_VIRTUAL_READER,
  ROUTE_SUBJECTS,
  ROUTE_USERS_ME,
  ROUTE_CREATE,
  ROUTE_HIGHLIGHTS,
  ROUTE_SHARE,
  ROUTE_NOTIFICATIONS,
} from "@constants";

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<Outlet />}>
      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />} errorElement={<></>}>
          <Route path={ROUTE_HOME} element={<CoursesView key='courses' />} />
          <Route path={ROUTE_VIRTUALS} element={<CoursesView key='virtuals' virtuals />} />
          <Route path={ROUTE_CREATE} element={<IndexView />} />
          <Route path={ROUTE_NOTIFICATIONS} element={<NotificationsView />} />
          <Route path={ROUTE_SUBJECTS} element={<SubjectsView />} />
          <Route path={ROUTE_HIGHLIGHTS} element={<HighlightsView />} />
          <Route path={ROUTE_USERS_ME} element={<MeView />} />
          <Route path={`${ROUTE_LEARN}/:topic`} element={<LearnView />} />
          <Route path={`${ROUTE_VIRTUAL_READER}/:topic`} element={<LearnView />} />
        </Route>
      </Route>

      <Route element={<AuthRoute />}>
        <Route path={ROUTE_AUTH} element={<AuthView />} />
        <Route path={ROUTE_AUTH_VERIFY} element={<AuthVerifyView />} />
      </Route>

      {/* public shared-lesson page (no authentication required) */}
      <Route path={`${ROUTE_SHARE}/:token`} element={<ShareView />} />
    </Route>,
  ),
);

export default function App() {
  return <RouterProvider router={router} />;
}
