// StoreKit 2 transactions arrive as a JWS. Sandbox and Production must chain to
// Apple Root CA - G3. Xcode's local StoreKit configuration uses a different
// certificate, so that path is accepted only when the server is explicitly
// told to (IAP_XCODE=1). A client-chosen coin amount is never read from the JWS.
import crypto from 'crypto';
import { APPLE_BUNDLE_ID } from './products.js';

const APPLE_ROOT_G3 = `-----BEGIN CERTIFICATE-----
MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwS
QXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9u
IEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcN
MTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBS
b290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9y
aXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49
AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtf
TjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517
IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySr
MA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gA
MGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4
at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM
6BgD56KyKA==
-----END CERTIFICATE-----
`;

function b64urlToBuf(s) {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}
function b64urlJson(s) {
  return JSON.parse(b64urlToBuf(s).toString('utf8'));
}
function pemFromDerB64(b64) {
  const body = String(b64).replace(/\s+/g, '');
  const lines = body.match(/.{1,64}/g) || [];
  return '-----BEGIN CERTIFICATE-----\n' + lines.join('\n') + '\n-----END CERTIFICATE-----\n';
}

function chainToApple(x5c) {
  let certs;
  try { certs = x5c.map(b => new crypto.X509Certificate(pemFromDerB64(b))); } catch { return false; }
  if (!certs.length) return false;
  for (let i = 0; i < certs.length - 1; i++) {
    if (!certs[i].verify(certs[i + 1].publicKey)) return false;
  }
  const apple = new crypto.X509Certificate(APPLE_ROOT_G3);
  const root = certs[certs.length - 1];
  if (root.fingerprint256 === apple.fingerprint256) return true;
  return root.verify(apple.publicKey);
}

export function verifyTransactionJws(jws, { allowXcode = false, bundleId = APPLE_BUNDLE_ID } = {}) {
  const parts = String(jws || '').split('.');
  if (parts.length !== 3 || parts.some(p => !p)) return { ok: false, error: 'jws' };
  let header, payload;
  try { header = b64urlJson(parts[0]); payload = b64urlJson(parts[1]); } catch { return { ok: false, error: 'jws' }; }
  if (header.alg !== 'ES256') return { ok: false, error: 'alg' };
  const env = payload.environment;
  if (env !== 'Xcode' && env !== 'Sandbox' && env !== 'Production') return { ok: false, error: 'environment' };
  if (env === 'Xcode' && !allowXcode) return { ok: false, error: 'xcode-disabled' };
  if (payload.bundleId !== bundleId) return { ok: false, error: 'bundle' };
  if (payload.revocationDate) return { ok: false, error: 'revoked' };
  const productId = typeof payload.productId === 'string' ? payload.productId : '';
  const transactionId = String(payload.transactionId || '');
  if (!productId || !/^[A-Za-z0-9._-]{1,80}$/.test(transactionId)) return { ok: false, error: 'transaction' };
  const x5c = header.x5c;
  if (!Array.isArray(x5c) || !x5c.length) return { ok: false, error: 'cert' };
  let leaf;
  try { leaf = new crypto.X509Certificate(pemFromDerB64(x5c[0])); } catch { return { ok: false, error: 'cert' }; }
  const signed = Buffer.from(parts[0] + '.' + parts[1]);
  let signatureOk = false;
  try {
    signatureOk = crypto.verify('sha256', signed, { key: leaf.publicKey, dsaEncoding: 'ieee-p1363' }, b64urlToBuf(parts[2]));
  } catch { signatureOk = false; }
  if (!signatureOk) return { ok: false, error: 'signature' };
  if (env !== 'Xcode' && !chainToApple(x5c)) return { ok: false, error: 'apple-root' };
  return { ok: true, productId, transactionId, environment: env };
}
