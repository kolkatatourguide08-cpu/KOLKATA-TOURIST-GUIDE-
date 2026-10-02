/* =========================================================
   KTG — KOLKATA TOURIST GUIDE
   server.js

   FEATURES
   ---------------------------------------------------------
   - Express
   - Socket.IO
   - Hotel API
   - Restaurant API
   - Business Edit Dashboard
   - Master Admin Edit ID
   - Individual Restaurant Verification IDs
   - Individual Hotel Verification IDs
   - Verification IDs stored directly in the split place data files
   - Atomic split-data saving
   - Protected business editing
========================================================= */

"use strict";

const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { Server } = require("socket.io");


/* =========================================================
   APP
========================================================= */

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true
  }
});

app.disable("x-powered-by");


/* =========================================================
   CONFIG
========================================================= */

const PORT =
  Number(process.env.PORT) || 3000;


/*
   MASTER ADMIN ID

   This ID can access ANY hotel or restaurant.

   Default:
   KTG-ADMIN-2026

   Production:
   Set environment variable:

   KTG_ADMIN_ID=your-master-id
*/
const MASTER_VERIFICATION_ID = "KTG-ADMIN-2026";

const MASTER_EDIT_ID =
  String(
    process.env.KTG_ADMIN_ID ||
    "KTG-ADMIN-2026"
  ).trim();


/* =========================================================
   PROJECT PATHS
========================================================= */

const PROJECT_DIR = __dirname;

const PUBLIC_DIR = PROJECT_DIR;

const DATA_DIR =
  path.join(
    PUBLIC_DIR,
    "data"
  );

const DATA_FILES = Array.from(
  { length: 10 },
  (_, index) => {
    const dataPath = path.join(DATA_DIR, `places-${index + 1}.json`);
    const rootPath = path.join(PUBLIC_DIR, `places-${index + 1}.json`);
    return fs.existsSync(dataPath) ? dataPath : rootPath;
  }
);


/* =========================================================
   OPTIONAL .ENV LOADER
========================================================= */
function loadLocalEnvFile() {
  const envFile = path.join(PROJECT_DIR, ".env");
  if (!fs.existsSync(envFile)) return;
  try {
    const lines = fs.readFileSync(envFile, "utf8").split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!match) continue;
      const key = match[1];
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch (error) {
    console.warn("⚠️ Could not read .env file:", error.message);
  }
}
loadLocalEnvFile();


/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(
  express.json({
    limit: "15mb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb"
  })
);


/* =========================================================
   STATIC WEBSITE + LIVE DATA ROUTES

   IMPORTANT: places.json is a compatibility endpoint. The actual
   editable source is the split places-1.json ... places-10.json
   files. Always build places.json responses from the latest split
   data so the public website never reads stale data after an edit.
========================================================= */

app.get(["/places.json", "/data/places.json"], (req, res) => {
  try {
    const places = loadPlacesData();
    res.set({
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0"
    });
    return res.json(places);
  } catch (error) {
    console.error("GET live places.json error:", error);
    return sendJsonError(res, 500, error.message || "Place data could not be loaded.");
  }
});

app.use(
  express.static(
    PUBLIC_DIR,
    {
      etag: false,
      lastModified: false,
      maxAge: 0
    }
  )
);


/* =========================================================
   HELPERS
========================================================= */

function cleanString(value) {
  return String(
    value ?? ""
  ).trim();
}


function normalize(value) {
  return cleanString(value)
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      "-"
    )
    .replace(
      /^-+|-+$/g,
      "");
}


function normalizeId(value) {
  return cleanString(value)
    .toUpperCase();
}


function safeObject(value) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}


function sendJsonError(
  res,
  status,
  message
) {
  return res
    .status(status)
    .json({
      success: false,
      message
    });
}


