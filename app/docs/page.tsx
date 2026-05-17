import Link from "next/link";

export const metadata = {
  title: "Docs · Deploy Failures",
};

export default function DocsPage() {
  return (
    <main className="mx-auto max-w-[680px] px-6 py-16 flex-1">
      <Link
        href="/"
        className="text-[13px] text-(--text-tertiary) hover:text-(--text-primary) transition-colors"
      >
        ← Back
      </Link>
      <h1 className="mt-6 text-[32px] font-semibold tracking-[-0.04em]">
        Docs
      </h1>
      <p className="mt-1 text-[13px] text-(--text-tertiary)">
        How Deploy Failures works.
      </p>

      <div className="mt-10 space-y-6 text-[14px] text-(--text-secondary) leading-relaxed">
        <Section title="What it is">
          <p>
            Deploy Failures is a dashboard that visualizes how often your
            Vercel deployments have failed. It pulls failed deployments
            directly from the Vercel REST API and renders a stacked bar
            chart, summary stats, a clickable project legend, and a
            &ldquo;Worst Days&rdquo; table.
          </p>
        </Section>

        <Section title="Getting started">
          <ol className="list-decimal pl-5 space-y-1">
            <li>
              On the home page, click <strong>Continue with Vercel</strong>.
            </li>
            <li>
              Authorize the integration on a personal account or a team.
              Choose where it installs based on whose deployments you want
              to see.
            </li>
            <li>
              The dashboard loads with up to ~150 most recent failures, then
              fills in the long tail in the background (up to 5,000).
              Subsequent visits paint instantly from the local cache.
            </li>
          </ol>
        </Section>

        <Section title="The dashboard">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Time range toggle</strong> in the chart header — 7d,
              30d, 1y, or All. Numeric ranges longer than 120 days are
              bucketed weekly so the chart doesn&apos;t become razor-thin.
            </li>
            <li>
              <strong>Legend</strong> below the chart. Click a row to
              isolate that project (only its bars render); click it again
              to show all. Each row has a thin colored bar showing its
              share of the total.
            </li>
            <li>
              <strong>Worst Days</strong> table — top 10 days by failure
              count, all time. Bar width is relative to the worst day; bar
              segments show which projects contributed.
            </li>
            <li>
              <strong>Trend chip</strong> next to the failure count — up
              arrow (red) means more failures than the previous equivalent
              window; down arrow (green) means fewer.
            </li>
          </ul>
        </Section>

        <Section title="What it reads">
          <p>
            Only the read-only scopes you grant at install time:{" "}
            <span className="mono">deployment</span>,{" "}
            <span className="mono">project</span>,{" "}
            <span className="mono">team</span>,{" "}
            <span className="mono">user</span>. No source code, no
            secrets, no build logs. Full details in the{" "}
            <Link
              href="/privacy"
              className="underline underline-offset-2 hover:text-(--text-primary)"
            >
              privacy policy
            </Link>
            .
          </p>
        </Section>

        <Section title="Uninstalling">
          <p>
            Click <strong>Uninstall</strong> in the top bar — this calls
            Vercel&apos;s integration-configuration delete endpoint, which
            invalidates the access token immediately. You can also
            uninstall from your Vercel dashboard&apos;s integrations page.
          </p>
        </Section>

        <Section title="Open source">
          <p>
            Source code, bug reports, and feature requests:{" "}
            <a
              href="https://github.com/bencered/deploy-failures"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-(--text-primary)"
            >
              github.com/bencered/deploy-failures
            </a>
            . MIT licensed.
          </p>
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
