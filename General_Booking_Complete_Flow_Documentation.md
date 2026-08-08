# General Booking -- Complete Booking, Payment, Member Ticket & QR Flow

## 1. Objective

Implement the complete **General Booking / Ticket Booking flow**
according to the provided reference screenshot and business
requirements.

The customer will:

1.  Select an available booking date.
2.  Select an available time slot.
3.  Select a Booking Type.
4.  Add one or more members.
5.  Validate age eligibility and available capacity.
6.  Select COD or Razorpay payment.
7.  Complete the booking/payment flow.
8.  Receive a separate ticket and unique QR code for every member.
9.  View booking and ticket status in the application.

The seller will:

-   Receive bookings for their own event/venue only.
-   View member-wise booking information.
-   Scan member QR codes.
-   Check ticket validity and status.
-   Update/check-in the member.
-   See cancelled/used/invalid tickets.

The admin will:

-   Manage calendar, dates, time slots, capacity and eligibility.
-   Monitor bookings, payments, members, tickets and QR status.
-   See seller-wise and event/venue-wise booking information.

------------------------------------------------------------------------

# 2. Reference Screenshot / UI Flow

The provided screenshot is the primary reference for the General Booking
flow.

The intended flow is:

**Booking Type → Capacity/Limit → Date → Time Slot → Member Details →
Add Member → Total Payment → COD/Razorpay → Booking Confirmation →
Member-wise Ticket → Unique QR → Seller QR Scanner → Ticket Status**

The existing application's design and architecture should be reused
wherever possible.

Do not unnecessarily redesign unrelated screens.

------------------------------------------------------------------------

# 3. Booking Type

Customer must be able to select:

-   Family
-   Group
-   Corporate
-   School
-   Others

The selected booking type must be stored with the booking.

Example:

``` text
Booking Type: Family
```

------------------------------------------------------------------------

# 4. Calendar and Date Availability

Admin/Seller must be able to configure event/venue availability.

Calendar should support:

-   Open/Available dates
-   Closed dates
-   Holiday dates
-   Time slots
-   Capacity
-   Remaining capacity
-   Minimum age
-   Maximum age (optional)

## Rules

-   Closed dates cannot be selected.
-   Holiday dates cannot be selected.
-   Only open dates should be selectable.
-   Only available time slots for the selected date should be shown.
-   Full time slots must become unavailable.
-   Date and time-slot capacity must be maintained separately.

Example:

``` text
20 August 2026
10:00 AM – 12:00 PM
Maximum Capacity: 20
Booked: 15
Remaining: 5
```

If remaining capacity is 5, a customer cannot book 6 members.

------------------------------------------------------------------------

# 5. Capacity / Limit

Capacity is configurable by Admin/Seller.

Capacity must be applied at the **Date + Time Slot** level.

Example:

``` text
Date: 20 Aug
Time: 10 AM – 12 PM
Capacity: 20
Booked: 18
Remaining: 2
```

Customer can only add/book up to the remaining capacity.

## Concurrency Protection

The system must prevent two customers from booking the same remaining
capacity simultaneously.

Capacity should be safely reserved during the payment/booking process.

If payment fails, expires or the booking is cancelled, reserved capacity
must be released according to the business rules.

------------------------------------------------------------------------

# 6. Member Addition

Customer can add multiple members inside one booking.

Each member must contain:

-   Member Name
-   Adult / Child
-   Male / Female
-   Age
-   WhatsApp / Mobile Number

Example:

``` text
Member Name: Rajeev
Adult/Child: Adult
Gender: Female
Age: 24
Mobile/WhatsApp: 9339999999
```

There must be an **Add Member** action.

Each additional member must appear as a separate member entry.

------------------------------------------------------------------------

# 7. Age Eligibility

Age eligibility must be configurable by Admin/Seller.

Example:

``` text
Minimum Age: 10
```

If the customer adds a member below the configured minimum age, the
system must reject that member or prevent the booking.

Example:

``` text
Member age: 8
Minimum age: 10

Result:
Member is not eligible for this booking.
```

Do not hard-code the age rule.

If maximum age is configured, it must also be validated.

------------------------------------------------------------------------

# 8. Event/Venue and Seller Assignment

Every General Booking must be linked to the selected:

-   Event
-   Venue/Product, where applicable
-   Seller

The booking must belong to the seller who owns the selected event/venue.

Example:

``` text
Venue A
↓
Seller A
↓
Customer Booking
```

Seller A can see only bookings belonging to Seller A.

Seller B must not be able to view:

-   Seller A's bookings
-   Seller A's customer information
-   Seller A's member information
-   Seller A's tickets
-   Seller A's QR/check-in data

Admin can access all bookings according to admin permissions.

------------------------------------------------------------------------

# 9. Booking Creation

Before creating the booking, validate:

-   Customer authentication
-   Event/venue availability
-   Date availability
-   Time-slot availability
-   Date is not closed/holiday
-   Capacity
-   Member count
-   Age eligibility
-   Booking type
-   Required member fields
-   Seller/event relationship

Do not create an invalid booking.

------------------------------------------------------------------------

# 10. Payment Options

Customer must have two payment options:

### Option 1 -- COD

``` text
Cash on Delivery
```

### Option 2 -- Razorpay

``` text
Online Payment
```

Payment summary should show:

``` text
Total Members: 3
Total Amount: ₹XXXX

Payment Method:
○ COD
○ Razorpay
```

------------------------------------------------------------------------

# 11. Razorpay Flow

Razorpay flow:

``` text
Customer selects Razorpay
        ↓
Create Booking / Payment Intent
        ↓
Create Razorpay Order
        ↓
Customer completes payment
        ↓
Verify Razorpay payment/signature
        ↓
Mark payment as Paid
        ↓
Confirm booking
        ↓
Create member-wise tickets
        ↓
Generate unique QR codes
        ↓
Send customer notification
        ↓
Show tickets in My Tickets
```

Store:

-   Razorpay Order ID
-   Razorpay Payment ID
-   Payment status
-   Amount

Never trust only the frontend payment success response. Verify payment
server-side.

------------------------------------------------------------------------

# 12. COD Flow

COD must be supported.

Minimum payment state:

``` text
Payment Method: COD
Payment Status: Pending
```

The exact ticket-generation behavior for COD should follow the existing
project's business rules.

If COD bookings are immediately confirmed:

``` text
Create Booking
↓
Confirm Booking
↓
Generate Tickets
↓
Generate QR
```

If COD requires seller/admin confirmation:

``` text
Create Booking
↓
Pending
↓
Seller/Admin Confirmation
↓
Generate Tickets
↓
Generate QR
```

First inspect the existing project to determine whether a COD workflow
already exists. Reuse it instead of creating duplicate logic.

------------------------------------------------------------------------

# 13. General Booking Record

A booking should contain at minimum:

``` text
Booking ID
Customer ID
Seller ID
Event ID / Venue ID / Product ID
Booking Type
Booking Date
Time Slot
Total Members
Total Amount
Payment Method
Payment Status
Booking Status
Razorpay Order ID
Razorpay Payment ID
Created At
Updated At
```

------------------------------------------------------------------------

# 14. Member-Wise Ticket Generation

This is mandatory.

If one booking contains 3 members, generate 3 separate tickets.

Example:

``` text
Booking: GB10025

Member 1
Ticket ID: TKT1001
QR: Unique QR 1

Member 2
Ticket ID: TKT1002
QR: Unique QR 2

Member 3
Ticket ID: TKT1003
QR: Unique QR 3
```

Do not generate only one shared QR for the entire booking.

Every member must have an independent ticket and QR.

------------------------------------------------------------------------

# 15. Ticket Information

Each ticket should display:

-   Event/Venue Name
-   Seller Name
-   Booking ID
-   Ticket ID
-   Member Name
-   Adult/Child
-   Gender
-   Age
-   Booking Date
-   Time Slot
-   Ticket Status
-   QR Code