/* =========================================================
   SMS HELPERS — TWILIO REST API
========================================================= */
function normalizeSmsNumber(value) {
  const raw = cleanString(value);
  if (!raw) return "";
  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return "+91" + digits;
  if (hasPlus) return "+" + digits;
  if (digits.length >= 11 && digits.length <= 15) return "+" + digits;
  return "";
}
function twilioConfigured() {
  return Boolean(cleanString(process.env.TWILIO_ACCOUNT_SID) && cleanString(process.env.TWILIO_AUTH_TOKEN) && (cleanString(process.env.TWILIO_MESSAGING_SERVICE_SID) || cleanString(process.env.TWILIO_FROM_NUMBER)));
}
function sendTwilioSms({to, body}) {
  return new Promise((resolve, reject) => {
    const https = require("https");
    const querystring = require("querystring");
    const accountSid = cleanString(process.env.TWILIO_ACCOUNT_SID);
    const authToken = cleanString(process.env.TWILIO_AUTH_TOKEN);
    const messagingServiceSid = cleanString(process.env.TWILIO_MESSAGING_SERVICE_SID);
    const fromNumber = cleanString(process.env.TWILIO_FROM_NUMBER);
    if (!accountSid || !authToken || (!messagingServiceSid && !fromNumber)) { reject(new Error("SMS service is not configured. Add Twilio settings to .env.")); return; }
    const params={To:to,Body:body};
    if (messagingServiceSid) params.MessagingServiceSid=messagingServiceSid; else params.From=fromNumber;
    const payload=querystring.stringify(params);
    const auth=Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const request=https.request({hostname:"api.twilio.com",path:`/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,method:"POST",headers:{Authorization:`Basic ${auth}`,"Content-Type":"application/x-www-form-urlencoded","Content-Length":Buffer.byteLength(payload)}},response=>{
      let raw=""; response.on("data",chunk=>raw+=chunk); response.on("end",()=>{let parsed={}; try{parsed=raw?JSON.parse(raw):{};}catch{} if(response.statusCode>=200&&response.statusCode<300){resolve({sid:parsed.sid||"",status:parsed.status||"queued"});return;} reject(new Error(parsed.message||`Twilio SMS request failed with HTTP ${response.statusCode}.`));});
    });
    request.on("error",reject); request.write(payload); request.end();
  });
}
function findBusinessForBooking({entityType,entityId,entityName,places}) {
  const type=cleanString(entityType).toLowerCase(); const id=normalizeId(entityId); const name=normalize(entityName); if(!Array.isArray(places)) return null;
  for(const place of places){
    const collection=type==="hotel"?(Array.isArray(place?.hotels)?place.hotels:[]):type==="restaurant"?(Array.isArray(place?.restaurants)?place.restaurants:[]):[];
    for(const item of collection){
      const itemId=normalizeId(item?.restaurantId||item?.hotelId||item?.["Restaurant ID"]||item?.["Hotel ID"]||item?.businessId||item?.id);
      const itemName=normalize(item?.name||item?.hotelName||item?.restaurantName);
      if(id&&itemId&&id===itemId) return {place,business:item,businessId:itemId};
      if(!id&&name&&itemName&&name===itemName) return {place,business:item,businessId:itemId};
    }
  }
  return null;
}
function createBookingId(type){const prefix=cleanString(type).toLowerCase()==="hotel"?"HOTEL":"REST";return `KTG-${prefix}-BOOK-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;}
function createBookingSms({bookingId,booking,business}){
  const lines=["KTG BOOKING REQUEST",`Booking ID: ${bookingId}`,`Business: ${business.name||booking.entityName||"Unknown"}`,`Type: ${String(booking.entityType||"").toUpperCase()}`,`Guest: ${booking.customerName||booking.guestName||"—"}`,`Customer Mobile: ${booking.customerPhone||booking.phone||"—"}`];
  if(booking.bookingDate)lines.push(`Date: ${booking.bookingDate}`); if(booking.bookingTime)lines.push(`Time: ${booking.bookingTime}`); if(booking.checkIn)lines.push(`Check-in: ${booking.checkIn}`); if(booking.checkOut)lines.push(`Check-out: ${booking.checkOut}`); if(booking.guests)lines.push(`Guests: ${booking.guests}`); if(booking.roomType||booking.room)lines.push(`Room: ${booking.roomType||booking.room}`); if(booking.address)lines.push(`Address: ${booking.address}`); if(booking.specialRequest)lines.push(`Request: ${booking.specialRequest}`); lines.push("Please confirm availability with the customer."); return lines.join("\n");
}

/* =========================================================
   LOAD PLACES.JSON
========================================================= */

function loadPlacesData() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const places = [];

  for (const file of DATA_FILES) {
    if (!fs.existsSync(file)) {
      throw new Error("Place data file not found: " + file);
    }

    const raw = fs.readFileSync(file, "utf8");

    if (!raw.trim()) {
      throw new Error("Place data file is empty: " + file);
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error("Place data file contains invalid JSON: " + file);
    }

    if (!Array.isArray(parsed)) {
      throw new Error("Place data file must contain an array: " + file);
    }

    places.push(...parsed);
  }

  if (!places.length) {
    throw new Error("All place data files are empty.");
  }

  return places;
}


/* =========================================================
   SAVE SPLIT PLACE DATA ATOMICALLY
========================================================= */

function savePlacesData(places) {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  if (!Array.isArray(places)) {
    throw new Error("Place data must be an array.");
  }

  /*
     Persistent database for the Node/Express version:
     write back to the same 10 JSON files used by the site.
     A backup of each existing file is created before replacement.
  */
  for (const file of DATA_FILES) {
    if (fs.existsSync(file)) {
      const backup = file + ".bak";
      try {
        fs.copyFileSync(file, backup);
      } catch (e) {
        console.warn("Could not create backup:", file, e.message);
      }
    }
  }

  const total = places.length;
  const baseSize = Math.floor(total / DATA_FILES.length);
  const remainder = total % DATA_FILES.length;
  let offset = 0;
  const tempFiles = [];

  try {
    for (let i = 0; i < DATA_FILES.length; i++) {
      const size = baseSize + (i < remainder ? 1 : 0);
      const chunk = places.slice(offset, offset + size);
      offset += size;

      const tempFile = DATA_FILES[i] + ".tmp";
      fs.writeFileSync(
        tempFile,
        JSON.stringify(chunk, null, 2) + "\n",
        "utf8"
      );
      tempFiles.push({ tempFile, target: DATA_FILES[i] });
    }

    for (const item of tempFiles) {
      fs.renameSync(item.tempFile, item.target);
    }
  } catch (error) {
    for (const item of tempFiles) {
      try {
        if (fs.existsSync(item.tempFile)) fs.unlinkSync(item.tempFile);
      } catch (_) {}
    }
    throw error;
  }
}

/* =========================================================
   ENTITY LIST
========================================================= */

function getEntityList(
  place,
  entityType
) {

  const type =
    cleanString(
      entityType
    ).toLowerCase();


  if (
    type === "restaurant"
  ) {

    return Array.isArray(
      place.restaurants
    )
      ? place.restaurants
      : [];
  }


  if (
    type === "hotel"
  ) {

    return Array.isArray(
      place.hotels
    )
      ? place.hotels
      : [];
  }


  return [];
}


/* =========================================================
   GET RESTAURANT ID
========================================================= */

function getRestaurantId(
  restaurant,
  place,
  restaurantIndex
) {

  if (!restaurant) {
    return "";
  }


  const possibleIds = [

    restaurant[
      "Restaurant ID"
    ],

    restaurant[
      "restaurant ID"
    ],

    restaurant.restaurantId,

    restaurant.restaurantID,

    restaurant.restaurant_id,

    restaurant.businessId,

    restaurant.businessID,

    restaurant.business_id,

    restaurant.id

  ];


  for (
    const value of possibleIds
  ) {

    const id =
      cleanString(value);

    if (id) {
      return id;
    }
  }


  /*
     Fallback ID.
  */

  const placeId =
    cleanString(
      place &&
      place.id
    );


  const placePart =
    normalize(
      placeId ||
      "PLACE"
    )
      .toUpperCase();


  return (
    "REST-" +
    placePart +
    "-" +
    String(
      restaurantIndex + 1
    ).padStart(
      3,
      "0"
    )
  );
}


/* =========================================================
   GET HOTEL ID
========================================================= */

function getHotelId(
  hotel,
  place,
  hotelIndex
) {

  if (!hotel) {
    return "";
  }


  const possibleIds = [

    hotel[
      "Hotel ID"
    ],

    hotel[
      "hotel ID"
    ],

    hotel.hotelId,

    hotel.hotelID,

    hotel.hotel_id,

    hotel.businessId,

    hotel.businessID,

    hotel.business_id,

    hotel.id

  ];


  for (
    const value of possibleIds
  ) {

    const id =
      cleanString(value);

    if (id) {
      return id;
    }
  }


  const placeId =
    cleanString(
      place &&
      place.id
    );


  const placePart =
    normalize(
      placeId ||
      "PLACE"
    )
      .toUpperCase();


  return (
    "HOTEL-" +
    placePart +
    "-" +
    String(
      hotelIndex + 1
    ).padStart(
      3,
      "0"
    )
  );
}


/* =========================================================
   GET BUSINESS VERIFICATION ID

   IMPORTANT:
   This function ONLY reads from places.json.

   It does NOT generate IDs.
   It does NOT use edit-credentials.json.
========================================================= */

function getBusinessVerificationId(
  business,
  entityType
) {

  if (!business) {
    return "";
  }


  const type =
    cleanString(
      entityType
    ).toLowerCase();


  /*
     Common verificationId
  */

  const commonCandidates = [

    business.verificationId,

    business.verificationID,

    business[
      "verification id"
    ],

    business[
      "Verification ID"
    ],

    business[
      "Edit Verification ID"
    ]

  ];


  for (
    const value
    of commonCandidates
  ) {

    const id =
      cleanString(value);

    if (id) {
      return id;
    }
  }


  /*
     Restaurant-specific fields
  */

  if (
    type === "restaurant"
  ) {

    const restaurantCandidates = [

      business.restaurantVerificationId,

      business.restaurantVerificationID,

      business.restaurantEditId,

      business.restaurantEditID,

      business[
        "Restaurant Verification ID"
      ],

      business[
        "Restaurant Edit ID"
      ],

      business[
        "Restaurant Verification"
      ]

    ];


    for (
      const value
      of restaurantCandidates
    ) {

      const id =
        cleanString(value);

      if (id) {
        return id;
      }
    }
  }


  /*
     Hotel-specific fields
  */

  if (
    type === "hotel"
  ) {

    const hotelCandidates = [

      business.hotelVerificationId,

      business.hotelVerificationID,

      business.hotelEditId,

      business.hotelEditID,

      business[
        "Hotel Verification ID"
      ],

      business[
        "Hotel Edit ID"
      ],

      business[
        "Hotel Verification"
      ]

    ];


    for (
      const value
      of hotelCandidates
    ) {

      const id =
        cleanString(value);

      if (id) {
        return id;
      }
    }
  }


  return "";
}


/* =========================================================
   FIND ENTITY
========================================================= */

function findEntity({
  places,
  entityType,
  entityId,
  entityName,
  placeId,
  entityIndex
}) {

  const type =
    cleanString(
      entityType
    ).toLowerCase();


  if (
    type !== "restaurant" &&
    type !== "hotel"
  ) {
    return null;
  }


  const wantedId =
    normalizeId(
      entityId
    );


  const wantedName =
    cleanString(
      entityName
    ).toLowerCase();


  const wantedPlaceId =
    cleanString(
      placeId
    );


  const numericIndex =
    Number(
      entityIndex
    );


  const wantedIndex =
    Number.isInteger(
      numericIndex
    )
      ? numericIndex
      : -1;


  for (
    let placeIndex = 0;
    placeIndex < places.length;
    placeIndex++
  ) {

    const place =
      places[
        placeIndex
      ];


    if (
      !place ||
      typeof place !== "object"
    ) {
      continue;
    }


    /*
       If placeId supplied,
       require exact place.
    */

    if (
      wantedPlaceId &&
      cleanString(
        place.id
      ) !== wantedPlaceId
    ) {
      continue;
    }


    const list =
      getEntityList(
        place,
        type
      );


    /*
       -----------------------------------------------------
       ID MATCH
       -----------------------------------------------------
    */

    if (wantedId) {

      for (
        let itemIndex = 0;
        itemIndex < list.length;
        itemIndex++
      ) {

        const item =
          list[
            itemIndex
          ];


        const actualId =
          type === "restaurant"

            ? getRestaurantId(
                item,
                place,
                itemIndex
              )

            : getHotelId(
                item,
                place,
                itemIndex
              );


        if (
          normalizeId(
            actualId
          ) === wantedId
        ) {

          return {
            place,
            placeIndex,
            item,
            itemIndex,
            actualId,
            entityType: type
          };
        }
      }
    }


    /*
       -----------------------------------------------------
       INDEX MATCH
       -----------------------------------------------------
    */

    if (
      wantedIndex >= 0 &&
      wantedIndex < list.length
    ) {

      const item =
        list[
          wantedIndex
        ];


      const actualId =
        type === "restaurant"

          ? getRestaurantId(
              item,
              place,
              wantedIndex
            )

          : getHotelId(
              item,
              place,
              wantedIndex
            );


      return {
        place,
        placeIndex,
        item,
        itemIndex:
          wantedIndex,
        actualId,
        entityType: type
      };
    }


    /*
       -----------------------------------------------------
       NAME MATCH
       -----------------------------------------------------
    */

    if (wantedName) {

      for (
        let itemIndex = 0;
        itemIndex < list.length;
        itemIndex++
      ) {

        const item =
          list[
            itemIndex
          ];


        const name =
          cleanString(
            item.name ||
            item.restaurantName ||
            item.hotelName ||
            item.businessName ||
            item.title
          )
            .toLowerCase();


        if (
          name === wantedName
        ) {

          const actualId =
            type === "restaurant"

              ? getRestaurantId(
                  item,
                  place,
                  itemIndex
                )

              : getHotelId(
                  item,
                  place,
                  itemIndex
                );


          return {
            place,
            placeIndex,
            item,
            itemIndex,
            actualId,
            entityType: type
          };
        }
      }
    }
  }


  return null;
}


/* =========================================================
   SECURE STRING COMPARISON
========================================================= */

function secureCompare(
  expected,
  supplied
) {

  const expectedValue =
    cleanString(
      expected
    );

  const suppliedValue =
    cleanString(
      supplied
    );


  if (
    !expectedValue ||
    !suppliedValue
  ) {
    return false;
  }


  const expectedBuffer =
    Buffer.from(
      expectedValue,
      "utf8"
    );


  const suppliedBuffer =
    Buffer.from(
      suppliedValue,
      "utf8"
    );


  if (
    expectedBuffer.length !==
    suppliedBuffer.length
  ) {
    return false;
  }


  try {

    return crypto.timingSafeEqual(
      expectedBuffer,
      suppliedBuffer
    );

  } catch {

    return false;
  }
}


/* =========================================================
   VERIFY BUSINESS EDIT ID

   RULES
   ---------------------------------------------------------
   1. KTG-ADMIN-2026
      = MASTER ADMIN
      = CAN ACCESS ANY BUSINESS

   2. RESTAURANT
      verificationId belongs to that restaurant only.

   3. HOTEL
      verificationId belongs to that hotel only.

   4. Verification ID comes DIRECTLY from places.json.
========================================================= */

function verifyBusinessEditId({
  editId,
  entityType,
  entityId,
  entityName,
  placeId,
  places
}) {

  const supplied =
    cleanString(
      editId
    );


  if (!supplied) {

    console.warn(
      "❌ Verification failed: empty Edit ID."
    );

    return null;
  }


  const type =
    cleanString(
      entityType
    ).toLowerCase();


  if (
    type !== "restaurant" &&
    type !== "hotel"
  ) {

    console.warn(
      "❌ Verification failed: invalid business type:",
      type
    );

    return null;
  }


  /*
     FIRST:
     Find the exact business.

     This prevents a business-specific
     ID from being used without identifying
     its business.
  */

  const found =
    findEntity({
      places,
      entityType: type,
      entityId,
      entityName,
      placeId
    });


  if (!found) {

    console.warn(
      "❌ Verification failed: business not found.",
      {
        entityType: type,
        entityId,
        entityName,
        placeId
      }
    );

    return null;
  }


  const business =
    found.item || {};


  /*
     ------------------------------------------------------
     MASTER ADMIN
     ------------------------------------------------------

     KTG-ADMIN-2026 can access any business.
  */

  if (
    secureCompare(
      MASTER_EDIT_ID,
      supplied
    )
  ) {

    console.log(
      "✅ MASTER verification successful:",
      type,
      found.actualId
    );


    return {
      found,
      master: true
    };
  }


  /*
     ------------------------------------------------------
     BUSINESS-SPECIFIC VERIFICATION ID
     ------------------------------------------------------

     Read ONLY from places.json.
  */

  const expectedVerificationId =
    getBusinessVerificationId(
      business,
      type
    );


  console.log(
    "🔎 Business verification lookup:",
    {
      type,
      businessId:
        found.actualId,
      hasVerificationId:
        Boolean(
          expectedVerificationId
        )
    }
  );


  /*
     No ID stored = DENY
  */

  if (
    !expectedVerificationId
  ) {

    console.warn(
      "❌ No verification ID found for:",
      type,
      found.actualId
    );

    return null;
  }


  /*
     Compare supplied ID
     with THIS BUSINESS'S ID.
  */

  const valid =
    secureCompare(
      expectedVerificationId,
      supplied
    );


  if (!valid) {

    console.warn(
      "❌ Invalid business verification ID:",
      type,
      found.actualId
    );

    return null;
  }


  console.log(
    "✅ Business verification successful:",
    type,
    found.actualId
  );


  return {
    found,
    master: false
  };
}


/* =========================================================
   REMOVE PROTECTED FIELDS FROM UPDATE
========================================================= */

function sanitizeUpdateData(
  input
) {

  if (
    !safeObject(input)
  ) {
    return {};
  }


  const output = {};


  Object.keys(
    input
  ).forEach(
    key => {

      /*
         Prototype pollution protection.
      */

      if (
        key === "__proto__" ||
        key === "constructor" ||
        key === "prototype"
      ) {
        return;
      }


      const lower =
        key
          .toLowerCase()
          .replace(
            /\s+/g,
            ""
          );


      /*
         NEVER allow these fields
         to be changed through edit UI.
      */

      const protectedFields = [

        "id",

        "businessid",

        "restaurantid",

        "hotelid",

        "editid",

        "verificationid",

        "restaurantverificationid",

        "restauranteditid",

        "hotelverificationid",

        "hoteleditid",

        "updatedat"

      ];


      if (
        protectedFields.includes(
          lower
        )
      ) {
        return;
      }


      output[key] =
        input[key];
    }
  );


  return output;
}


/* =========================================================
   REMOVE PRIVATE FIELDS FROM RESPONSE
========================================================= */

function makePublicEntity(
  entity,
  entityType,
  actualId
) {

  const output = {
    ...entity
  };


  /*
     Never send verification credentials
     back to browser.
  */

  delete output.verificationId;
  delete output.verificationID;
  delete output[
    "Verification ID"
  ];

  delete output[
    "Restaurant Verification ID"
  ];

  delete output[
    "Restaurant Edit ID"
  ];

  delete output.restaurantVerificationId;
  delete output.restaurantEditId;

  delete output[
    "Hotel Verification ID"
  ];

  delete output[
    "Hotel Edit ID"
  ];

  delete output.hotelVerificationId;
  delete output.hotelEditId;

  delete output.editId;
  delete output[
    "Edit ID"
  ];


  /*
     Normalize business ID.
  */

  if (
    entityType ===
    "restaurant"
  ) {

    output.id =
      actualId;

    output[
      "Restaurant ID"
    ] =
      actualId;
  }


  if (
    entityType ===
    "hotel"
  ) {

    output.id =
      actualId;

    output[
      "Hotel ID"
    ] =
      actualId;
  }


  return output;
}


/* =========================================================
   HEALTH
========================================================= */

app.get(
  "/api/health",
  (req, res) => {

    res.json({
      success: true,
      server: "KTG",
      status: "online",
      editSystem: true,
      masterEditId: true,
      individualBusinessVerification: true,
      verificationSource:
        "places.json"
    });
  }
);


/* =========================================================
   GET ALL PLACES
========================================================= */

app.get(
  "/api/places",
  (req, res) => {

    try {

      const places =
        loadPlacesData();


      /*
         IMPORTANT:
         We return places as they are,
         but remove verification IDs
         from browser response.
      */

      const publicPlaces =
        places.map(
          place => {

            const copy = {
              ...place
            };


            if (
              Array.isArray(
                copy.restaurants
              )
            ) {

              copy.restaurants =
                copy.restaurants.map(
                  restaurant =>
                    makePublicEntity(
                      restaurant,
                      "restaurant",
                      getRestaurantId(
                        restaurant,
                        place,
                        0
                      )
                    )
                );
            }


            if (
              Array.isArray(
                copy.hotels
              )
            ) {

              copy.hotels =
                copy.hotels.map(
                  hotel =>
                    makePublicEntity(
                      hotel,
                      "hotel",
                      getHotelId(
                        hotel,
                        place,
                        0
                      )
                    )
                );
            }


            return copy;
          }
        );


      res.set(
        "Cache-Control",
        "no-store, no-cache, must-revalidate"
      );


      return res.json({
        success: true,
        places: publicPlaces
      });

    } catch (error) {

      console.error(
        "GET /api/places error:",
        error
      );


      return sendJsonError(
        res,
        500,
        error.message
      );
    }
  }
);


/* =========================================================
   GET ALL RESTAURANTS
========================================================= */

app.get(
  "/api/restaurants",
  (req, res) => {

    try {

      const places =
        loadPlacesData();


      const restaurants = [];


      places.forEach(
        (
          place,
          placeIndex
        ) => {

          const list =
            Array.isArray(
              place.restaurants
            )
              ? place.restaurants
              : [];


          list.forEach(
            (
              restaurant,
              restaurantIndex
            ) => {

              const id =
                getRestaurantId(
                  restaurant,
                  place,
                  restaurantIndex
                );


              restaurants.push({

                ...makePublicEntity(
                  restaurant,
                  "restaurant",
                  id
                ),

                id,

                "Restaurant ID":
                  id,

                placeId:
                  place.id || "",

                placeName:
                  place.name || "",

                placeIndex,

                restaurantIndex

              });
            }
          );
        }
      );


      res.set(
        "Cache-Control",
        "no-store"
      );


      return res.json({
        success: true,
        count:
          restaurants.length,
        restaurants
      });

    } catch (error) {

      console.error(
        "GET /api/restaurants error:",
        error
      );


      return sendJsonError(
        res,
        500,
        error.message
      );
    }
  }
);


/* =========================================================
   GET SINGLE RESTAURANT
========================================================= */

app.get(
  "/api/restaurants/:id",
  (req, res) => {

    try {

      const places =
        loadPlacesData();


      const found =
        findEntity({
          places,
          entityType:
            "restaurant",
          entityId:
            req.params.id
        });


      if (!found) {

        return sendJsonError(
          res,
          404,
          "Restaurant not found."
        );
      }


      const publicRestaurant =
        makePublicEntity(
          found.item,
          "restaurant",
          found.actualId
        );


      return res.json({

        success: true,

        id:
          found.actualId,

        restaurant:
          publicRestaurant,

        place:
          {
            id:
              found.place.id ||
              "",

            name:
              found.place.name ||
              ""
          },

        placeId:
          found.place.id ||
          "",

        placeIndex:
          found.placeIndex,

        restaurantIndex:
          found.itemIndex

      });

    } catch (error) {

      console.error(
        "GET restaurant error:",
        error
      );


      return sendJsonError(
        res,
        500,
        error.message
      );
    }
  }
);


/* =========================================================
   GET ALL HOTELS
========================================================= */

app.get(
  "/api/hotels",
  (req, res) => {

    try {

      const places =
        loadPlacesData();


      const hotels = [];


      places.forEach(
        (
          place,
          placeIndex
        ) => {

          const list =
            Array.isArray(
              place.hotels
            )
              ? place.hotels
              : [];


          list.forEach(
            (
              hotel,
              hotelIndex
            ) => {

              const id =
                getHotelId(
                  hotel,
                  place,
                  hotelIndex
                );


              hotels.push({

                ...makePublicEntity(
                  hotel,
                  "hotel",
                  id
                ),

                id,

                "Hotel ID":
                  id,

                placeId:
                  place.id || "",

                placeName:
                  place.name || "",

                placeIndex,

                hotelIndex

              });
            }
          );
        }
      );


      res.set(
        "Cache-Control",
        "no-store"
      );


      return res.json({
        success: true,
        count:
          hotels.length,
        hotels
      });

    } catch (error) {

      console.error(
        "GET /api/hotels error:",
        error
      );


      return sendJsonError(
        res,
        500,
        error.message
      );
    }
  }
);


/* =========================================================
   GET SINGLE HOTEL
========================================================= */

app.get(
  "/api/hotels/:id",
  (req, res) => {

    try {

      const places =
        loadPlacesData();


      const found =
        findEntity({
          places,
          entityType:
            "hotel",
          entityId:
            req.params.id
        });


      if (!found) {

        return sendJsonError(
          res,
          404,
          "Hotel not found."
        );
      }


      const publicHotel =
        makePublicEntity(
          found.item,
          "hotel",
          found.actualId
        );


      return res.json({

        success: true,

        id:
          found.actualId,

        hotel:
          publicHotel,

        place:
          {
            id:
              found.place.id ||
              "",

            name:
              found.place.name ||
              ""
          },

        placeId:
          found.place.id ||
          "",

        placeIndex:
          found.placeIndex,

        hotelIndex:
          found.itemIndex

      });

    } catch (error) {

      console.error(
        "GET hotel error:",
        error
      );


      return sendJsonError(
        res,
        500,
        error.message
      );
    }
  }
);


/* =========================================================
   VERIFY BUSINESS EDIT ID
   ---------------------------------------------------------
   FRONTEND:
   POST /api/admin/verify
========================================================= */

app.post(
  "/api/admin/verify",
  (req, res) => {

    try {

      const body =
        req.body || {};


      const editId =
        cleanString(
          body.editId
        );


      const entityType =
        cleanString(
          body.entityType
        ).toLowerCase();


      const entityId =
        cleanString(
          body.entityId
        );


      const entityName =
        cleanString(
          body.entityName
        );


      const placeId =
        cleanString(
          body.placeId
        );


      /*
         Some frontend versions may send
         restaurantId / hotelId instead
         of entityId.
      */

      const resolvedEntityId =
        entityId ||
        (
          entityType ===
          "restaurant"
            ? cleanString(
                body.restaurantId
              )
            : cleanString(
                body.hotelId
              )
        );


      if (!editId) {

        return sendJsonError(
          res,
          400,
          "Edit ID is required."
        );
      }


      if (
        entityType !==
          "restaurant" &&
        entityType !==
          "hotel"
      ) {

        return sendJsonError(
          res,
          400,
          "Select Hotel or Restaurant."
        );
      }


      if (
        !resolvedEntityId &&
        !entityName
      ) {

        return sendJsonError(
          res,
          400,
          "Business ID or Business Name is required."
        );
      }


      const places =
        loadPlacesData();


      const verified =
        verifyBusinessEditId({

          editId,

          entityType,

          entityId:
            resolvedEntityId,

          entityName,

          placeId,

          places

        });


      if (!verified) {

        return res
          .status(401)
          .json({

            success: false,

            verified: false,

            message:
              "Invalid Edit ID for this specific business."

          });
      }


      return res.json({

        success: true,

        verified: true,

        master:
          verified.master,

        entityType:
          verified
            .found
            .entityType,

        entityId:
          verified
            .found
            .actualId,

        placeId:
          verified
            .found
            .place
            .id || "",

        message:
          verified.master

            ? "Master Edit ID verified."

            : "Business Edit ID verified successfully."

      });

    } catch (error) {

      console.error(
        "POST /api/admin/verify error:",
        error
      );


      return sendJsonError(
        res,
        500,
        "Verification failed."
      );
    }
  }
);


/* =========================================================
   GET ENTITY FOR EDITING
   ---------------------------------------------------------
   FRONTEND:
   POST /api/admin/entity
========================================================= */

app.post(
  "/api/admin/entity",
  (req, res) => {

    try {

      const body =
        req.body || {};


      const editId =
        cleanString(
          body.editId
        );


      const entityType =
        cleanString(
          body.entityType
        ).toLowerCase();


      const entityId =
        cleanString(
          body.entityId
        ) ||
        (
          entityType ===
          "restaurant"

            ? cleanString(
                body.restaurantId
              )

            : cleanString(
                body.hotelId
              )
        );


      const entityName =
        cleanString(
          body.entityName
        );


      const placeId =
        cleanString(
          body.placeId
        );


      if (!editId) {

        return sendJsonError(
          res,
          400,
          "Edit ID is required."
        );
      }


      const places =
        loadPlacesData();


      const verified =
        verifyBusinessEditId({

          editId,

          entityType,

          entityId,

          entityName,

          placeId,

          places

        });


      if (!verified) {

        return sendJsonError(
          res,
          401,
          "Edit ID is not authorized for this business."
        );
      }


      const found =
        verified.found;


      const publicEntity =
        makePublicEntity(
          found.item,
          entityType,
          found.actualId
        );


      return res.json({

        success: true,

        entityType,

        id:
          found.actualId,

        entity:
          publicEntity,

        data:
          publicEntity,

        place: {

          id:
            found.place.id ||
            "",

          name:
            found.place.name ||
            ""

        },

        placeId:
          found.place.id ||
          "",

        placeIndex:
          found.placeIndex,

        entityIndex:
          found.itemIndex,

        master:
          verified.master

      });

    } catch (error) {

      console.error(
        "POST /api/admin/entity error:",
        error
      );


      return sendJsonError(
        res,
        500,
        error.message
      );
    }
  }
);


/* =========================================================
   UPDATE ENTITY
   ---------------------------------------------------------
   FRONTEND:
   PUT /api/admin/entity
========================================================= */

app.put(
  "/api/admin/entity",
  (req, res) => {

    try {

      const body =
        req.body || {};


      const editId =
        cleanString(
          body.editId
        );


      const entityType =
        cleanString(
          body.entityType
        ).toLowerCase();


      const entityId =
        cleanString(
          body.entityId
        ) ||
        (
          entityType ===
          "restaurant"

            ? cleanString(
                body.restaurantId
              )

            : cleanString(
                body.hotelId
              )
        );


      const entityName =
        cleanString(
          body.entityName
        );


      const placeId =
        cleanString(
          body.placeId
        );


      if (
        entityType !==
          "restaurant" &&
        entityType !==
          "hotel"
      ) {

        return sendJsonError(
          res,
          400,
          "Invalid business type."
        );
      }


      if (!editId) {

        return sendJsonError(
          res,
          400,
          "Edit ID is required."
        );
      }


      const incomingData = safeObject(body.data)
        ? body.data
        : safeObject(body.entity)
          ? body.entity
          : null;

      if (!incomingData) {

        return sendJsonError(
          res,
          400,
          "No valid update data supplied."
        );
      }


      const places =
        loadPlacesData();


      /*
         RE-VERIFY BEFORE SAVING.

         This is critical because
         frontend verification alone
         is not enough.
      */

      const verified =
        verifyBusinessEditId({

          editId,

          entityType,

          entityId,

          entityName,

          placeId,

          places

        });


      if (!verified) {

        return sendJsonError(
          res,
          401,
          "Edit ID is not authorized for this business."
        );
      }


      const found =
        verified.found;


      const original =
        found.item;


      const originalId =
        found.actualId;


      /*
         Sanitize update.
      */

      const updateData =
        sanitizeUpdateData(
          incomingData
        );


      /*
         Preserve all existing data.
      */

      const merged = {

        ...original,

        ...updateData,

        updatedAt:
          new Date().toISOString()

      };


      /*
         ALWAYS preserve business ID.
      */

      if (
        entityType ===
        "restaurant"
      ) {

        merged[
          "Restaurant ID"
        ] =
          originalId;


        if (
          Object.prototype
            .hasOwnProperty
            .call(
              original,
              "id"
            )
        ) {

          merged.id =
            original.id;

        } else {

          merged.id =
            originalId;
        }
      }


      if (
        entityType ===
        "hotel"
      ) {

        merged[
          "Hotel ID"
        ] =
          originalId;


        if (
          Object.prototype
            .hasOwnProperty
            .call(
              original,
              "id"
            )
        ) {

          merged.id =
            original.id;

        } else {

          merged.id =
            originalId;
        }
      }


      /*
         IMPORTANT:

         Preserve the ORIGINAL
         verification ID from places.json.

         Even if somebody tries to send
         verificationId in body.data,
         it cannot be changed.
      */

      const originalVerificationId =
        getBusinessVerificationId(
          original,
          entityType
        );


      if (
        originalVerificationId
      ) {

        /*
           Preserve using the same
           field if possible.
        */

        if (
          Object.prototype
            .hasOwnProperty
            .call(
              original,
              "verificationId"
            )
        ) {

          merged.verificationId =
            originalVerificationId;

        }

        else if (
          Object.prototype
            .hasOwnProperty
            .call(
              original,
              "verificationID"
            )
        ) {

          merged.verificationID =
            originalVerificationId;

        }

        else if (
          Object.prototype
            .hasOwnProperty
            .call(
              original,
              "Verification ID"
            )
        ) {

          merged[
            "Verification ID"
          ] =
            originalVerificationId;

        }

        else if (
          entityType ===
          "restaurant" &&
          Object.prototype
            .hasOwnProperty
            .call(
              original,
              "Restaurant Verification ID"
            )
        ) {

          merged[
            "Restaurant Verification ID"
          ] =
            originalVerificationId;

        }

        else if (
          entityType ===
          "hotel" &&
          Object.prototype
            .hasOwnProperty
            .call(
              original,
              "Hotel Verification ID"
            )
        ) {

          merged[
            "Hotel Verification ID"
          ] =
            originalVerificationId;

        }

        else {

          /*
             Default field.
          */

          merged.verificationId =
            originalVerificationId;
        }
      }


      /*
         Remove accidental legacy fields.
      */

      delete merged.editId;
      delete merged[
        "Edit ID"
      ];


      /*
         Write back to places.json.
      */

      const targetArray =
        entityType ===
        "restaurant"

          ? places[
              found.placeIndex
            ].restaurants

          : places[
              found.placeIndex
            ].hotels;


      targetArray[
        found.itemIndex
      ] =
        merged;


      /*
         Atomic save.
      */

      savePlacesData(
        places
      );


      /*
         Response without credentials.
      */

      const publicEntity =
        makePublicEntity(
          merged,
          entityType,
          originalId
        );


      /*
         Notify Socket.IO clients.
      */

      io.emit(
        "ktg:data-updated",
        {

          entityType,

          id:
            originalId,

          placeId:
            found.place.id ||
            ""

        }
      );


      console.log(
        "✏️ Updated business:",
        entityType,
        originalId
      );


      return res.json({

        success: true,

        message:
          entityType ===
          "restaurant"

            ? "Restaurant updated successfully."

            : "Hotel updated successfully.",

        entityType,

        id:
          originalId,

        entity:
          publicEntity,

        data:
          publicEntity

      });

    } catch (error) {

      console.error(
        "PUT /api/admin/entity error:",
        error
      );


      return sendJsonError(
        res,
        500,
        error.message
      );
    }
  }
);


/* =========================================================
   OPTIONAL ALIAS
   ---------------------------------------------------------
   Some frontend versions may use /api/edit/*
========================================================= */

app.post(
  "/api/edit/verify",
  (req, res) => {

    req.url =
      "/api/admin/verify";

    return app._router
      ? null
      : res.status(404).json({
          success: false
        });
  }
);


/*
   NOTE:
   The primary dashboard endpoints are:

   POST /api/admin/verify
   POST /api/admin/entity
   PUT  /api/admin/entity
*/


/* =========================================================
   BOOKING + SMS
========================================================= */
app.post("/api/bookings", async (req,res)=>{
  try{
    const body=req.body||{}; const entityType=cleanString(body.entityType).toLowerCase(); const entityId=cleanString(body.entityId||body.hotelId||body.restaurantId); const entityName=cleanString(body.entityName);
    if(!["hotel","restaurant"].includes(entityType)) return sendJsonError(res,400,"Hotel or Restaurant booking is required.");
    if(!entityId&&!entityName) return sendJsonError(res,400,"Business ID or Business Name is required.");
    const customerName=cleanString(body.customerName||body.guestName); const customerPhone=cleanString(body.customerPhone||body.phone);
    if(!customerName) return sendJsonError(res,400,"Customer name is required.");
    if(!customerPhone||customerPhone.replace(/\D/g,"").length<10) return sendJsonError(res,400,"A valid customer mobile number is required.");
    const places=loadPlacesData(); const found=findBusinessForBooking({entityType,entityId,entityName,places});
    if(!found) return sendJsonError(res,404,"The selected Hotel/Restaurant was not found in places.json.");
    const businessContact=normalizeSmsNumber(found.business.contactNumber);
    if(!businessContact) return sendJsonError(res,422,"This business does not have a valid contact number in places.json.");
    const bookingId=createBookingId(entityType); const booking={...body,entityType,entityId:found.businessId||entityId,entityName:found.business.name||entityName,customerName,customerPhone,createdAt:new Date().toISOString()};
    if(!twilioConfigured()) return res.status(503).json({success:false,bookingId,smsSent:false,message:"Booking data is valid, but SMS service is not configured. Add Twilio settings to .env."});
    const sms=await sendTwilioSms({to:businessContact,body:createBookingSms({bookingId,booking,business:found.business})});
    console.log(`📩 Booking SMS sent: ${bookingId} -> ${businessContact} (${found.business.name||entityName})`);
    return res.json({success:true,bookingId,smsSent:true,smsSid:sms.sid,smsStatus:sms.status,recipient:businessContact,businessName:found.business.name||entityName,message:"Booking confirmed and the booking details were sent by SMS to the business contact number."});
  }catch(error){console.error("POST /api/bookings error:",error);return sendJsonError(res,500,error.message||"Booking could not be submitted.");}
});

/* =========================================================
   API 404
========================================================= */

app.use(
  "/api",
  (req, res) => {

    return sendJsonError(
      res,
      404,
      "API endpoint not found."
    );
  }
);


/* =========================================================
   SOCKET.IO — GROUP CHAT + LIVE LOCATION
========================================================= */

const chatGroups = new Map();

function getChatGroup(groupId){
  if(!chatGroups.has(groupId)) chatGroups.set(groupId,{members:new Map(),locations:new Map(),messages:[]});
  return chatGroups.get(groupId);
}

io.on("connection", socket => {
  console.log("🔌 KTG client connected:", socket.id);

  socket.on("joinGroup", payload => {
    if(!safeObject(payload)) return;
    const groupId=String(payload.groupId||"").trim();
    const name=String(payload.name||"").trim().slice(0,60);
    if(!groupId || !name) return;

    const group=getChatGroup(groupId);
    if(socket.data.groupId && socket.data.groupId!==groupId){
      const old=getChatGroup(socket.data.groupId);
      old.members.delete(socket.id); old.locations.delete(socket.id);
      socket.leave(socket.data.groupId);
      io.to(socket.data.groupId).emit("memberLeft",{id:socket.id,name:socket.data.name||name});
    }

    socket.data.groupId=groupId;
    socket.data.name=name;
    socket.join(groupId);
    group.members.set(socket.id,{id:socket.id,name});

    socket.emit("groupState",{
      members:[...group.members.values()],
      locations:[...group.locations.values()],
      messages:group.messages.slice(-100)
    });
    socket.to(groupId).emit("memberJoined",{id:socket.id,name});
    console.log(`💬 ${name} joined ${groupId}`);
  });

  socket.on("chatMessage", payload => {
    if(!safeObject(payload)) return;
    const groupId=String(payload.groupId||socket.data.groupId||"").trim();
    if(!groupId || socket.data.groupId!==groupId) return;
    const text=String(payload.text||"").trim().slice(0,1000);
    if(!text) return;
    const group=getChatGroup(groupId);
    const message={
      messageId:crypto.randomUUID(),
      senderId:socket.id,
      id:socket.id,
      name:String(socket.data.name||payload.name||"Member").slice(0,60),
      text,
      createdAt:Date.now(),
      replyTo:safeObject(payload.replyTo)?{
        messageId:String(payload.replyTo.messageId||"").slice(0,100),
        name:String(payload.replyTo.name||"").slice(0,60),
        text:String(payload.replyTo.text||"").slice(0,300)
      }:null
    };
    group.messages.push(message);
    if(group.messages.length>100) group.messages.shift();
    io.to(groupId).emit("chatMessage",message);
  });

  socket.on("locationUpdate", payload => {
    if(!safeObject(payload)) return;
    const groupId=String(payload.groupId||socket.data.groupId||"").trim();
    const lat=Number(payload.lat), lng=Number(payload.lng);
    if(!groupId || socket.data.groupId!==groupId || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    if(lat<-90 || lat>90 || lng<-180 || lng>180) return;
    const group=getChatGroup(groupId);
    const location={
      id:socket.id,
      name:String(socket.data.name||payload.name||"Member").slice(0,60),
      groupId,
      lat,lng,
      accuracy:Number.isFinite(Number(payload.accuracy))?Number(payload.accuracy):null,
      timestamp:Date.now()
    };
    group.locations.set(socket.id,location);
    io.to(groupId).emit("locationUpdate",location);
  });

  socket.on("disconnect",()=>{
    const groupId=socket.data.groupId;
    const name=socket.data.name||"Member";
    if(groupId){
      const group=getChatGroup(groupId);
      group.members.delete(socket.id);
      group.locations.delete(socket.id);
      socket.to(groupId).emit("memberLeft",{id:socket.id,name});
      if(group.members.size===0){
        // Keep recent messages briefly available in memory; locations/members are cleared.
        group.locations.clear();
      }
    }
    console.log("🔌 KTG client disconnected:",socket.id);
  });
});


/* =========================================================
   ERROR HANDLER
========================================================= */

app.use(
  (
    error,
    req,
    res,
    next
  ) => {

    console.error(
      "KTG Server Error:",
      error
    );


    if (
      res.headersSent
    ) {

      return next(
        error
      );
    }


    return res
      .status(500)
      .json({

        success: false,

        message:
          "Internal server error."

      });
  }
);


/* =========================================================
   START SERVER
========================================================= */

server.on(
  "error",
  error => {

    console.error(
      "❌ KTG server error:",
      error
    );


    if (
      error.code ===
      "EADDRINUSE"
    ) {

      console.error(
        `❌ Port ${PORT} is already in use.`
      );

      process.exit(
        1
      );
    }
  }
);


server.listen(
  PORT,
  "0.0.0.0",
  error => {

    if (error) {

      console.error(
        "❌ Failed to start KTG server:",
        error
      );

      process.exit(
        1
      );
    }


    console.log("");
    console.log(
      "=========================================="
    );

    console.log(
      "🚀 KTG SERVER STARTED"
    );

    console.log(
      "=========================================="
    );

    console.log(
      "🌐 Local:",
      `http://localhost:${PORT}`
    );

    console.log(
      "🍽️ Restaurant API: ENABLED"
    );

    console.log(
      "🏨 Hotel API: ENABLED"
    );

    console.log(
      "✏️ Business Edit System: ENABLED"
    );

    console.log(
      "🔐 Master Edit ID: ENABLED"
    );

    console.log(
      "🔑 Individual Business IDs: ENABLED"
    );

    console.log(
      "📁 Verification Source:",
      DATA_FILES
    );

    console.log(
      "🔒 Verification IDs:",
      "READ DIRECTLY FROM places.json"
    );

    console.log(
      "🔌 Socket.IO: ENABLED"
    );

    console.log(
      "=========================================="
    );

    console.log("");
  }
);


/* =========================================================
   GRACEFUL SHUTDOWN
========================================================= */

function shutdown(
  signal
) {

  console.log(
    `\n${signal} received. Shutting down KTG...`
  );


  server.close(
    () => {

      console.log(
        "✅ KTG server stopped."
      );

      process.exit(
        0
      );
    }
  );
}


process.on(
  "SIGINT",
  () => shutdown("SIGINT")
);

process.on(
  "SIGTERM",
  () => shutdown("SIGTERM")
);