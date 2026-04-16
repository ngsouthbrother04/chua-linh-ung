import crypto from "crypto";

export function verifyVNPaySignature(
  vnpayParams: Record<string, string>,
): boolean {
  const secretKey = process.env.VNPAY_HASH_SECRET;
  if (!secretKey) return false;

  const secureHash = vnpayParams["vnp_SecureHash"];
  if (!secureHash) return false;

  const keys = Object.keys(vnpayParams)
    .filter(
      (key) =>
        key.startsWith("vnp_") &&
        key !== "vnp_SecureHash" &&
        key !== "vnp_SecureHashType",
    )
    .sort();

  const signData = keys
    .map(
      (k) =>
        `${k}=${encodeURIComponent(vnpayParams[k].toString()).replace(/%20/g, "+")}`,
    )
    .join("&");

  const generatedHash = crypto
    .createHmac("sha512", secretKey)
    .update(Buffer.from(signData, "utf-8"))
    .digest("hex");

  return secureHash.toLowerCase() === generatedHash.toLowerCase();
}

export function verifyMoMoSignature(
  momoParams: Record<string, string>,
): boolean {
  const secretKey = process.env.MOMO_SECRET_KEY;
  const accessKey = process.env.MOMO_ACCESS_KEY;
  if (!secretKey || !accessKey) return false;

  const signature = momoParams["signature"];
  if (!signature) return false;

  // For MoMo callback response, use the actual accessKey from env + all callback parameters in order
  const rawSignature = `accessKey=${accessKey}&amount=${momoParams.amount ?? ""}&extraData=${momoParams.extraData ?? ""}&message=${momoParams.message ?? ""}&orderId=${momoParams.orderId ?? ""}&orderInfo=${momoParams.orderInfo ?? ""}&orderType=${momoParams.orderType ?? ""}&partnerCode=${momoParams.partnerCode ?? ""}&payType=${momoParams.payType ?? ""}&requestId=${momoParams.requestId ?? ""}&responseTime=${momoParams.responseTime ?? ""}&resultCode=${momoParams.resultCode ?? ""}&transId=${momoParams.transId ?? ""}`;

  const generatedHash = crypto
    .createHmac("sha256", secretKey)
    .update(rawSignature)
    .digest("hex");

  return signature === generatedHash;
}
