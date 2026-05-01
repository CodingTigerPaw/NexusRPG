import { apiClient, isAPIError } from "$lib/modules/FetchModule/APIClient";
import { usersAPI } from "$lib/modules/repository";
import { type UsersResponse, type GetUsersOptions } from "./userType";

export async function getUsers(options: GetUsersOptions = {}) {
  let data: UsersResponse;

  try {
    data = await apiClient.get<UsersResponse>(usersAPI, {
      token: "id",
      query: options,
      fallbackErrorMessage: "Nie udało się pobrać użytkowników.",
    });
  } catch (error) {
    if (isAPIError(error) && (error.status === 401 || error.status === 403)) {
      throw new Error("Brak uprawnień do pobrania listy użytkowników.");
    }

    throw error;
  }

  if (!data?.users) {
    throw new Error("Backend zwrócił nieprawidłową listę użytkowników.");
  }

  return {
    users: data.users,
    nextCursor: data.nextCursor ?? null,
  };
}
