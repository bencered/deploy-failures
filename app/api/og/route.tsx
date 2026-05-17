import { ImageResponse } from "next/og";

// Renders a 1920x1080 (16:9) promotional image for the Vercel integration
// listing. Visit /api/og in a browser to view and save the PNG.

export const runtime = "edge";

const PROJECT_COLORS = [
  "#0070f0", // blue
  "#ff0080", // pink
  "#50e3c2", // cyan
  "#f5a623", // amber
  "#7928ca", // purple
  "#00d084", // green
  "#ff4d4f", // red
  "#52a9ff", // light blue
  "#c779ff", // light purple
  "#22c55e", // emerald
];

// Hand-tuned heights (percent) so the chart silhouette reads as
// realistic-but-unspecific. Each entry: [tallest segment height, color slots].
const BARS: Array<{ h: number; segments: Array<{ h: number; c: string }> }> = [
  { h: 14, segments: [{ h: 14, c: PROJECT_COLORS[0] }] },
  { h: 28, segments: [{ h: 18, c: PROJECT_COLORS[1] }, { h: 10, c: PROJECT_COLORS[0] }] },
  { h: 8, segments: [{ h: 8, c: PROJECT_COLORS[2] }] },
  { h: 42, segments: [{ h: 22, c: PROJECT_COLORS[0] }, { h: 12, c: PROJECT_COLORS[3] }, { h: 8, c: PROJECT_COLORS[1] }] },
  { h: 20, segments: [{ h: 12, c: PROJECT_COLORS[2] }, { h: 8, c: PROJECT_COLORS[5] }] },
  { h: 60, segments: [{ h: 30, c: PROJECT_COLORS[0] }, { h: 18, c: PROJECT_COLORS[1] }, { h: 12, c: PROJECT_COLORS[3] }] },
  { h: 32, segments: [{ h: 20, c: PROJECT_COLORS[4] }, { h: 12, c: PROJECT_COLORS[0] }] },
  { h: 18, segments: [{ h: 10, c: PROJECT_COLORS[2] }, { h: 8, c: PROJECT_COLORS[6] }] },
  { h: 75, segments: [{ h: 40, c: PROJECT_COLORS[0] }, { h: 20, c: PROJECT_COLORS[1] }, { h: 15, c: PROJECT_COLORS[3] }] },
  { h: 50, segments: [{ h: 25, c: PROJECT_COLORS[5] }, { h: 15, c: PROJECT_COLORS[0] }, { h: 10, c: PROJECT_COLORS[2] }] },
  { h: 22, segments: [{ h: 14, c: PROJECT_COLORS[1] }, { h: 8, c: PROJECT_COLORS[3] }] },
  { h: 36, segments: [{ h: 20, c: PROJECT_COLORS[0] }, { h: 16, c: PROJECT_COLORS[4] }] },
  { h: 90, segments: [{ h: 50, c: PROJECT_COLORS[0] }, { h: 25, c: PROJECT_COLORS[1] }, { h: 15, c: PROJECT_COLORS[5] }] },
  { h: 64, segments: [{ h: 36, c: PROJECT_COLORS[3] }, { h: 18, c: PROJECT_COLORS[0] }, { h: 10, c: PROJECT_COLORS[2] }] },
  { h: 26, segments: [{ h: 16, c: PROJECT_COLORS[6] }, { h: 10, c: PROJECT_COLORS[0] }] },
  { h: 12, segments: [{ h: 12, c: PROJECT_COLORS[2] }] },
  { h: 48, segments: [{ h: 28, c: PROJECT_COLORS[0] }, { h: 12, c: PROJECT_COLORS[1] }, { h: 8, c: PROJECT_COLORS[3] }] },
  { h: 70, segments: [{ h: 35, c: PROJECT_COLORS[1] }, { h: 20, c: PROJECT_COLORS[0] }, { h: 15, c: PROJECT_COLORS[5] }] },
  { h: 34, segments: [{ h: 22, c: PROJECT_COLORS[3] }, { h: 12, c: PROJECT_COLORS[0] }] },
  { h: 16, segments: [{ h: 16, c: PROJECT_COLORS[2] }] },
];

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "80px 96px",
          background: "#0a0a0a",
          color: "#ededed",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        {/* Top crumb: square logo, slug, name */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 36,
              height: 36,
              background: "#ededed",
              display: "flex",
            }}
          />
          <span style={{ fontSize: 28, color: "#a1a1a1" }}>bencered</span>
          <span style={{ fontSize: 28, color: "#454545" }}>/</span>
          <span style={{ fontSize: 28, fontWeight: 600 }}>deploy-failures</span>
        </div>

        {/* Headline + tagline */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 80,
          }}
        >
          <div
            style={{
              fontSize: 116,
              fontWeight: 700,
              letterSpacing: -4,
              lineHeight: 1.02,
              color: "#ededed",
            }}
          >
            Every failed deploy,
          </div>
          <div
            style={{
              fontSize: 116,
              fontWeight: 700,
              letterSpacing: -4,
              lineHeight: 1.02,
              color: "#878787",
              marginTop: 8,
            }}
          >
            charted over time.
          </div>
          <div
            style={{
              fontSize: 30,
              color: "#a1a1a1",
              marginTop: 40,
              letterSpacing: -0.3,
            }}
          >
            A dashboard of your Vercel build failures.
          </div>
        </div>

        {/* Stacked bar chart silhouette */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 10,
            height: 220,
            marginTop: "auto",
          }}
        >
          {BARS.map((bar, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: `${bar.h}%`,
                display: "flex",
                flexDirection: "column-reverse",
                borderRadius: "4px 4px 0 0",
                overflow: "hidden",
              }}
            >
              {bar.segments.map((s, j) => (
                <div
                  key={j}
                  style={{
                    height: `${(s.h / bar.h) * 100}%`,
                    background: s.c,
                    display: "flex",
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    ),
    { width: 1920, height: 1080 }
  );
}