The ticket should be accessible from the customer's app.

------------------------------------------------------------------------

# 16. QR Code Requirements

Each ticket must have a unique secure QR.

QR should contain only a secure ticket identifier/token and should not
expose sensitive customer information directly.

Server must validate the QR.

The QR should be linked to:

-   Ticket ID
-   Booking ID
-   Seller ID
-   Event/Venue ID

Duplicate QR generation must not occur.

------------------------------------------------------------------------

# 17. Customer My Tickets

Customer should have a **My Tickets** section.

Example:

``` text
Booking #GB10025

Rajeev
Ticket ID: TKT1001
Status: Confirmed
[QR Code]

Rahul
Ticket ID: TKT1002
Status: Confirmed
[QR Code]
```

Customer should be able to open each member's individual ticket.

------------------------------------------------------------------------

# 18. Seller QR Scanner

Seller panel must provide a QR scanner.

Scanner can use the device camera where supported.

After scanning, send the secure QR/token to the backend.

Backend must verify:

1.  QR exists.
2.  Ticket exists.
3.  Ticket belongs to the seller's event/venue.
4.  Ticket is not cancelled.
5.  Ticket is not already used.
6.  Booking is valid.
7.  Date/time/event rules are satisfied where applicable.
8.  Seller has permission to scan the ticket.

------------------------------------------------------------------------

# 19. QR Scan Results

### Valid Ticket

``` text
Valid Ticket
Checked-In Successfully
```

Ticket status:

``` text
Checked-In
```

### Already Scanned

``` text
Already Used / Already Scanned
```

Do not allow another successful check-in.

### Cancelled Ticket

``` text
Ticket Cancelled
```

### Invalid Ticket

``` text
Invalid Ticket
```

### Wrong Seller/Event

``` text
Unauthorized Ticket
```

Seller must not be able to successfully check in another seller's
ticket.

------------------------------------------------------------------------

# 20. Ticket Status

Member ticket status should be separate from booking status.

Recommended ticket statuses:

``` text
Pending
Confirmed
Checked-In
Completed
Cancelled
Invalid
```

Typical flow:

``` text
Pending
  ↓
Confirmed
  ↓
Checked-In
  ↓
Completed
```

Cancellation:

``` text
Confirmed
  ↓
Cancelled
```

Invalid QR:

``` text
Invalid
```

------------------------------------------------------------------------

# 21. Booking Status

Booking status must be separate from ticket status.

Recommended booking statuses:

``` text
Pending
Confirmed
Cancelled
Completed
```

Example:

``` text
Booking
Confirmed

Member Ticket 1
Checked-In

Member Ticket 2
Checked-In

Member Ticket 3
Cancelled
```

This allows member-level tracking inside the same booking.

------------------------------------------------------------------------

# 22. Payment Status

Payment status must be separate.

Recommended values:

``` text
Pending
Paid
Failed
Refunded
```

Examples:

``` text
Razorpay
Paid

COD
Pending
```

------------------------------------------------------------------------

# 23. Cancellation Flow

Customer must be able to cancel the booking/ticket according to the
configured cancellation policy.

Cancellation must:

1.  Validate cancellation eligibility.
2.  Update booking/ticket status.
3.  Invalidate related QR code(s).
4.  Release capacity where applicable.
5.  Notify seller.
6.  Notify admin.
7.  Notify customer.
8.  Handle Razorpay refund where applicable.

Cancelled QR must never be accepted by the seller scanner.

If individual member cancellation is supported, only that member's
ticket should be cancelled and the remaining members should remain
active.

------------------------------------------------------------------------

# 24. Capacity Release

When a booking is cancelled:

``` text
Cancelled Members
↓
Release Capacity
↓
Update Remaining Capacity
↓
Slot becomes available if applicable
```

If payment fails or payment expires during a temporary reservation,
reserved capacity must also be released.

