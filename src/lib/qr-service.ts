import QRCode from "qrcode";

export async function generateQrDataUrl(text: string, size = 240): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width: size,
      margin: 1,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
      errorCorrectionLevel: "M",
    });
  } catch (err) {
    console.error("QR Code generation error:", err);
    return "";
  }
}

export async function generateQrSvg(text: string, size = 200): Promise<string> {
  try {
    return await QRCode.toString(text, {
      type: "svg",
      width: size,
      margin: 1,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
      errorCorrectionLevel: "M",
    });
  } catch (err) {
    console.error("QR Code SVG error:", err);
    return "";
  }
}

/**
 * Returns the public Zero-Login Parent Portal URL for the student's QR code card.
 * Encodes full URL: https://${domain}/s/${student.qrCodeToken}
 */
export function getStudentQrUrl(tokenOrCode: string): string {
  const clean = (tokenOrCode || "").trim();
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/s/${encodeURIComponent(clean)}`;
  }
  return `https://exambuilderapp.oqabagency.com/s/${encodeURIComponent(clean)}`;
}

