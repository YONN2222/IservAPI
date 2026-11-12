export class IServAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IServAuthError";
  }
}

export class IServTwoFactorRequiredError extends IServAuthError {
  constructor() {
    super(
      "Login failed! Two-factor authentication is required: pass twoFactorCode or twoFactorSecret.",
    );
    this.name = "IServTwoFactorRequiredError";
  }
}

export class IServApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "IServApiError";
  }
}
