import {
  IndexView,
  AuthView,
  AuthVerifyView,
  LearnView,
  CoursesView,
  SubjectsView,
  MeView,
} from "@views";
import { MainLayout } from "@components";
import {
  createRoutesFromElements,
  createBrowserRouter,
  RouterProvider,
  Route,
} from "react-router-dom";
import {
  ROUTE_AUTH_VERIFY,
  ROUTE_HOME,
  ROUTE_AUTH,
  ROUTE_LEARN,
  ROUTE_COURSES,
  ROUTE_SUBJECTS,
  ROUTE_USERS_ME,
} from "@constants";

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path={""} element={<MainLayout />} errorElement={<></>}>
      <Route path={ROUTE_HOME} element={<IndexView />} />
      <Route path={ROUTE_COURSES} element={<CoursesView />} />
      <Route path={ROUTE_SUBJECTS} element={<SubjectsView />} />
      <Route path={ROUTE_USERS_ME} element={<MeView />} />
      <Route path={ROUTE_AUTH} element={<AuthView />} />
      <Route path={ROUTE_AUTH_VERIFY} element={<AuthVerifyView />} />
      <Route path={`${ROUTE_LEARN}/:topic`} element={<LearnView />} />
    </Route>,
  ),
);

export default function App() {
  return <RouterProvider router={router} />;
}
