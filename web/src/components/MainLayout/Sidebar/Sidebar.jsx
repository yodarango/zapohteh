import { NavLink, useNavigate } from "react-router-dom";
import {
  ROUTE_CREATE,
  ROUTE_HOME,
  ROUTE_SUBJECTS,
  ROUTE_USERS_ME,
} from "@constants";
import { useAppContext } from "@views/context/appContextProvider";
import { avatars } from "@images";
import zapohtehLogo from "../../../../public/logo.webp";

// Primary navigation, grouped the same way as the reference dashboard.
const GENERAL = [
  { label: "Courses", icon: "book-outline", to: ROUTE_HOME },
  { label: "Create", icon: "add-circle-outline", to: ROUTE_CREATE },
  { label: "Subjects", icon: "pricetag-outline", to: ROUTE_SUBJECTS },
];

const NavItem = ({ item, onClick }) => {
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
      onClick={onClick}
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

export const Sidebar = ({ onClose, className = "" }) => {
  const navigate = useNavigate();
  const { state, logout } = useAppContext();
  const user = state?.user || {};
  const name =
    [user.first_name, user.last_name].filter(Boolean).join(" ") || "Guest";
  const chosenAvatar = avatars.find((a) => a.pathName === user.avatar) || {};

  return (
    <aside
      className={`flex h-full w-60 shrink-0 flex-col overflow-hidden rounded-3xl border border-dr-border bg-dr-surface shadow-sm ${className}`}
    >
      {/* Mobile close button */}
      {onClose && (
        <div className='flex items-center justify-end px-5 pt-4 lg:hidden'>
          <button
            type='button'
            onClick={onClose}
            className='flex h-8 w-8 items-center justify-center rounded-lg text-dr-text-muted transition-colors hover:bg-dr-surface-light'
          >
            <ion-icon name='close-outline' className='text-xl'></ion-icon>
          </button>
        </div>
      )}

      {/* Brand */}
      <div className='flex items-center gap-2 px-5 py-5'>
        <img
          src={zapohtehLogo}
          alt='Logo'
          className='h-8 w-8 rounded-lg object-contain'
        />
        <span className='text-lg font-bold text-dr-text'>Zapohteh</span>
      </div>

      {/* Navigation */}
      <nav className='flex-1 overflow-y-auto px-3'>
        <SectionLabel>General</SectionLabel>
        <div className='flex flex-col gap-1'>
          {GENERAL.map((item) => (
            <NavItem key={item.label} item={item} onClick={onClose} />
          ))}
        </div>
      </nav>

      {/* Footer: settings + profile */}
      <div className='border-t border-dr-border px-3 py-3'>
        <NavItem item={{ label: "Settings", icon: "settings-outline" }} />
        <button
          type='button'
          onClick={() => {
            if (onClose) onClose();
            navigate(ROUTE_USERS_ME);
          }}
          className='mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-dr-surface-light'
        >
          <div className='flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-dr-accent-light text-sm font-semibold text-dr-accent'>
            {chosenAvatar.image ? (
              <img
                src={chosenAvatar.image}
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
              {user.username || "Not signed in"}
            </p>
          </div>
        </button>

        <button
          type='button'
          onClick={logout}
          className='mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-dr-danger transition-colors hover:bg-dr-danger/10'
        >
          <ion-icon name='log-out-outline' class='text-base'></ion-icon>
          Log out
        </button>
      </div>
    </aside>
  );
};
