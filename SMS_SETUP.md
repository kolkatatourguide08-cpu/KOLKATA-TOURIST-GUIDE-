# KTG Booking SMS Setup

The Hotel/Restaurant **Book** flow now sends the booking details to the selected business contact number stored in `public/data/places.json`.

The browser does **not** send SMS directly. The KTG server sends the SMS through Twilio's SMS API.

## 1. Create `.env`

Copy `.env.example` to `.env` in the same folder as `server.js`.

Example:

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_real_auth_token
TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Instead of a Messaging Service, you can use an SMS-capable Twilio number:

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_real_auth_token
TWILIO_FROM_NUMBER=+1xxxxxxxxxx
```

Do not share the Auth Token or commit `.env` to Git.

## 2. Install and run

```powershell
npm install
node --check server.js
npm start
```

Then open:

```text
http://localhost:3000
```

## 3. Booking flow

When a visitor presses **Book**:

1. The booking form collects the visitor's details.
2. The selected Hotel/Restaurant ID is sent to `/api/bookings`.
3. The server reads `places.json`.
4. The server resolves the exact Hotel/Restaurant from its ID.
5. The server reads that business's `contactNumber` from the JSON.
6. The server sends an SMS containing the booking details to that contact number.
7. A KTG booking ID is returned to the browser.

The client cannot choose an arbitrary SMS recipient; the destination is resolved server-side from `places.json`.

## SMS provider note

A real SMS gateway/account is required for automatic SMS delivery. Twilio is used in this implementation. SMS delivery can require account verification, sender setup, and applicable carrier/country registration. Trial accounts may also restrict recipients.
