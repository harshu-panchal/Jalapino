const HOURS_IN_MS = 60 * 60 * 1000;

export const parseTimeToMinutes = (value) => {
    if (!value) return null;
    const raw = String(value).trim().split('-')[0].trim();
    const match = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
    if (!match) return null;

    let hours = Number(match[1]);
    const minutes = Number(match[2] || 0);
    const period = match[3]?.toUpperCase();
    if (minutes > 59) return null;
    if (period) {
        if (hours < 1 || hours > 12) return null;
        if (hours === 12) hours = period === 'AM' ? 0 : 12;
        else if (period === 'PM') hours += 12;
    } else if (hours > 23) {
        return null;
    }
    return hours * 60 + minutes;
};

export const getAdvanceBookingHours = (seller) => {
    const buffer = Number(seller?.advanceBookingBuffer) || 0;
    if (buffer <= 0) return 0;
    if (seller?.advanceBookingBufferUnit === 'hours') return buffer;

    // The profile's third field is an additional number of hours when the
    // primary unit is Days. It is intentionally ignored for Hours mode.
    const extraHours = Number.parseFloat(String(seller?.advanceBookingBufferTime ?? 0)) || 0;
    return (buffer * 24) + Math.max(0, extraHours);
};

export const getMinimumBookingAt = (seller, now = Date.now()) => {
    if (!seller?.advanceBookingBufferEnabled) return new Date(now);
    return new Date(now + getAdvanceBookingHours(seller) * HOURS_IN_MS);
};

export const getBookingStart = (date, time) => {
    if (!date) return null;
    const result = new Date(`${String(date).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(result.getTime())) return null;

    const minutes = parseTimeToMinutes(time);
    if (minutes === null) {
        // Without a selected time, use the end of the date so a date remains
        // selectable when at least one later slot can satisfy the notice.
        result.setHours(23, 59, 59, 999);
        return result;
    }
    result.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    return result;
};

export const isBookingWithinAdvanceNotice = (seller, date, time, now = Date.now()) => {
    const bookingStart = getBookingStart(date, time);
    if (!bookingStart || !seller?.advanceBookingBufferEnabled) return true;
    return bookingStart.getTime() >= getMinimumBookingAt(seller, now).getTime();
};
