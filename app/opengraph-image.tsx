import { ImageResponse } from "next/og";

export const alt = "FeedFM generated radio broadcast";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#11130e",
          color: "#f6e7b8",
          padding: 72,
          border: "24px solid #f6b64f",
          fontFamily: "monospace",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 92,
              height: 92,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#f6b64f",
              color: "#11130e",
              fontSize: 48,
              fontWeight: 900,
            }}
          >
            FM
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 72, fontWeight: 900 }}>FeedFM</div>
            <div style={{ color: "#77ff79", fontSize: 28 }}>Generated radio from the feed</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ color: "#ff6b5f", fontSize: 40, fontWeight: 900 }}>ON AIR</div>
          <div style={{ maxWidth: 900, fontSize: 56, lineHeight: 1.1, fontWeight: 900 }}>
            Listen to an AI radio briefing
          </div>
        </div>
      </div>
    ),
    size,
  );
}
