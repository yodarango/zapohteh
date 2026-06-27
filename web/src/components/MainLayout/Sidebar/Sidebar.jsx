import { NavLink } from "react-router-dom";
import { ROUTE_HOME, ROUTE_COURSES } from "@constants";
import { useAppContext } from "../../../views/context/appContextProvider";
import goilerplateLogo from "../../../../public/logo.png";

// Primary navigation, grouped the same way as the reference dashboard.
const GENERAL = [
  { label: "Dashboard", icon: "grid-outline", to: ROUTE_HOME },
  { label: "Courses", icon: "book-outline", to: ROUTE_COURSES },
];

const NavItem = ({ item }) => {
  const base =
    "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors";

  if (!item.to) {
    return (
      <div
        className={`${base} cursor-default text-dr-text-muted hover:bg-dr-surface-light`}
      >
        <ion-icon name={item.icon} className='text-lg'></ion-icon>
        <span>{item.label}</span>
      </div>
    );
  }

  return (
    <NavLink
      to={item.to}
      end
      className={({ isActive }) =>
        `${base} ${
          isActive
            ? "bg-dr-accent-light text-dr-accent"
            : "text-dr-text-muted hover:bg-dr-surface-light"
        }`
      }
    >
      <ion-icon name={item.icon} className='text-lg'></ion-icon>
      <span>{item.label}</span>
    </NavLink>
  );
};

const SectionLabel = ({ children }) => (
  <p className='px-3 pb-2 pt-4 text-xs font-semibold uppercase tracking-wide text-dr-text-muted/70'>
    {children}
  </p>
);

export const Sidebar = () => {
  const { state } = useAppContext();
  const user = state?.user || {};
  const name =
    [user.first_name, user.last_name].filter(Boolean).join(" ") || "Guest";

  return (
    <aside className='flex w-60 shrink-0 flex-col border-r border-dr-border'>
      {/* Brand */}
      <div className='flex items-center gap-2 px-5 py-5'>
        <img
          src={goilerplateLogo}
          alt='Logo'
          className='h-8 w-8 rounded-lg object-contain'
        />
        <span className='text-lg font-bold text-dr-text'>Goilerplate</span>
      </div>

      {/* Navigation */}
      <nav className='flex-1 overflow-y-auto px-3'>
        <SectionLabel>General</SectionLabel>
        <div className='flex flex-col gap-1'>
          {GENERAL.map((item) => (
            <NavItem key={item.label} item={item} />
          ))}
        </div>
      </nav>

      {/* Footer: settings + profile */}
      <div className='border-t border-dr-border px-3 py-3'>
        <NavItem item={{ label: "Settings", icon: "settings-outline" }} />
        <div className='mt-2 flex items-center gap-3 rounded-xl px-3 py-2'>
          <div className='flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-dr-accent-light text-sm font-semibold text-dr-accent'>
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={name}
                className='h-full w-full object-cover'
              />
            ) : (
              name.charAt(0).toUpperCase()
            )}
          </div>
          <div className='min-w-0'>
            <p className='truncate text-sm font-semibold text-dr-text'>
              {name}
            </p>
            <p className='truncate text-xs text-dr-text-muted'>
              {user.email || "Not signed in"}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};
