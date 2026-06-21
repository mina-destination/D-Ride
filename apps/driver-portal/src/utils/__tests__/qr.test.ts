import { describe, it, expect } from 'vitest';
import { parseTicketQr } from '../qr';

describe('QR Ticket Parser', () => {
  it('successfully parses a valid ticket QR JSON string', () => {
    const validJson = JSON.stringify({
      bookingId: 'booking-uuid-1234',
      token: 'secure-token-5678',
    });

    const result = parseTicketQr(validJson);
    expect(result).toEqual({
      bookingId: 'booking-uuid-1234',
      token: 'secure-token-5678',
    });
  });

  it('throws invalid_json when string is not valid JSON', () => {
    const invalidJsonStr = '{bookingId: "123", token: "456"'; // Missing closing bracket and bad keys
    expect(() => parseTicketQr(invalidJsonStr)).toThrow('invalid_json');
  });

  it('throws invalid_structure when parsed JSON is not an object', () => {
    expect(() => parseTicketQr('null')).toThrow('invalid_structure');
    expect(() => parseTicketQr('123')).toThrow('invalid_structure');
    expect(() => parseTicketQr('"string"')).toThrow('invalid_structure');
  });

  it('throws missing_booking_id when bookingId is missing or empty', () => {
    const jsonWithoutBookingId = JSON.stringify({
      token: 'secure-token',
    });
    expect(() => parseTicketQr(jsonWithoutBookingId)).toThrow('missing_booking_id');

    const jsonWithWrongType = JSON.stringify({
      bookingId: 123, // numeric instead of string
      token: 'secure-token',
    });
    expect(() => parseTicketQr(jsonWithWrongType)).toThrow('missing_booking_id');
  });

  it('throws missing_token when token is missing or empty', () => {
    const jsonWithoutToken = JSON.stringify({
      bookingId: 'booking-uuid-123',
    });
    expect(() => parseTicketQr(jsonWithoutToken)).toThrow('missing_token');

    const jsonWithWrongType = JSON.stringify({
      bookingId: 'booking-uuid-123',
      token: true, // boolean instead of string
    });
    expect(() => parseTicketQr(jsonWithWrongType)).toThrow('missing_token');
  });
});
