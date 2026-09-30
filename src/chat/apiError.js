export async function parseApiError(response) {
  let body = {};
  try {
    body = await response.json();
  } catch {
    body = {};
  }
  const message =
    (typeof body.message === 'string' && body.message) ||
    `Request failed with status ${response.status}`;
  const error = new Error(message);
  error.httpStatus = response.status;
  error.code = typeof body.code === 'string' ? body.code : undefined;
  error.errors = body.errors && typeof body.errors === 'object' ? body.errors : undefined;
  return error;
}
