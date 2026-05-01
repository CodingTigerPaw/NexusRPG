export type AppUser = {
  userId: string;
  username?: string;
  email?: string;
  role?: string;
};

export type GetUsersOptions = {
  limit?: number;
  cursor?: string | null;
};

export type UsersResponse = {
  users?: AppUser[];
  nextCursor?: string | null;
  message?: string;
};
