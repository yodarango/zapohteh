import { IndexView, AuthView, AuthVerifyView, LearnView } from "@views";
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
} from "@constants";

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path={""} element={<MainLayout />} errorElement={<></>}>
      <Route path={ROUTE_HOME} element={<IndexView />} />
      <Route path={ROUTE_AUTH} element={<AuthView />} />
      <Route path={ROUTE_AUTH_VERIFY} element={<AuthVerifyView />} />
      <Route path={`${ROUTE_LEARN}/:topic`} element={<LearnView />} />
    </Route>,
  ),
);

export default function App() {
  return <RouterProvider router={router} />;
}
