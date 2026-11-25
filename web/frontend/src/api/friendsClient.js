// API client for the friendship request endpoints (features 011 and 012,
// contracts/friendship-requests-api.md) and the friends list (feature 013,
// specs/013-friends-list/contracts/friends-api.md). Same convention as
// authClient/usersClient/expenseClient: never throws, always returns
// { ok: true, ... } or { ok: false, ... }.

import { apiUrl } from './apiBase'

export const SEND_NETWORK_ERROR_MESSAGE =
  'No se pudo enviar la solicitud. Intentá nuevamente'
export const RECEIVED_NETWORK_ERROR_MESSAGE =
  'No se pudieron cargar tus solicitudes. Intentá nuevamente'
export const RESPOND_NETWORK_ERROR_MESSAGE =
  'No se pudo responder la solicitud. Intentá nuevamente'
export const FRIENDS_NETWORK_ERROR_MESSAGE =
  'No se pudo cargar tu lista de amigos. Intentá nuevamente'
export const DELETE_FRIEND_NETWORK_ERROR_MESSAGE =
  'No se pudo eliminar al amigo. Intentá nuevamente'

// Emitted after answering a request, so the bell of the top bar stays current
// no matter which screen answered it (specs/015-main-screen).
export const FRIEND_REQUESTS_CHANGED_EVENT = 'amano:friend-requests-changed'

async function parseProblem(response) {
  try {
    const problem = await response.json()
    return {
      detail: problem.detail ?? '',
      fields: problem.properties?.fields ?? {},
    }
  } catch {
    return { detail: '', fields: {} }
  }
}

/**
 * Sends a friendship request to the given account. Returns
 * { ok: true, request } on 201; 4xx as { ok: false, status, detail, fields };
 * network failures and 5xx as { ok: false, network: true }.
 */
export async function sendFriendshipRequest(recipientId) {
  try {
    const response = await fetch(apiUrl('/api/users/me/friendship-requests'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientId }),
    })
    if (response.ok) {
      return { ok: true, request: await response.json() }
    }
    if (response.status >= 500) {
      return { ok: false, network: true }
    }
    const problem = await parseProblem(response)
    return { ok: false, status: response.status, ...problem }
  } catch {
    return { ok: false, network: true }
  }
}

/**
 * Lists the pending requests received by the session user. Returns
 * { ok: true, requests } on 200; 4xx as { ok: false, status, detail };
 * network failures and 5xx as { ok: false, network: true }.
 */
export async function listReceivedFriendshipRequests() {
  try {
    const response = await fetch(apiUrl('/api/users/me/friendship-requests/received'), {
      credentials: 'include',
    })
    if (response.ok) {
      return { ok: true, requests: await response.json() }
    }
    if (response.status >= 500) {
      return { ok: false, network: true }
    }
    const problem = await parseProblem(response)
    return { ok: false, status: response.status, detail: problem.detail }
  } catch {
    return { ok: false, network: true }
  }
}

/**
 * Answers a pending friendship request as the recipient (feature 012).
 * `action` is 'ACCEPT' or 'REJECT'; the outcome is the response object on
 * 200 ({ ok: true, request }); 4xx as { ok: false, status, detail, fields };
 * network failures and 5xx as { ok: false, network: true }.
 */
export async function respondFriendshipRequest(id, action) {
  try {
    const response = await fetch(apiUrl(`/api/users/me/friendship-requests/${id}`), {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    if (response.ok) {
      const request = await response.json()
      window.dispatchEvent(new Event(FRIEND_REQUESTS_CHANGED_EVENT))
      return { ok: true, request }
    }
    if (response.status >= 500) {
      return { ok: false, network: true }
    }
    const problem = await parseProblem(response)
    return { ok: false, status: response.status, ...problem }
  } catch {
    return { ok: false, network: true }
  }
}

/**
 * Lists the friends of the session user (feature 013), alphabetically as the
 * server returns them. Returns { ok: true, friends } on 200; 4xx as
 * { ok: false, status, detail }; network failures and 5xx as
 * { ok: false, network: true }.
 */
export async function listFriends() {
  try {
    const response = await fetch(apiUrl('/api/users/me/friends'), {
      credentials: 'include',
    })
    if (response.ok) {
      return { ok: true, friends: await response.json() }
    }
    if (response.status >= 500) {
      return { ok: false, network: true }
    }
    const problem = await parseProblem(response)
    return { ok: false, status: response.status, detail: problem.detail }
  } catch {
    return { ok: false, network: true }
  }
}

/**
 * Checks whether the session user can delete a friendship (feature 016).
 * Returns { ok: true, canDelete, reason } on 2xx; 4xx as
 * { ok: false, status, detail }; network failures and 5xx as
 * { ok: false, network: true }.
 */
export async function checkFriendDeletion(friendId) {
  try {
    const response = await fetch(
      apiUrl(`/api/users/me/friends/${friendId}/deletion-eligibility`),
      { credentials: 'include' },
    )
    if (response.ok) {
      const eligibility = await response.json()
      return {
        ok: true,
        canDelete: eligibility.canDelete,
        reason: eligibility.reason ?? null,
      }
    }
    if (response.status >= 500) {
      return { ok: false, network: true }
    }
    const problem = await parseProblem(response)
    return { ok: false, status: response.status, detail: problem.detail }
  } catch {
    return { ok: false, network: true }
  }
}

/**
 * Deletes the friendship with the given account (feature 016). Returns
 * { ok: true } on 2xx (204); 4xx as { ok: false, status, detail }; network
 * failures and 5xx as { ok: false, network: true }.
 */
export async function deleteFriend(friendId) {
  try {
    const response = await fetch(apiUrl(`/api/users/me/friends/${friendId}`), {
      method: 'DELETE',
      credentials: 'include',
    })
    if (response.ok) {
      return { ok: true }
    }
    if (response.status >= 500) {
      return { ok: false, network: true }
    }
    const problem = await parseProblem(response)
    return { ok: false, status: response.status, detail: problem.detail }
  } catch {
    return { ok: false, network: true }
  }
}
