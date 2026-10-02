/* =====================================================
   KOLKATA TOURIST GUIDE
   PLACE PAGE CONTROLLER
   GOOGLE MAPS + MY LOCATION
===================================================== */

"use strict";

let places = [];
let currentPlace = null;


/* =====================================================
   LOAD PLACE DATA
===================================================== */

async function loadPlace() {

    const card = document.getElementById("placeCard");

    try {

        const response = await fetch(
            "data/places.json",
            {
                cache: "no-store"
            }
        );

        if (!response.ok) {

            throw new Error(
                "Could not load data/places.json"
            );

        }

        const data = await response.json();

        if (!Array.isArray(data)) {

            throw new Error(
                "places.json must contain an array"
            );

        }

        places = data;


        /* ---------------------------------------------
           GET PLACE ID
        --------------------------------------------- */

        const params =
            new URLSearchParams(
                window.location.search
            );

        const id =
            params.get("id") ||
            params.get("place");


        /* ---------------------------------------------
           FIND CURRENT PLACE
        --------------------------------------------- */

        currentPlace =
            places.find(function (place) {

                return String(place.id) ===
                    String(id);

            });


        if (!currentPlace) {

            if (card) {

                card.innerHTML = `
                    <div style="
                        padding:40px;
                        text-align:center;
                    ">

                        <h2>
                            ❌ Tourist place not found
                        </h2>

                        <p>
                            Please go back and select
                            a tourist place again.
                        </p>

                    </div>
                `;

            }

            return;
        }


        /* ---------------------------------------------
           SAVE CURRENT PLACE
        --------------------------------------------- */

        window.currentPlace =
            currentPlace;


        localStorage.setItem(
            "currentPlaceId",
            currentPlace.id
        );


        localStorage.setItem(
            "currentPlace",
            currentPlace.name || ""
        );


        /* ---------------------------------------------
           PAGE TITLE
        --------------------------------------------- */

        document.title =
            (currentPlace.name || "Place") +
            " | Kolkata Tourist Guide";


        /* ---------------------------------------------
           RENDER
        --------------------------------------------- */

        renderPlace();

    }

    catch (error) {

        console.error(
            "PLACE LOAD ERROR:",
            error
        );


        if (card) {

            card.innerHTML = `
                <div style="
                    padding:40px;
                    text-align:center;
                ">

                    <h2>
                        ⚠️ Could not load place
                    </h2>

                    <p>
                        ${esc(error.message)}
                    </p>

                </div>
            `;

        }

    }

}


/* =====================================================
   ESCAPE HTML
===================================================== */

