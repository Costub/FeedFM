import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};
export const contentType = "image/png";

export default function Icon() {
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
          border: "28px solid #f6b64f",
          color: "#f6e7b8",
          fontFamily: "monospace",
          fontSize: 150,
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
