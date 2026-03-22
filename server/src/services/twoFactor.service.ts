import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';

const APP_NAME = 'Obligate';

export const twoFactorService = {
  generateTotpSecret(username: string): { secret: string; uri: string } {
    const totp = new OTPAuth.TOTP({
      issuer: APP_NAME,
      label: username,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: new OTPAuth.Secret({ size: 20 }),
    });
    return { secret: totp.secret.base32, uri: totp.toString() };
  },

  verifyTotp(secret: string, code: string): boolean {
    const totp = new OTPAuth.TOTP({
      issuer: APP_NAME,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });
    // ±2 periods = 60s tolerance for clock drift
    const delta = totp.validate({ token: code, window: 2 });
    return delta !== null;
  },

  async generateTotpQr(uri: string): Promise<string> {
    return QRCode.toDataURL(uri);
  },
};
