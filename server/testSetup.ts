// Vitest runs without staging or production secrets. This fixture permits the
// deliberately guarded development-only KMS fallback for tests that exercise
// encryption helpers. Individual KMS security tests override these values to
// prove that staging/production and unapproved development states still fail.
if (!process.env.ENCRYPTION_KEY) {
  process.env.NODE_ENV = "development";
  process.env.ALLOW_DEV_KMS_FALLBACK = "true";
}
