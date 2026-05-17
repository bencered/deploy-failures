import { AppMark } from "./app-mark";
import {
  UninstallDialog,
  type InstallationSummary,
} from "./uninstall-dialog";

type Props = {
  user: {
    username: string | null;
    installations: InstallationSummary[];
  } | null;
  signInAction: () => Promise<void>;
  signOutAction: () => Promise<void>;
};

export function TopBar({ user, signInAction, signOutAction }: Props) {
  return (
    <header className="h-12 border-b border-(--border) px-6 flex items-center">
      <div className="mx-auto max-w-[1200px] w-full flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AppMark className="h-[18px] w-[18px] text-(--text-primary)" />
          <a
            href="https://bence.red"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] font-medium text-(--text-secondary) hover:text-(--text-primary) transition-colors"
          >
            bencered
          </a>
          <span className="text-(--text-tertiary)">/</span>
          <span className="text-[13px] font-medium">deploy-failures</span>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/bencered/deploy-failures"
            target="_blank"
            rel="noopener noreferrer"
            title="View source on GitHub"
            aria-label="View source on GitHub"
            className="text-(--text-tertiary) hover:text-(--text-primary) transition-colors"
          >
            <GitHubIcon className="h-[18px] w-[18px]" />
          </a>
          {user ? (
            <>
              <span className="text-[13px] text-(--text-secondary) hidden sm:inline">
                {user.username ? (
                  <span className="mono">{user.username}</span>
                ) : null}
                <span className="text-(--text-tertiary) ml-2">
                  · {user.installations.length}{" "}
                  {user.installations.length === 1 ? "install" : "installs"}
                </span>
              </span>
              <form action={signInAction}>
                <button
                  type="submit"
                  className="btn-secondary btn-sm"
                  title="Install on another personal account or team"
                >
                  Add another
                </button>
              </form>
              <UninstallDialog installations={user.installations} />
              <form action={signOutAction}>
                <button type="submit" className="btn-secondary btn-sm">
                  Sign out
                </button>
              </form>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"
      />
    </svg>
  );
}
