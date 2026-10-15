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