------------------------------------------------------------------------

# 25. Notifications

Customer notifications should cover:

-   Booking created
-   Payment successful
-   Payment failed
-   Booking confirmed
-   Ticket generated
-   QR generated
-   Booking cancelled
-   Ticket cancelled
-   Ticket/check-in status
-   Important booking updates

Seller notifications:

-   New booking
-   New member booking
-   Booking cancellation
-   Payment/booking status update
-   Upcoming booking
-   Relevant check-in updates

Admin should have booking/status visibility and notifications where the
existing notification architecture supports it.

Reuse the existing notification system.

------------------------------------------------------------------------

# 26. Admin Panel

Admin must see complete booking information.

Admin should be able to view:

### Booking Information

-   Booking ID
-   Customer
-   Seller
-   Event/Venue
-   Booking Type
-   Date
-   Time Slot
-   Total Members
-   Total Amount

### Payment

-   Payment Method
-   Payment Status
-   Razorpay Order ID
-   Razorpay Payment ID

### Members

-   Member Name
-   Adult/Child
-   Gender
-   Age
-   Mobile/WhatsApp

### Tickets

-   Ticket ID
-   QR status
-   Ticket status
-   Scanned at
-   Check-in status

### Cancellation

-   Cancellation status
-   Cancellation date
-   Refund status, if applicable

------------------------------------------------------------------------

# 27. Seller Panel

Seller dashboard should contain:

## General Bookings

-   Pending
-   Confirmed
-   Cancelled
-   Completed
-   Upcoming

## Member Tickets

-   Member name
-   Ticket ID
-   Ticket status
-   QR/check-in status

## QR Scanner

-   Scan ticket
-   Show ticket details
-   Check validity
-   Check seller/event ownership
-   Check current status
-   Mark as Checked-In
-   Prevent duplicate scan

Seller must only access data belonging to their own event/venue.

------------------------------------------------------------------------

# 28. Calendar Management

Admin/Seller should be able to configure:

``` text
Date
Open/Closed
Holiday
Time Slots
Maximum Capacity
Minimum Age
Maximum Age
```

Example:

``` text
20 Aug
Status: Open

10 AM – 12 PM
Capacity: 20
Min Age: 10

2 PM – 4 PM
Capacity: 30
Min Age: 5
```

Different time slots can have different capacities and age rules.

------------------------------------------------------------------------

# 29. Suggested Database Structure

Before creating new models, inspect the existing project.

If equivalent models already exist, extend/reuse them.

Do not create duplicate Customer, Seller, Product, Event, Calendar,
Payment, Booking or Notification models unnecessarily.

## GeneralBooking

``` text
customerId
sellerId
eventId
venueId / productId
bookingType
bookingDate
timeSlot
totalMembers
totalAmount
paymentMethod
paymentStatus
bookingStatus
razorpayOrderId
razorpayPaymentId
createdAt
updatedAt
```

## MemberTicket

``` text
bookingId
customerId
sellerId
eventId
venueId / productId
memberName
category
gender
age
mobileNumber
ticketId
secureQrToken
status
scannedAt
createdAt
updatedAt
```

## Calendar / Slot

Reuse the existing calendar model if available.

Required information:

``` text
sellerId
eventId
venueId / productId
date
timeSlot
isOpen
isHoliday
maxCapacity
bookedCapacity
remainingCapacity
minAge
maxAge
```

------------------------------------------------------------------------

# 30. API Requirements

Use the existing API structure and authentication middleware.

## Customer APIs

``` text
GET    available dates
GET    available time slots
GET    event/venue details
POST   create booking
POST   create Razorpay order
POST   verify payment
GET    my bookings
GET    my tickets
GET    ticket details
PATCH  cancel booking
PATCH  cancel member ticket
```

## Seller APIs

``` text
GET    seller bookings
GET    booking details
GET    member tickets
POST   scan ticket
GET    ticket status
PATCH  booking status
```

## Admin APIs

