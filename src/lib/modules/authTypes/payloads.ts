export type LoginPayload = {
  username: string;
  password: string;
  remember: boolean;
};

export type CompleteNewPasswordPayload = {
  username: string;
  newPassword: string;
  session: string;
  remember: boolean;
  requiredAttributes?: Record<string, string>;
};
