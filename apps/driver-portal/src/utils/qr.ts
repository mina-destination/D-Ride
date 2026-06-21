export interface ParsedTicketQr {
  bookingId: string;
  token: string;
}

export function parseTicketQr(decodedText: string): ParsedTicketQr {
  try {
    const parsed = JSON.parse(decodedText);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('invalid_structure');
    }
    if (!parsed.bookingId || typeof parsed.bookingId !== 'string') {
      throw new Error('missing_booking_id');
    }
    if (!parsed.token || typeof parsed.token !== 'string') {
      throw new Error('missing_token');
    }
    return {
      bookingId: parsed.bookingId,
      token: parsed.token,
    };
  } catch (err: any) {
    if (err.message === 'missing_booking_id' || err.message === 'missing_token' || err.message === 'invalid_structure') {
      throw err;
    }
    throw new Error('invalid_json', { cause: err });
  }
}