``` text
GET    all bookings
GET    booking details
GET    seller-wise bookings
GET    event/venue-wise bookings
GET    member tickets
GET    payment details
GET    QR/check-in status
GET    cancelled bookings
```

Do not create duplicate APIs if equivalent APIs already exist.

------------------------------------------------------------------------

# 31. Security

Mandatory security requirements:

-   Customer authentication
-   Seller authentication
-   Admin authentication
-   Role-based authorization
-   Seller data isolation
-   Customer data isolation
-   Payment verification
-   QR token validation
-   Duplicate scan prevention
-   Capacity concurrency protection
-   Input validation
-   Booking ownership validation
-   Ticket ownership validation

Never trust customer-submitted seller IDs or ticket status.

Seller/event ownership must be validated server-side.

------------------------------------------------------------------------

# 32. Error Handling

Handle at least:

``` text
Date unavailable
Time slot unavailable
Holiday/closed date
Capacity exceeded
Age not eligible
Invalid member information
Payment failed
Payment verification failed
Booking not found
Ticket not found
Ticket cancelled
Ticket already scanned
Invalid QR
Unauthorized seller
Duplicate booking
Cancellation not allowed
```

Return consistent API responses using the existing project's response
format.

------------------------------------------------------------------------

# 33. Frontend Requirements

Customer frontend should provide:

1.  Booking Type
2.  Calendar
3.  Time Slot
4.  Capacity/remaining capacity
5.  Member list
6.  Add Member
7.  Age validation
8.  Total amount
9.  COD/Razorpay
10. Booking confirmation
11. My Bookings
12. My Tickets
13. Member-wise QR
14. Cancellation where allowed
15. Notifications

Seller frontend should provide:

1.  General Booking list
2.  Booking details
3.  Member list
4.  Ticket list
5.  QR Scanner
6.  Scan result
7.  Ticket status
8.  Check-in status

Admin frontend should provide:

1.  Calendar management
2.  Capacity management
3.  Age eligibility management
4.  Booking list
5.  Booking details
6.  Member details
7.  Payment status
8.  Ticket/QR status
9.  Cancellation/refund information

------------------------------------------------------------------------

# 34. Verification / Testing

Test the complete flow.

## Test 1 -- Normal Razorpay Booking

``` text
Customer login
↓
Select Event/Venue
↓
Select Open Date
↓
Select Time Slot
↓
Select Booking Type
↓
Add 3 Members
↓
Validate Age
↓
Validate Capacity
↓
Select Razorpay
↓
Complete Payment
↓
Verify Payment
↓
Booking Confirmed
↓
3 Member Tickets Generated
↓
3 Unique QR Codes Generated
↓
Customer Notification
↓
Admin Booking Visible
↓
Seller Booking Visible
```

## Test 2 -- COD

Verify:

``` text
COD
↓
Booking Created
↓
Correct Payment Status
↓
Correct Ticket/QR behavior
```

according to the existing COD business rule.

## Test 3 -- Capacity

If:

``` text
Capacity = 10
Remaining = 2
```

then booking 3 members must fail.

## Test 4 -- Age

If:

``` text
Minimum Age = 10
```

then member age 8 must fail.

## Test 5 -- Closed Date

Closed/holiday date must not be selectable.

## Test 6 -- Duplicate QR Scan

``` text
First Scan
→ Checked-In

Second Scan
→ Already Used
```

Second scan must not change the ticket back to Checked-In.

## Test 7 -- Cancelled Ticket

``` text
Customer Cancels
↓
Ticket Cancelled
↓
QR Invalid
↓
Seller Scan
↓
Ticket Cancelled
```

## Test 8 -- Seller Isolation

Seller A must not be able to access or check in Seller B's ticket.

## Test 9 -- Capacity Release

``` text
Booking Cancelled
↓
Capacity Released
↓
Remaining Capacity Updated
```

## Test 10 -- Payment Failure

``` text
Payment Failed
↓
Booking Not Confirmed
↓
Reserved Capacity Released
```

