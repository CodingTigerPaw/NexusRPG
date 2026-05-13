import { apiClient } from "$lib/modules/ApiModule/client";
import { mapAPIError } from "$lib/modules/ApiModule/errors";
import { expectArrayField } from "$lib/modules/ApiModule/response";
import { usersAPI } from "$lib/modules/repository";
import { type UsersResponse, type GetUsersOptions } from "./userType";

export async function getUsers(options: GetUsersOptions = {}) {
  try {
    const data = await apiClient.get<UsersResponse>(usersAPI, {
      query: options,
      fallbackErrorMessage: "Nie udało się pobrać użytkowników.",
    });

    const users = expectArrayField(data, "users", "Backend zwrócił nieprawidłową listę użytkowników.");
    return {
      users,
      nextCursor: data.nextCursor ?? null,
    };
  } catch (error) {
    return mapAPIError(error, {
      unauthorized: "Brak uprawnień do pobrania listy użytkowników.",
    });
  }
}
