import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#11130e",
          border: "12px solid #f6b64f",
          color: "#f6e7b8",
          fontFamily: "monospace",
          fontSize: 52,
          fontWeight: 900,
          letterSpacing: 0,
        }}
      >
        FM
      </div>
    ),
    size,
  );
}
