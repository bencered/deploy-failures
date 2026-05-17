import Link from "next/link";

export const metadata = {
  title: "Privacy · Deploy Failures",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-[680px] px-6 py-16 flex-1">
      <Link
        href="/"
        className="text-[13px] text-(--text-tertiary) hover:text-(--text-primary) transition-colors"
      >
        ← Back
      </Link>
      <h1 className="mt-6 text-[32px] font-semibold tracking-[-0.04em]">
        Privacy
      </h1>
      <p className="mt-1 text-[13px] text-(--text-tertiary)">
        Last updated: May 17, 2026
      </p>

      <div className="mt-10 space-y-6 text-[14px] text-(--text-secondary) leading-relaxed">
        <p>
          Deploy Failures reads your failed-deployment data from the Vercel
          REST API on your behalf via an OAuth integration you choose to
          install. This page describes what is read, where it goes, and how
          to make it stop.
        </p>

        <Section title="What we read">
          <p>
            Only the data needed to render the dashboard you see. For each
            failed deployment Vercel returns to us:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Project name and team slug</li>
            <li>Environment (production / preview / development)</li>
            <li>Deployment timestamp, deployment URL, deployment state</li>
            <li>Commit SHA and branch name when available</li>
          </ul>
          <p className="mt-3">
            We also read your account username so the top bar can display
            who you&apos;re signed in as.
          </p>
        </Section>

        <Section title="What we never read">
          <ul className="list-disc pl-5 space-y-1">
            <li>Source code or repository contents</li>
            <li>Environment variables, secrets, or build logs</li>
            <li>Successful deployments</li>
            <li>
              Anything outside the read-only scopes you authorize at install
              time (<span className="mono">deployment</span>,{" "}
              <span className="mono">project</span>,{" "}
              <span className="mono">team</span>,{" "}
              <span className="mono">user</span>)
            </li>
          </ul>
        </Section>

        <Section title="Where data lives">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Deployment data: in your browser&apos;s{" "}
              <span className="mono">localStorage</span>. It is not sent to
              or stored on any server we run.
            </li>
            <li>
              OAuth access token: in a session cookie scoped to this
              domain. The cookie is{" "}
              <span className="mono">httpOnly</span>, sent only to this
              site, and encrypted server-side so its contents are not
              readable from logs or proxies.
            </li>
          </ul>
        </Section>

        <Section title="Who we share with">
          <p>
            Nobody. There are no third-party analytics, no trackers, no
            advertising, no data sales. The only outbound network call from
            our server is to the Vercel REST API on your behalf.
          </p>
        </Section>

        <Section title="Your rights">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Uninstall the integration from inside the app
              (&ldquo;Uninstall&rdquo; button in the top bar) or from your
              Vercel dashboard at any time. This invalidates the access
              token immediately.
            </li>
            <li>
              Clear your browser&apos;s data for this site to remove the
              local cache.
            </li>
            <li>
              Email{" "}
              <a
                href="mailto:bence@carboncopy.inc"
                className="underline underline-offset-2 hover:text-(--text-primary)"
              >
                bence@carboncopy.inc
              </a>{" "}
              with any questions.
            </li>
          </ul>
        </Section>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-[16px] font-semibold text-(--text-primary) mb-2">
        {title}
      </h2>
      {children}
    </section>
  );
}