------------------------------------------------------------------------

# 35. Implementation Rules for Cursor

Before writing code:

1.  Inspect the complete existing project architecture.
2.  Inspect current Customer model.
3.  Inspect current Seller model.
4.  Inspect Product/Event/Venue model.
5.  Inspect Calendar model.
6.  Inspect existing Booking model.
7.  Inspect existing Payment/Razorpay implementation.
8.  Inspect existing COD implementation.
9.  Inspect existing Notification system.
10. Inspect existing Admin and Seller dashboards.
11. Inspect existing authentication/authorization.
12. Inspect existing QR/image/file utilities if available.

Then provide an implementation summary showing:

-   Existing models to reuse
-   Models to modify
-   New models required
-   Existing APIs to reuse
-   New APIs required
-   Frontend screens to modify
-   New screens required

After approval/inspection, implement the module.

## Important

Do NOT unnecessarily rewrite existing modules.

Do NOT create duplicate functionality.

Do NOT break existing booking/payment functionality.

Reuse existing project conventions for:

-   Database
-   Models
-   Controllers
-   Routes
-   Middleware
-   Validation
-   Error handling
-   Notifications
-   Payment
-   Authentication
-   UI components

------------------------------------------------------------------------

# 36. Final End-to-End Flow

The final system should work as:

``` text
Admin/Seller
    ↓
Configure Calendar
    ↓
Open Date + Time Slot
    ↓
Set Capacity + Age Eligibility
    ↓
Customer
    ↓
Select Event/Venue
    ↓
Select Booking Type
    ↓
Select Available Date
    ↓
Select Available Time Slot
    ↓
Add Members
    ↓
Age Validation
    ↓
Capacity Validation
    ↓
Payment
    ↓
COD / Razorpay
    ↓
Booking Confirmation
    ↓
Member-wise Tickets
    ↓
Unique Member QR Codes
    ↓
Customer Notification
    ↓
Admin Booking Entry
    ↓
Seller Booking Entry
    ↓
Seller QR Scanner
    ↓
QR Validation
    ↓
Checked-In
    ↓
Completed
```

Cancellation flow:

``` text
Customer
    ↓
Cancel Booking/Ticket
    ↓
Validate Cancellation
    ↓
Update Status
    ↓
Invalidate QR
    ↓
Release Capacity
    ↓
Refund if applicable
    ↓
Notify Customer
    ↓
Notify Seller
    ↓
Update Admin
```

------------------------------------------------------------------------

# 37. Final Acceptance Criteria

The implementation is complete only when all of the following work:

-   [ ] Open/closed/holiday calendar
-   [ ] Date selection
-   [ ] Time-slot selection
-   [ ] Date/time-slot capacity
-   [ ] Booking Type
-   [ ] Multiple member addition
-   [ ] Adult/Child
-   [ ] Gender
-   [ ] Age
-   [ ] WhatsApp/Mobile
-   [ ] Configurable age eligibility
-   [ ] Capacity validation
-   [ ] Capacity locking/release
-   [ ] Seller assignment
-   [ ] Seller data isolation
-   [ ] COD
-   [ ] Razorpay
-   [ ] Payment verification
-   [ ] Booking confirmation
-   [ ] Member-wise tickets
-   [ ] Unique QR per member
-   [ ] Customer My Tickets
-   [ ] Customer notifications
-   [ ] Seller booking dashboard
-   [ ] Seller QR scanner
-   [ ] QR validation
-   [ ] Duplicate scan prevention
-   [ ] Check-in status
-   [ ] Ticket cancellation
-   [ ] Booking cancellation
-   [ ] Capacity release after cancellation
-   [ ] Refund handling where applicable
-   [ ] Admin booking management
-   [ ] Admin payment visibility
-   [ ] Admin member visibility
-   [ ] Admin ticket/QR visibility
-   [ ] Completed status
-   [ ] Proper error handling
-   [ ] Security and authorization
-   [ ] No existing functionality broken
