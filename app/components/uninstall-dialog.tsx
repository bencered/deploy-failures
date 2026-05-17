"use client";

import { useEffect, useState } from "react";

// Lightweight summary of an installation — passed from the server. We
// intentionally do NOT pass the access token to the client.
export type InstallationSummary = {
  configurationId: string;
  teamId: string | null;
  teamSlug: string | null;
  username: string | null;
};

type Props = {
  installations: InstallationSummary[];
};

// Uninstalling via the Vercel REST API requires the `integration-configuration`
// write scope, which most users won't have granted. To keep this working for
// every integration regardless of scopes, we send users to Vercel's dashboard
// to perform the uninstall there. The app auto-prunes installations whose
// access tokens go dead, so once Vercel revokes access this app forgets the
// installation on the next refresh.
export function UninstallDialog({ installations }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-secondary btn-sm"
        style={{ color: "var(--error)", borderColor: "var(--border)" }}
        title="Uninstall this integration from Vercel"
      >
        Uninstall
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] px-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="uninstall-dialog-title"
        >
          <div
            className="card w-full max-w-[480px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-5 pb-4 border-b border-(--border)">
              <h2
                id="uninstall-dialog-title"
                className="text-[18px] font-semibold tracking-[-0.02em]"
              >
                Uninstall integration
              </h2>
              <p className="text-[12px] text-(--text-tertiary) mt-1 leading-relaxed">
                Open Vercel to uninstall. This app auto-removes installations
                once Vercel revokes their access.
              </p>
            </div>
            <ul>
              {installations.map((inst) => (
                <li
                  key={inst.configurationId}
                  className="px-6 py-3 flex items-center justify-between gap-4 border-b border-(--border) last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mono text-[13px] text-(--text-primary) truncate">
                      {labelFor(inst)}
                    </div>
                    <div className="text-[11px] text-(--text-tertiary) mt-[2px] truncate">
                      {sublabelFor(inst)}
                    </div>
                  </div>
                  <a
                    href={vercelUrlFor(inst)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary btn-sm shrink-0"
                    style={{ color: "var(--error)" }}
                  >
                    Open on Vercel ↗
                  </a>
                </li>
              ))}
            </ul>
            <div className="px-6 py-4 flex items-center justify-between border-t border-(--border)">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[12px] text-(--text-tertiary) hover:text-(--text-primary) transition-colors"
              >
                Cancel
              </button>
              <a
                href="https://vercel.com/dashboard/integrations"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] text-(--text-tertiary) hover:text-(--text-primary) transition-colors"
              >
                All integrations ↗
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function labelFor(inst: InstallationSummary): string {
  if (inst.teamSlug) return inst.teamSlug;
  if (inst.teamId) return inst.teamId;
  return inst.username ?? "Personal account";
}

function sublabelFor(inst: InstallationSummary): string {
  if (inst.teamId) {
    return inst.teamSlug
      ? "Team install"
      : "Team install · add `team` scope for the team name";
  }
  return "Personal install";
}

function vercelUrlFor(inst: InstallationSummary): string {
  // Most-specific URL we can produce: the team's integrations list. Falls
  // back to the generic dashboard if we lack a slug.
  if (inst.teamSlug) {
    return `https://vercel.com/${inst.teamSlug}/~/integrations`;
  }
  return "https://vercel.com/dashboard/integrations";
}
