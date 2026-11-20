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

// A booking holds (locks) its date/slot in the calendar only after payment:
// online advance/full payment received, or COD booking confirmed / cash collected.
// Unpaid requests never lock the calendar. Same rule as the date/time lock.
export const isEventBookingCalendarLocked = (booking) => {
    if (!booking || ['CANCELLED', 'REJECTED'].includes(booking.overallStatus)) return false;
    return (Number(booking.amountPaid) || 0) > 0
        || ['ADVANCE_PAID', 'PAID'].includes(booking.paymentStatus)
        || (booking.paymentMode === 'COD' && ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(booking.overallStatus));
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

// Shop timing ON: the advance-booking buffer is checked against the END time.
// Slot "10:30 AM - 10:40 PM" -> 10:40 PM; no time -> shop closing time of that date;
// a single picked time stays as it is. Shop timing OFF -> getBookingStart (unchanged).
export const getAdvanceNoticeCheckAt = (seller, date, time) => {
    const openMin = parseTimeToMinutes(seller?.shopOpeningTime);
    const closeMin = parseTimeToMinutes(seller?.shopClosingTime);
    if (!seller?.shopTimingsEnabled || openMin === null || closeMin === null || openMin >= closeMin) {
        return getBookingStart(date, time);
    }
    const parts = String(time || '').split('-').map(p => p.trim()).filter(Boolean);
    const checkMin = parts.length > 1
        ? parseTimeToMinutes(parts[parts.length - 1])
        : parts.length === 1 ? parseTimeToMinutes(parts[0]) : closeMin;
    if (checkMin === null) return getBookingStart(date, time);
    const result = new Date(`${String(date).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(result.getTime())) return null;
    result.setHours(Math.floor(checkMin / 60), checkMin % 60, 0, 0);
    return result;
};

export const isBookingWithinAdvanceNotice = (seller, date, time, now = Date.now()) => {
    const bookingStart = getAdvanceNoticeCheckAt(seller, date, time);
    if (!bookingStart || !seller?.advanceBookingBufferEnabled) return true;
    return bookingStart.getTime() >= getMinimumBookingAt(seller, now).getTime();
};

// When the booked event ENDS, in India time (IST, +05:30), independent of the
// server timezone. Slot "10:30 AM - 4:00 PM" -> 4:00 PM; a single (start) time or
// no time -> end of that day (23:59, end is unknown); slot past midnight
// (6 PM - 2 AM) -> next day.
// For multiple dates the latest end counts.
export const getEventEndIST = (booking) => {
    const toDateStr = (value) => {
        if (!value) return '';
        const text = String(value);
        if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
    };
    const endOf = (dateValue, time) => {
        const dateStr = toDateStr(dateValue);
        if (!dateStr) return null;
        const parts = String(time || '').split('-').map(p => p.trim()).filter(Boolean);
        const startMin = parts.length ? parseTimeToMinutes(parts[0]) : null;
        let endMin = parts.length > 1 ? parseTimeToMinutes(parts[parts.length - 1]) : null;
        if (endMin === null) endMin = 23 * 60 + 59;
        const nextDay = parts.length > 1 && startMin !== null && endMin < startMin;
        const hh = String(Math.floor(endMin / 60)).padStart(2, '0');
        const mm = String(endMin % 60).padStart(2, '0');
        const end = new Date(`${dateStr}T${hh}:${mm}:00+05:30`);
        if (Number.isNaN(end.getTime())) return null;
        if (nextDay) end.setTime(end.getTime() + 24 * 60 * 60 * 1000);
        return end;
    };
    const ends = [
        endOf(booking?.eventDate, booking?.eventTime),
        ...((booking?.multipleEvents || []).map(e => endOf(e?.date || booking?.eventDate, e?.time || booking?.eventTime))),
    ].filter(Boolean);
    return ends.length ? new Date(Math.max(...ends.map(d => d.getTime()))) : null;
};

// When the booked slot STARTS, in India time (IST, +05:30).
// Slot "10:30 AM - 4:00 PM" -> 10:30 AM; single time -> that time; no time -> start
// of that day (00:00). For multiple dates the latest date's start counts.
export const getEventStartIST = (booking) => {
    const toDateStr = (value) => {
        if (!value) return '';
        const text = String(value);
        if (/^d{4}-d{2}-d{2}/.test(text)) return text.slice(0, 10);
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
    };
    const startOf = (dateValue, time) => {
        const dateStr = toDateStr(dateValue);
        if (!dateStr) return null;
        const parts = String(time || '').split('-').map(p => p.trim()).filter(Boolean);
        let startMin = parts.length ? parseTimeToMinutes(parts[0]) : null;
        if (startMin === null) startMin = 0;
        const hh = String(Math.floor(startMin / 60)).padStart(2, '0');
        const mm = String(startMin % 60).padStart(2, '0');
        const start = new Date(`${dateStr}T${hh}:${mm}:00+05:30`);
        return Number.isNaN(start.getTime()) ? null : start;
    };
    const starts = [
        startOf(booking?.eventDate, booking?.eventTime),
        ...((booking?.multipleEvents || []).map(e => startOf(e?.date || booking?.eventDate, e?.time || booking?.eventTime))),
    ].filter(Boolean);
    return starts.length ? new Date(Math.max(...starts.map(d => d.getTime()))) : null;
};

export const formatIST = (date) => date
    ? date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';
