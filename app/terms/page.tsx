import Link from "next/link";

export const metadata = {
  title: "Terms · Deploy Failures",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-[680px] px-6 py-16 flex-1">
      <Link
        href="/"
        className="text-[13px] text-(--text-tertiary) hover:text-(--text-primary) transition-colors"
      >
        ← Back
      </Link>
      <h1 className="mt-6 text-[32px] font-semibold tracking-[-0.04em]">
        Terms of Use
      </h1>
      <p className="mt-1 text-[13px] text-(--text-tertiary)">
        Last updated: May 17, 2026
      </p>

      <div className="mt-10 space-y-6 text-[14px] text-(--text-secondary) leading-relaxed">
        <p>
          By installing and using Deploy Failures, you agree to the
          following. These terms are short on purpose.
        </p>

        <Section title="Service is as-is">
          <p>
            The app is provided as-is, with no warranties of any kind,
            express or implied. It may be unavailable, slow, or buggy.
            There is no service-level agreement.
          </p>
        </Section>

        <Section title="What the integration does">
          <p>
            You authorize the app to read your deployment metadata via the
            Vercel REST API using the read-only scopes you grant at install
            time. The app will not write to your account, modify
            deployments, or change any project settings — ever.
          </p>
        </Section>

        <Section title="No support guarantee">
          <p>
            This is a personal project. Bug reports and feature requests
            are welcome via{" "}
            <a
              href="https://github.com/bencered/deploy-failures/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-(--text-primary)"
            >
              GitHub issues
            </a>
            , but there is no commitment to respond or fix anything on any
            particular timeline.
          </p>
        </Section>

        <Section title="Liability">
          <p>
            To the maximum extent permitted by law, the author is not
            liable for any damages arising from your use of the app —
            including (without limitation) lost profits, lost data, or
            business interruption.
          </p>
        </Section>

        <Section title="Source code">
          <p>
            The source is MIT-licensed and available at{" "}
            <a
              href="https://github.com/bencered/deploy-failures"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-(--text-primary)"
            >
              github.com/bencered/deploy-failures
            </a>
            . You are free to fork, modify, and self-host under the terms
            of the license.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            These terms may change without notice. Continued use of the
            app after a change constitutes acceptance of the new terms.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            <a
              href="mailto:bence@carboncopy.inc"
              className="underline underline-offset-2 hover:text-(--text-primary)"
            >
              bence@carboncopy.inc
            </a>
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