function esc(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


/* =====================================================
   INFORMATION BOX
===================================================== */

function infoBox(title, value) {

    return `
        <div class="info-box">

            <span>
                ${esc(title)}
            </span>

            <strong>
                ${
                    value !== undefined &&
                    value !== null &&
                    String(value).trim() !== ""
                        ? value
                        : "Not added yet"
                }
            </strong>

        </div>
    `;

}


/* =====================================================
   RENDER PLACE
===================================================== */

function renderPlace() {

    const card =
        document.getElementById(
            "placeCard"
        );


    if (!card) {
        return;
    }


    /* ---------------------------------------------
       IMAGE
    --------------------------------------------- */

    const imageHTML =

        currentPlace.image

            ? `
                <img
                    src="${esc(currentPlace.image)}"
                    alt="${esc(currentPlace.name)}"
                    style="
                        width:100%;
                        height:100%;
                        object-fit:cover;
                        border-radius:17px;
                    "
                >
            `

            : `
                <div style="
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    height:100%;
                    font-size:24px;
                    font-weight:bold;
                ">
                    ${esc(currentPlace.name)}
                </div>
            `;


    /* ---------------------------------------------
       ATTRACTIONS
    --------------------------------------------- */

    let attractions = "";


    if (
        Array.isArray(
            currentPlace.attractions
        )
    ) {

        attractions =
            currentPlace.attractions.join(", ");

    }

    else {

        attractions =
            currentPlace.attractions || "";

    }


    /* ---------------------------------------------
       PLACE CARD
    --------------------------------------------- */

    card.innerHTML = `

        <div class="place-photo">

            ${imageHTML}

        </div>


        <div class="place-info">

            <p class="eyebrow">
                PLACE INFORMATION
            </p>


            <h1>
                ${esc(currentPlace.name)}
            </h1>


            <p>
                ${esc(
                    currentPlace.shortInfo ||
                    currentPlace.description ||
                    ""
                )}
            </p>


            <div class="info-grid">

                ${infoBox(
                    "Metro Station",
                    currentPlace.metroStation ||
                    currentPlace.metro
                )}


                ${infoBox(
                    "Opening Hours",
                    currentPlace.openingHours
                )}


                ${infoBox(
                    "Closing Day",
                    currentPlace.closingDay ||
                    currentPlace.closedDays
                )}


                ${infoBox(
                    "Ticket Price",
                    currentPlace.ticketPrice ||
                    currentPlace.entryPrice
                )}


                ${infoBox(
                    "Extra Charges",
                    currentPlace.extraCharges
                )}


                ${infoBox(
                    "Attractions",
                    attractions
                )}


                ${infoBox(
                    "Contact Number",
                    currentPlace.contactNumber
                )}


                ${infoBox(
                    "Official Website",

                    currentPlace.officialWebsite

                        ? `
                            <a
                                href="${esc(
                                    currentPlace.officialWebsite
                                )}"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Open website
                            </a>
                        `

                        : "Not added yet"
                )}

            </div>


            <!-- =====================================
                 SECONDARY BUTTONS
            ====================================== -->

            <div class="sub-actions">


                <button
                    class="secondary"
                    id="mapsBtn"
                    type="button"
                >
                    📍 Open Map
                </button>


                <button
                    class="secondary"
                    id="shareBtn"
                    type="button"
                >
                    ↗ Share
                </button>


                <button
                    class="secondary"
                    id="hotelBtn"
                    type="button"
                >
                    🏨 Booking Hotel
                </button>


                <button
                    class="secondary"
                    id="restaurantBtn"
                    type="button"
                >
                    🍽 Booking Restaurant
                </button>


            </div>


            <!-- =====================================
                 MAIN BUTTONS
            ====================================== -->

            <div
                class="actions"
                style="margin-top:10px"
            >


                <button
                    class="primary"
                    id="chatBtn"
                    type="button"
                >
                    💬 Booking / Group Chat
                </button>


                <button
                    class="primary"
                    id="metroBtn"
                    type="button"
                >
                    🚇 Booking Metro Ticket
                </button>


                <button
                    class="secondary"
                    id="distanceBtn"
                    type="button"
                >
                    📍 My Location
                </button>


                <button
                    class="secondary"
                    id="liveBtn"
                    type="button"
                >
                    🗺 Live Location
                </button>


            </div>

        </div>
    `;


    connectButtons();

}


/* =====================================================
   GET PLACE COORDINATES
===================================================== */

function getPlaceCoordinates() {

    if (!currentPlace) {
        return null;
    }


    /* ---------------------------------------------
       FORMAT 1
    --------------------------------------------- */

    const latitude =
        parseFloat(
            currentPlace.latitude
        );


    const longitude =
        parseFloat(
            currentPlace.longitude
        );


    if (
        Number.isFinite(latitude) &&
        Number.isFinite(longitude)
    ) {

        return {

            latitude:
                latitude,

            longitude:
                longitude

        };

    }


    /* ---------------------------------------------
       FORMAT 2
    --------------------------------------------- */

    if (
        currentPlace.coordinates
    ) {

        const latitude2 =
            parseFloat(
                currentPlace.coordinates.latitude
            );


        const longitude2 =
            parseFloat(
                currentPlace.coordinates.longitude
            );


        if (
            Number.isFinite(latitude2) &&
            Number.isFinite(longitude2)
        ) {

            return {

                latitude:
                    latitude2,

                longitude:
                    longitude2

            };

        }

    }


    return null;

}


/* =====================================================
   CONNECT BUTTONS
===================================================== */

