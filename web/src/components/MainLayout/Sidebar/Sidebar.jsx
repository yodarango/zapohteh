import { Link, NavLink, useNavigate, useMatch } from "react-router-dom";
import {
  ROUTE_CREATE,
  ROUTE_HOME,
  ROUTE_LEARN,
  ROUTE_SUBJECTS,
  ROUTE_HIGHLIGHTS,
  ROUTE_USERS_ME,
} from "@constants";
import { useAppContext } from "@views/context/appContextProvider";
import { NotesPanel } from "@views/learn/NotesPanel";
import { avatars } from "@images";
import zapohtehLogo from "../../../../public/logo.webp";

// Primary navigation, grouped the same way as the reference dashboard.
const GENERAL = [
  { label: "Courses", icon: "book-outline", to: ROUTE_HOME },
  { label: "Create", icon: "add-circle-outline", to: ROUTE_CREATE },
  { label: "Organization", icon: "albums-outline", to: ROUTE_SUBJECTS },
  { label: "Highlights", icon: "color-palette-outline", to: ROUTE_HIGHLIGHTS },
];

const NavItem = ({ item, onClick, compact }) => {
  const base = `flex items-center gap-3 rounded-xl py-2 text-sm font-medium transition-colors ${compact ? "justify-center px-0" : "px-3"}`;

  if (!item.to) {
    return (
      <div
        className={`${base} cursor-default text-dr-text-muted hover:bg-dr-surface-light`}
        title={compact ? item.label : undefined}
      >
        <ion-icon name={item.icon} className='text-lg'></ion-icon>
        <span className={compact ? "sr-only" : ""}>{item.label}</span>
      </div>
    );
  }

  return (
    <NavLink
      to={item.to}
      end
      onClick={onClick}
      title={compact ? item.label : undefined}
      className={({ isActive }) =>
        `${base} ${
          isActive
            ? "bg-dr-accent-light text-dr-accent"
            : "text-dr-text-muted hover:bg-dr-surface-light"
        }`
      }
    >
      <ion-icon name={item.icon} className='text-lg'></ion-icon>
      <span className={compact ? "sr-only" : ""}>{item.label}</span>
    </NavLink>
  );
};

const SectionLabel = ({ children }) => (
  <p className='px-3 pb-2 pt-4 text-xs font-semibold uppercase tracking-wide text-dr-text-muted/70'>
    {children}
  </p>
);

