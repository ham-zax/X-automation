// Explicit application rejections are safe to present to the authenticated owner.
export class DomainValidationError extends Error {
  constructor(message, { code = 'DOMAIN_VALIDATION', status = 400 } = {}) {
    super(message);
    this.name = 'DomainValidationError';
    this.code = code;
    this.status = status;
  }
}