function connectButtons() {


    /* ---------------------------------------------
       OPEN MAP
    --------------------------------------------- */

    const mapsBtn =
        document.getElementById(
            "mapsBtn"
        );


    if (mapsBtn) {

        mapsBtn.addEventListener(
            "click",
            openPlaceInGoogleMaps
        );

    }


    /* ---------------------------------------------
       MY LOCATION
    --------------------------------------------- */

    const distanceBtn =
        document.getElementById(
            "distanceBtn"
        );


    if (distanceBtn) {

        distanceBtn.addEventListener(
            "click",
            getMyLocationAndRoute
        );

    }


    /* ---------------------------------------------
       SHARE
    --------------------------------------------- */

    const shareBtn =
        document.getElementById(
            "shareBtn"
        );


    if (shareBtn) {

        shareBtn.addEventListener(
            "click",
            sharePlace
        );

    }


    /* ---------------------------------------------
   HOTEL
--------------------------------------------- */

const hotelBtn =
    document.getElementById(
        "hotelBtn"
    );

if (hotelBtn) {

    hotelBtn.addEventListener(
        "click",
        function () {

            if (!currentPlace || !currentPlace.id) {

                alert(
                    "Tourist place information is not available."
                );

                return;
            }

            window.location.href =
                "hotel.html?id=" +
                encodeURIComponent(
                    currentPlace.id
                );

        }
    );

}


    /* ---------------------------------------------
       RESTAURANT
    --------------------------------------------- */

    const restaurantBtn =
        document.getElementById(
        "restaurantBtn"
        );

    if (restaurantBtn) {

        restaurantBtn.addEventListener(
            "click",
            function () {

                if (!currentPlace || !currentPlace.id) {

                    alert(
                        "Tourist place information is not available."
                    );

                    return;
                }

                window.location.href =
                    "restaurant.html?id=" +
                    encodeURIComponent(
                        currentPlace.id
                    );

            }
        );

    }


    /* ---------------------------------------------
       METRO
    --------------------------------------------- */

    const metroBtn =
        document.getElementById(
            "metroBtn"
        );


    if (metroBtn) {

        metroBtn.addEventListener(
            "click",
            function () {

                if (
                    currentPlace.metroBookingUrl
                ) {

                    window.open(
                        currentPlace.metroBookingUrl,
                        "_blank",
                        "noopener,noreferrer"
                    );

                }

                else {

                    alert(
                        "Metro booking URL is not available yet."
                    );

                }

            }
        );

    }


    /* ---------------------------------------------
       CHAT
    --------------------------------------------- */

    const chatBtn =
        document.getElementById(
            "chatBtn"
        );


    if (chatBtn) {

        chatBtn.addEventListener(
            "click",
            function () {

                const placeId =
                    currentPlace && currentPlace.id
                        ? currentPlace.id
                        : "group";

                window.location.href =
                    "chat.html?place=" +
                    encodeURIComponent(placeId);

            }
        );

    }


    /* ---------------------------------------------
       JOIN CHAT
    --------------------------------------------- */

    const joinChatBtn =
        document.getElementById(
            "joinChatBtn"
        );


    if (joinChatBtn) {

        joinChatBtn.addEventListener(
            "click",
            joinChat
        );

    }


    /* ---------------------------------------------
       LIVE LOCATION
    --------------------------------------------- */

    const liveBtn =
        document.getElementById(
            "liveBtn"
        );


    if (liveBtn) {

        liveBtn.addEventListener(
            "click",
            function () {

                if (!currentPlace) {
                    return;
                }


                window.location.href =
                    "chat.html?place=" +
                    encodeURIComponent(
                        currentPlace.id
                    ) +
                    "&openMap=1";

            }
        );

    }

}


/* =====================================================
   JOIN CHAT
===================================================== */

function joinChat() {

    const input =
        document.getElementById(
            "nameInput"
        );


    if (!input) {

        alert(
            "Name input was not found."
        );

        return;

    }


    const name =
        input.value.trim();


    if (!name) {

        alert(
            "Please enter your name."
        );

        return;

    }


    sessionStorage.setItem(
        "chatName",
        name
    );


    sessionStorage.setItem(
        "chatPlace",
        currentPlace.id
    );


    window.location.href =
        "chat.html?place=" +
        encodeURIComponent(
            currentPlace.id
        );

}


