"use client";

export function RevokeButton({ action }: { action: () => Promise<void> }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        const ok = window.confirm(
          "Revoke Gmail access? This tells Google to forget that you authorized this app — you'll go through the consent screen again next time you sign in."
        );
        if (!ok) e.preventDefault();
      }}
    >
      <button
        type="submit"
        className="btn-secondary btn-sm"
        style={{ color: "var(--error)", borderColor: "var(--border)" }}
        title="Revoke Gmail authorization with Google"
      >
        Revoke
      </button>
    </form>
  );
}
