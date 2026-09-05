export const MAX_PROFILE_IMAGE_BYTES = 2 * 1024 * 1024;
export const MIN_PROFILE_IMAGE_DIMENSION = 64;
export const MAX_PROFILE_IMAGE_DIMENSION = 4096;

type ProfileImageValidationResult =
  | {
      ok: true;
      data: Uint8Array;
      contentType: "image/jpeg" | "image/png" | "image/webp";
      width: number;
      height: number;
    }
  | {
      ok: false;
      code: "IMAGE_EMPTY" | "IMAGE_TOO_LARGE" | "IMAGE_TYPE_INVALID" | "IMAGE_DIMENSIONS_INVALID";
      error: string;
    };

type ImageDetails = {
  contentType: "image/jpeg" | "image/png" | "image/webp";
  width: number;
  height: number;
};

function readUint16BigEndian(data: Uint8Array, offset: number) {
  return data[offset] * 256 + data[offset + 1];
}

function readUint24LittleEndian(data: Uint8Array, offset: number) {
  return data[offset] + data[offset + 1] * 256 + data[offset + 2] * 65536;
}

function readUint32BigEndian(data: Uint8Array, offset: number) {
  return (
    data[offset] * 16777216 +
    data[offset + 1] * 65536 +
    data[offset + 2] * 256 +
    data[offset + 3]
  );
}

function hasAscii(data: Uint8Array, offset: number, value: string) {
  return [...value].every(
    (character, index) => data[offset + index] === character.charCodeAt(0),
  );
}

function readPng(data: Uint8Array): ImageDetails | null {
  if (
    data.length < 24 ||
    data[0] !== 0x89 ||
    !hasAscii(data, 1, "PNG\r\n\u001a\n") ||
    !hasAscii(data, 12, "IHDR")
  ) {
    return null;
  }

  return {
    contentType: "image/png",
    width: readUint32BigEndian(data, 16),
    height: readUint32BigEndian(data, 20),
  };
}

const jpegSizeMarkers = new Set([
  0xc0,
  0xc1,
  0xc2,
  0xc3,
  0xc5,
  0xc6,
  0xc7,
  0xc9,
  0xca,
  0xcb,
  0xcd,
  0xce,
  0xcf,
]);

function readJpeg(data: Uint8Array): ImageDetails | null {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) {
    return null;
  }

  let offset = 2;

  while (offset + 3 < data.length) {
    if (data[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    while (data[offset] === 0xff) offset += 1;
    const marker = data[offset];
    offset += 1;

    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }
    if (offset + 1 >= data.length) return null;

    const segmentLength = readUint16BigEndian(data, offset);
    if (segmentLength < 2 || offset + segmentLength > data.length) {
      return null;
    }

    if (jpegSizeMarkers.has(marker)) {
      if (segmentLength < 7) return null;

      return {
        contentType: "image/jpeg",
        height: readUint16BigEndian(data, offset + 3),
        width: readUint16BigEndian(data, offset + 5),
      };
    }

    offset += segmentLength;
  }

  return null;
}

function readWebp(data: Uint8Array): ImageDetails | null {
  if (
    data.length < 30 ||
    !hasAscii(data, 0, "RIFF") ||
    !hasAscii(data, 8, "WEBP")
  ) {
    return null;
  }

  if (hasAscii(data, 12, "VP8X")) {
    return {
      contentType: "image/webp",
      width: readUint24LittleEndian(data, 24) + 1,
      height: readUint24LittleEndian(data, 27) + 1,
    };
  }

  if (
    hasAscii(data, 12, "VP8 ") &&
    data[23] === 0x9d &&
    data[24] === 0x01 &&
    data[25] === 0x2a
  ) {
    return {
      contentType: "image/webp",
      width: (data[26] | (data[27] << 8)) & 0x3fff,
      height: (data[28] | (data[29] << 8)) & 0x3fff,
    };
  }

  if (hasAscii(data, 12, "VP8L") && data[20] === 0x2f) {
    return {
      contentType: "image/webp",
      width: 1 + data[21] + ((data[22] & 0x3f) << 8),
      height:
        1 +
        (data[22] >> 6) +
        (data[23] << 2) +
        ((data[24] & 0x0f) << 10),
    };
  }

  return null;
}

function readImageDetails(data: Uint8Array) {
  return readPng(data) ?? readJpeg(data) ?? readWebp(data);
}

export function validateProfileImage(
  data: Uint8Array,
): ProfileImageValidationResult {
  if (data.byteLength === 0) {
    return {
      ok: false,
      code: "IMAGE_EMPTY",
      error: "Alege o imagine.",
    };
  }

  if (data.byteLength > MAX_PROFILE_IMAGE_BYTES) {
    return {
      ok: false,
      code: "IMAGE_TOO_LARGE",
      error: "Imaginea poate avea cel mult 2 MB.",
    };
  }

  const details = readImageDetails(data);
  if (!details) {
    return {
      ok: false,
      code: "IMAGE_TYPE_INVALID",
      error: "Folosește o imagine JPEG, PNG sau WebP validă.",
    };
  }

  if (
    details.width < MIN_PROFILE_IMAGE_DIMENSION ||
    details.height < MIN_PROFILE_IMAGE_DIMENSION ||
    details.width > MAX_PROFILE_IMAGE_DIMENSION ||
    details.height > MAX_PROFILE_IMAGE_DIMENSION
  ) {
    return {
      ok: false,
      code: "IMAGE_DIMENSIONS_INVALID",
      error: "Imaginea trebuie să aibă între 64 și 4096 pixeli pe fiecare latură.",
    };
  }

  return { ok: true, data, ...details };
}
