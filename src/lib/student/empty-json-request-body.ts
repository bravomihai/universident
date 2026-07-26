type EmptyJsonRequestBodyResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      response: Response;
    };

export async function parseEmptyJsonRequestBody(
  request: Request,
): Promise<EmptyJsonRequestBodyResult> {
  const bodyText = await request.text();

  if (!bodyText.trim()) {
    return {
      ok: true,
    };
  }

  let body: unknown;

  try {
    body = JSON.parse(bodyText) as unknown;
  } catch {
    return {
      ok: false,
      response: Response.json(
        { error: "Datele trimise nu sunt valide." },
        { status: 400 },
      ),
    };
  }

  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body) ||
    Object.keys(body).length > 0
  ) {
    return {
      ok: false,
      response: Response.json(
        { error: "Cererea nu acceptă câmpuri în body." },
        { status: 400 },
      ),
    };
  }

  return {
    ok: true,
  };
}