/* =====================================================
   OPEN TOURIST PLACE IN GOOGLE MAPS
===================================================== */

function openPlaceInGoogleMaps() {

    if (!currentPlace) {

        alert(
            "Place information is still loading."
        );

        return;

    }


    const coordinates =
        getPlaceCoordinates();


    /* ---------------------------------------------
       USE COORDINATES
    --------------------------------------------- */

    if (coordinates) {

        const url =
            "https://www.google.com/maps/search/?api=1" +
            "&query=" +
            encodeURIComponent(
                coordinates.latitude +
                "," +
                coordinates.longitude
            );


        window.open(
            url,
            "_blank",
            "noopener,noreferrer"
        );


        return;

    }

    


    /* ---------------------------------------------
       GOOGLE MAPS URL
    --------------------------------------------- */

    if (
        currentPlace.googleMaps
    ) {

        window.open(
            currentPlace.googleMaps,
            "_blank",
            "noopener,noreferrer"
        );


        return;

    }


    /* ---------------------------------------------
       LOCATION URL
    --------------------------------------------- */

    if (
        currentPlace.location
    ) {

        window.open(
            currentPlace.location,
            "_blank",
            "noopener,noreferrer"
        );


        return;

    }


    alert(
        "Tourist place location is not available yet."
    );

}


/* =====================================================
   MY LOCATION
   GOOGLE MAPS:
   
   MY LOCATION
        ↓
   CURRENT TOURIST PLACE

   IMPORTANT:
   এখানে origin পাঠানো হচ্ছে না।

   Google Maps নিজেই user's
   current location ব্যবহার করবে.
===================================================== */

function getMyLocationAndRoute() {

    if (!currentPlace) {

        alert(
            "Place information is still loading."
        );

        return;

    }


    /* ---------------------------------------------
       CHECK BROWSER SUPPORT
    --------------------------------------------- */

    if (!navigator.geolocation) {

        alert(
            "Your browser does not support location."
        );

        return;

    }


    /* ---------------------------------------------
       CHECK DESTINATION
    --------------------------------------------- */

    const destination =
        getPlaceCoordinates();


    if (!destination) {

        alert(
            "Tourist place coordinates are not available yet."
        );

        return;

    }


    /* ---------------------------------------------
       BUTTON
    --------------------------------------------- */

    const button =
        document.getElementById(
            "distanceBtn"
        );


    if (button) {

        button.disabled = true;

        button.innerHTML =
            "📍 Opening Google Maps...";

    }


    /* ---------------------------------------------
       OPTIONAL:
       GET GPS PERMISSION FIRST

       We only use this to make sure the
       browser has location permission.

       We DO NOT put these coordinates
       into the Google Maps origin.
    --------------------------------------------- */

    navigator.geolocation.getCurrentPosition(

        function (position) {

            const userLat =
                position.coords.latitude;


            const userLng =
                position.coords.longitude;


            const accuracy =
                position.coords.accuracy;


            console.log(
                "MY LOCATION LAT:",
                userLat
            );


            console.log(
                "MY LOCATION LNG:",
                userLng
            );


            console.log(
                "GPS ACCURACY:",
                accuracy,
                "meters"
            );


            /* -----------------------------------------
               SAVE USER LOCATION
            ----------------------------------------- */

            sessionStorage.setItem(
                "userLat",
                String(userLat)
            );


            sessionStorage.setItem(
                "userLng",
                String(userLng)
            );


            sessionStorage.setItem(
                "userAccuracy",
                String(accuracy)
            );


            /* -----------------------------------------
               DESTINATION

               IMPORTANT:
               NAME পাঠানো হচ্ছে যাতে Google Maps
               "Victoria Memorial" দেখায়।

               Example:
               My Location → Victoria Memorial
            ----------------------------------------- */

            const destinationName =
                currentPlace.name;


            /* -----------------------------------------
               GOOGLE MAPS DIRECTIONS URL

               IMPORTANT:
               এখানে কোনো origin নেই।

               Google Maps:
               My Location → Tourist Place
            ----------------------------------------- */

            const routeURL =
                "https://www.google.com/maps/dir/?api=1" +
                "&destination=" +
                encodeURIComponent(
                    destinationName
                ) +
                "&travelmode=driving";


            console.log(
                "GOOGLE MAPS ROUTE:",
                routeURL
            );


            /* -----------------------------------------
               OPEN GOOGLE MAPS
            ----------------------------------------- */

            window.open(
                routeURL,
                "_blank"
            );


            /* -----------------------------------------
               RESET BUTTON
            ----------------------------------------- */

            if (button) {

                button.disabled = false;

                button.innerHTML =
                    "📍 My Location";

            }

        },


        /* ---------------------------------------------
           GPS ERROR
        --------------------------------------------- */

        function (error) {

            console.error(
                "GPS ERROR:",
                error
            );


            if (button) {

                button.disabled = false;

                button.innerHTML =
                    "📍 My Location";

            }


            if (error.code === 1) {

                alert(
                    "Location permission denied.\n\n" +
                    "Chrome-এ Location → Allow করে আবার চেষ্টা করো."
                );

            }

            else if (error.code === 2) {

                alert(
                    "Current location পাওয়া যাচ্ছে না.\n\n" +
                    "Windows Location Services ON করো."
                );

            }

            else if (error.code === 3) {

                alert(
                    "GPS location পেতে সময় বেশি লাগছে.\n\n" +
                    "আবার চেষ্টা করো."
                );

            }

            else {

                alert(
                    "Could not get your current location."
                );

            }

        },


        /* ---------------------------------------------
           GPS OPTIONS
        --------------------------------------------- */

        {
            enableHighAccuracy: true,
            timeout: 30000,
            maximumAge: 0
        }

    );

}