export const SidebarNav = ({ onClose, showCloseButton = false, compact = false, notesOpen = false, onNotesToggle, onExpandToggle }) => {
  const navigate = useNavigate();
  const studyMatch = useMatch(`${ROUTE_LEARN}/:topic`);
  const { state, logout } = useAppContext();
  const user = state?.user || {};
  const name =
    [user.first_name, user.last_name].filter(Boolean).join(" ") || "Guest";
  const chosenAvatar = avatars.find((a) => a.pathName === user.avatar) || {};

  return (
    <>
      {showCloseButton && onClose && (
        <div className={`flex items-center justify-end pt-4 ${compact ? "px-2" : "px-5"}`}>
          <button
            type='button'
            onClick={onClose}
            aria-label='Close navigation'
            className='flex h-8 w-8 items-center justify-center rounded-lg text-dr-text-muted transition-colors hover:bg-dr-surface-light'
          >
            <ion-icon name='close-outline' className='text-xl'></ion-icon>
          </button>
        </div>
      )}

      {/* Brand */}
      <div className={`flex items-center gap-2 py-5 ${compact ? "justify-center px-2" : "px-5"}`}>
        <img
          src={zapohtehLogo}
          alt='Logo'
          className='h-8 w-8 rounded-lg object-contain'
        />
        <span className={compact ? "sr-only" : "text-lg font-bold text-dr-text"}>Zapohteh</span>
      </div>

      <nav className='min-h-0 flex-1 overflow-y-auto px-3'>
        {studyMatch && (
          <Link
            to={ROUTE_HOME}
            onClick={onClose}
            aria-label='Back to courses'
            title='Back to courses'
            className={`mb-2 flex items-center gap-3 rounded-xl py-2 text-sm font-medium text-dr-text-muted transition-colors hover:bg-dr-surface-light hover:text-dr-text ${compact ? "justify-center" : "px-3"}`}
          >
            <ion-icon name='chevron-back-outline' className='text-lg'></ion-icon>
            <span className={compact ? "sr-only" : ""}>Back to courses</span>
          </Link>
        )}
        {!compact && <SectionLabel>General</SectionLabel>}
        <div className='flex flex-col gap-1'>
          {GENERAL.map((item) => (
            <NavItem key={item.label} item={item} onClick={onClose} compact={compact} />
          ))}
        </div>
        {studyMatch && (
          <div className='mt-4 border-t border-dr-border pt-3'>
            <button
              type='button'
              onClick={onNotesToggle}
              aria-expanded={notesOpen}
              title='Course notes'
              className={`flex w-full items-center gap-3 rounded-xl py-2 text-left text-sm font-medium text-dr-text-muted transition-colors hover:bg-dr-surface-light ${compact ? "justify-center px-0" : "px-3"}`}
            >
              <ion-icon name='document-text-outline' className='text-lg'></ion-icon>
              <span className={compact ? "sr-only" : "flex-1"}>Course notes</span>
            </button>
          </div>
        )}
      </nav>

      <div className='border-t border-dr-border px-3 py-3'>
        <NavItem item={{ label: "Settings", icon: "settings-outline" }} compact={compact} />
        <button
          type='button'
          aria-label={compact ? `Account: ${name}` : undefined}
          title={compact ? "Account" : undefined}
          onClick={() => {
            if (onClose) onClose();
            navigate(ROUTE_USERS_ME);
          }}
          className={`mt-2 flex w-full items-center gap-3 rounded-xl py-2 text-left transition-colors hover:bg-dr-surface-light ${compact ? "justify-center px-0" : "px-3"}`}
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
          <div className={compact ? "sr-only" : "min-w-0"}>
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
          title={compact ? "Log out" : undefined}
          className={`mt-2 flex w-full items-center gap-3 rounded-xl py-2 text-left text-sm font-medium text-dr-danger transition-colors hover:bg-dr-danger/10 ${compact ? "justify-center px-0" : "px-3"}`}
        >
          <ion-icon name='log-out-outline' className='text-base'></ion-icon>
          <span className={compact ? "sr-only" : ""}>Log out</span>
        </button>
        {studyMatch && (
          <button
            type='button'
            onClick={onExpandToggle}
            aria-label={compact ? "Expand navigation" : "Collapse navigation"}
            aria-expanded={!compact}
            title={compact ? "Expand navigation" : "Collapse navigation"}
            className={`mt-2 flex w-full items-center gap-3 rounded-xl py-2 text-sm font-medium text-dr-text-muted transition-colors hover:bg-dr-surface-light ${compact ? "justify-center px-0" : "px-3"}`}
          >
            <span className='flex items-center' aria-hidden='true'>
              <ion-icon name={compact ? "chevron-forward-outline" : "chevron-back-outline"} className='text-base'></ion-icon>
              <ion-icon name={compact ? "chevron-forward-outline" : "chevron-back-outline"} className='-ml-2 text-base'></ion-icon>
            </span>
            {!compact && <span>Collapse navigation</span>}
          </button>
        )}
      </div>
    </>
  );
};

export const Sidebar = ({ onClose, compact = false, notesOpen = false, onNotesToggle, onExpandToggle }) => {
  const studyMatch = useMatch(`${ROUTE_LEARN}/:topic`);

  return (
    <aside className='flex h-full w-full shrink-0 flex-col overflow-hidden border-r border-dr-border bg-dr-surface'>
      {studyMatch && notesOpen ? (
        <>
          <div className='flex shrink-0 items-center gap-2 border-b border-dr-border px-4 py-4'>
            <button
              type='button'
              onClick={onNotesToggle}
              aria-label='Back to navigation'
              title='Back to navigation'
              className='flex h-9 w-9 items-center justify-center rounded-lg text-dr-text-muted transition-colors hover:bg-dr-surface-light hover:text-dr-text'
            >
              <ion-icon name='chevron-back-outline' className='text-xl'></ion-icon>
            </button>
            <h2 className='flex-1 font-semibold text-dr-text'>Course notes</h2>
            {onClose && (
              <button
                type='button'
                onClick={onClose}
                aria-label='Close navigation'
                className='flex h-9 w-9 items-center justify-center rounded-lg text-dr-text-muted transition-colors hover:bg-dr-surface-light'
              >
                <ion-icon name='close-outline' className='text-xl'></ion-icon>
              </button>
            )}
          </div>
          <div className='min-h-0 flex-1 overflow-y-auto px-3 pt-3'>
            <NotesPanel key={studyMatch.params.topic} topic={studyMatch.params.topic} />
          </div>
        </>
      ) : (
        <SidebarNav onClose={onClose} showCloseButton compact={compact} notesOpen={notesOpen} onNotesToggle={onNotesToggle} onExpandToggle={onExpandToggle} />
      )}
    </aside>
  );
};
