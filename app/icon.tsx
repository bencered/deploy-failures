import { ImageResponse } from "next/og";

// Auto-generated favicon. Next.js picks this up because the file is named
// `icon.tsx` at the app root.

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0a0a0a",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          gap: 2,
          padding: 6,
        }}
      >
        <div style={{ width: 5, height: "35%", background: "#0070f0", display: "flex" }} />
        <div style={{ width: 5, height: "70%", background: "#ff0080", display: "flex" }} />
        <div style={{ width: 5, height: "50%", background: "#50e3c2", display: "flex" }} />
      </div>
    ),
    { ...size }
  );
}