/* =====================================================
   SHARE
===================================================== */

async function sharePlace() {

    if (!currentPlace) {
        return;
    }


    const url =
        window.location.href;


    /* ---------------------------------------------
       NATIVE SHARE
    --------------------------------------------- */

    if (
        navigator.share
    ) {

        try {

            await navigator.share({

                title:
                    currentPlace.name,

                text:
                    "Explore " +
                    currentPlace.name,

                url:
                    url

            });

        }

        catch (error) {

            console.log(
                "Share cancelled:",
                error
            );

        }


        return;

    }


    /* ---------------------------------------------
       CLIPBOARD
    --------------------------------------------- */

    if (
        navigator.clipboard &&
        navigator.clipboard.writeText
    ) {

        try {

            await navigator.clipboard.writeText(
                url
            );


            alert(
                "Place link copied."
            );

        }

        catch (error) {

            console.error(
                error
            );


            alert(
                "Could not copy place link."
            );

        }


        return;

    }


    alert(
        "Sharing is not supported in this browser."
    );

}


/* =====================================================
   THEME
===================================================== */

function setupTheme() {

    const themeBtn =
        document.getElementById(
            "themeBtn"
        );


    if (!themeBtn) {
        return;
    }


    themeBtn.addEventListener(
        "click",
        function () {

            document.body.classList.toggle(
                "light"
            );


            const theme =
                document.body.classList.contains(
                    "light"
                )
                    ? "light"
                    : "dark";


            localStorage.setItem(
                "theme",
                theme
            );

        }
    );


    if (
        localStorage.getItem(
            "theme"
        ) === "light"
    ) {

        document.body.classList.add(
            "light"
        );

    }

}


/* =====================================================
   START
===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        setupTheme();

        loadPlace();

    }
);


/* =====================================================
   GLOBAL FUNCTIONS
===================================================== */

window.getMyLocationAndRoute =
    getMyLocationAndRoute;


window.openPlaceInGoogleMaps =
    openPlaceInGoogleMaps;


window.sharePlace =
    sharePlace;


window.getPlaceCoordinates =
    getPlaceCoordinates;
