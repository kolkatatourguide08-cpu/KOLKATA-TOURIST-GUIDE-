/* =========================================================
   KOLKATA TOURIST GUIDE
   RESTAURANT.JS — FINAL VERSION
   =========================================================

   Supported URL examples:

   restaurant.html?id=victoria-memorial
   restaurant.html?id=victoria-memorial&restaurant=REST-VICTORIA-MEMORIAL-001

   The second format opens a specific restaurant.

   Data structure expected:

   place.restaurants = [
      {
         restaurantId: "...",
         name: "...",
         image: "...",
         menu: [...]
      }
   ]

   ========================================================= */

(() => {
  "use strict";

  /* =========================================================
     CONFIG
     ========================================================= */

  const DATA_URL = "./places.json";

  // If your backend has a restaurant API, this can be used.
  // The script automatically falls back to places.json if API fails.
  const API_BASE = "/api";

  /* =========================================================
     DOM HELPERS
     ========================================================= */

  const $ = (selector, parent = document) =>
    parent.querySelector(selector);

  const $$ = (selector, parent = document) =>
    Array.from(parent.querySelectorAll(selector));

  /* =========================================================
     URL PARAMETERS
     ========================================================= */

  const params = new URLSearchParams(window.location.search);

  const placeId =
    params.get("id") ||
    params.get("place") ||
    params.get("placeId") ||
    "";

  const restaurantId =
    params.get("restaurant") ||
    params.get("restaurantId") ||
    params.get("rid") ||
    "";

  /* =========================================================
     STATE
     ========================================================= */

  let placesData = [];
  let currentPlace = null;
  let currentRestaurant = null;

  /* =========================================================
     TEXT / HTML SAFETY
     ========================================================= */

  function escapeHTML(value) {
    if (value === null || value === undefined) return "";

    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function safeUrl(url) {
    if (!url) return "";

    try {
      const parsed = new URL(url, window.location.href);

      if (
        parsed.protocol === "http:" ||
        parsed.protocol === "https:"
      ) {
        return parsed.href;
      }

      return "";
    } catch {
      return "";
    }
  }

  /* =========================================================
     IMAGE FALLBACK
     ========================================================= */

  const DEFAULT_RESTAURANT_IMAGE =
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=85";

  const DEFAULT_FOOD_IMAGE =
    "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=800&q=85";

  function getRestaurantImage(restaurant) {
    if (!restaurant) return DEFAULT_RESTAURANT_IMAGE;

    const candidates = [
      restaurant.image,
      restaurant.photo,
      restaurant.photo1,
      restaurant.images?.[0],
      restaurant.gallery?.[0]
    ];

    for (const image of candidates) {
      const url = safeUrl(image);

      if (url) return url;
    }

    return DEFAULT_RESTAURANT_IMAGE;
  }

  function getFoodImage(food) {
    if (!food) return DEFAULT_FOOD_IMAGE;

    const candidates = [
      food.image,
      food.photo,
      food.photo1
    ];

    for (const image of candidates) {
      const url = safeUrl(image);

      if (url) return url;
    }

    return DEFAULT_FOOD_IMAGE;
  }

  /* =========================================================
     NORMALIZE ARRAY
     ========================================================= */

  function asArray(value) {
    if (Array.isArray(value)) return value;

    if (!value) return [];

    return [value];
  }

  /* =========================================================
     NORMALIZE PLACE ID
     ========================================================= */

  function normalizeId(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");
  }

  /* =========================================================
     LOAD JSON
     ========================================================= */

  async function loadPlacesJSON() {
    /*
       On a real Node/Express server, /api/places reads the latest
       saved split JSON files. On GitHub Pages, github-pages.js
       supplies the static compatibility data + local overrides.
    */
    try {
      const apiResponse = await fetch(`${API_BASE}/places`, {
        cache: "no-store"
      });

      if (apiResponse.ok) {
        const apiData = await apiResponse.json();
        if (Array.isArray(apiData)) return apiData;
        if (Array.isArray(apiData.places)) return apiData.places;
      }
    } catch (_) {
      // Static/GitHub Pages: fall through to places.json.
    }

    const response = await fetch(DATA_URL, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(
        `Unable to load ${DATA_URL} (${response.status})`
      );
    }

    const data = await response.json();

    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data.places)) {
      return data.places;
    }

    throw new Error("Invalid places.json structure.");
  }

  /* =========================================================
     OPTIONAL API LOAD
     ========================================================= */

  async function loadRestaurantFromAPI(id) {
    if (!id) return null;

    try {
      const response = await fetch(
        `${API_BASE}/restaurants/${encodeURIComponent(id)}`,
        {
          cache: "no-store"
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();

      if (data && data.restaurant) {
        return data.restaurant;
      }

      if (data && data.restaurantId) {
        return data;
      }

      return null;
    } catch {
      return null;
    }
  }

  /* =========================================================
     FIND PLACE
     ========================================================= */

  function findPlace(data, id) {
    if (!id) return null;

    const target = normalizeId(id);

    return (
      data.find((place) => {
        const possibleIds = [
          place.id,
          place.placeId,
          place.slug,
          place.name
        ];

        return possibleIds.some(
          (value) => normalizeId(value) === target
        );
      }) || null
    );
  }

  /* =========================================================
     GET RESTAURANTS
     ========================================================= */

  function getRestaurants(place) {
    if (!place) return [];

    return asArray(place.restaurants).filter(Boolean);
  }

  /* =========================================================
     FIND RESTAURANT
     ========================================================= */

  function findRestaurant(restaurants, id) {
    if (!restaurants.length) return null;

    /*
      If restaurant ID was supplied,
      match ONLY the exact restaurantId.
    */

    if (id) {
      const target = String(id).trim().toLowerCase();

      const found = restaurants.find((restaurant) => {
        const rid = String(
          restaurant.restaurantId ||
          restaurant.RestaurantId ||
          restaurant["Restaurant ID"] ||
          restaurant.id ||
          ""
        )
          .trim()
          .toLowerCase();

        return rid === target;
      });

      return found || null;
    }

    /*
      No restaurant ID:
      open the first restaurant.
    */

    return restaurants[0];
  }

  /* =========================================================
     GET RESTAURANT ID
     ========================================================= */

  function getRestaurantId(restaurant) {
    if (!restaurant) return "";

    return (
      restaurant.restaurantId ||
      restaurant.RestaurantId ||
      restaurant["Restaurant ID"] ||
      restaurant.id ||
      ""
    );
  }

  /* =========================================================
     PAGE TITLE
     ========================================================= */

  function updatePageTitle() {
    if (!currentRestaurant) return;

    const name =
      currentRestaurant.name ||
      "Restaurant";

    document.title =
      `${name} | Kolkata Tourist Guide`;
  }

  /* =========================================================
     FIND COMMON ELEMENTS
     ========================================================= */

  function findElementByIds(ids) {
    for (const id of ids) {
      const element = document.getElementById(id);

      if (element) return element;
    }

    return null;
  }

  /* =========================================================
     RENDER MAIN RESTAURANT IMAGE
     ========================================================= */

  function renderMainImage() {
    if (!currentRestaurant) return;

    const imageUrl =
      getRestaurantImage(currentRestaurant);

    const imageElements = [
      findElementByIds([
        "restaurantImage",
        "restaurantMainImage",
        "mainRestaurantImage",
        "heroRestaurantImage"
      ])
    ].filter(Boolean);

    imageElements.forEach((img) => {
      if (img.tagName === "IMG") {
        img.src = imageUrl;
        img.alt =
          currentRestaurant.name ||
          "Restaurant";
      } else {
        img.style.backgroundImage =
          `url("${imageUrl}")`;
      }
    });

    /*
      Also support common image selectors
      if your HTML uses classes.
    */

    $$(".restaurant-main-image").forEach((element) => {
      if (element.tagName === "IMG") {
        element.src = imageUrl;
        element.alt =
          currentRestaurant.name ||
          "Restaurant";
      } else {
        element.style.backgroundImage =
          `url("${imageUrl}")`;
      }
    });

    $$(".restaurant-hero-image").forEach((element) => {
      if (element.tagName === "IMG") {
        element.src = imageUrl;
        element.alt =
          currentRestaurant.name ||
          "Restaurant";
      }
    });
  }

  /* =========================================================
     RENDER BASIC INFORMATION
     ========================================================= */

  function setText(ids, value) {
    const text =
      value === null ||
      value === undefined ||
      value === ""
        ? "Not available"
        : value;

    const element = findElementByIds(ids);

    if (element) {
      element.textContent = text;
    }
  }

  function renderBasicInfo() {
    if (!currentRestaurant) return;

    const r = currentRestaurant;

    setText(
      [
        "restaurantName",
        "restaurantTitle",
        "title"
      ],
      r.name || "Restaurant"
    );

    setText(
      [
        "restaurantDescription",
        "description"
      ],
      r.description || "Restaurant information unavailable."
    );

    setText(
      [
        "restaurantLocation",
        "location",
        "restaurantAddress",
        "address"
      ],
      r.location || r.address || "Location unavailable"
    );

    setText(
      [
        "restaurantPhone",
        "contactNumber",
        "phone"
      ],
      r.contactNumber || r.phone || "Not available"
    );

    setText(
      [
        "restaurantCuisine",
        "cuisine"
      ],
      r.cuisine || "Not specified"
    );

    setText(
      [
        "restaurantRating",
        "rating"
      ],
      r.rating || "Not rated"
    );

    setText(
      [
        "restaurantReviews",
        "reviews"
      ],
      r.reviews || "No reviews"
    );

    setText(
      [
        "restaurantPrice",
        "price"
      ],
      r.price || "Price unavailable"
    );

    setText(
      [
        "restaurantPriceUnit",
        "priceUnit"
      ],
      r.priceUnit || ""
    );

    setText(
      [
        "restaurantOpeningTime",
        "openingTime"
      ],
      r.openingTime || "Not available"
    );

    setText(
      [
        "restaurantClosingTime",
        "closingTime"
      ],
      r.closingTime || "Not available"
    );

    setText(
      [
        "restaurantAverageCost",
        "averageCost"
      ],
      r.averageCost || "Not available"
    );

    setText(
      [
        "restaurantHotel",
        "hotel"
      ],
      r.hotel || "Independent Restaurant"
    );

    setText(
      [
        "restaurantId",
        "restaurantID",
        "editRestaurantId"
      ],
      getRestaurantId(r) || "Not available"
    );
  }

  /* =========================================================
     RENDER LINKS
     ========================================================= */

  function setLink(ids, url, text) {
    const element = findElementByIds(ids);

    if (!element) return;

    const safe = safeUrl(url);

    if (!safe) {
      element.style.display = "none";
      return;
    }

    element.href = safe;

    if (text) {
      element.textContent = text;
    }

    element.target = "_blank";
    element.rel = "noopener noreferrer";

    element.style.display = "";
  }

  function renderLinks() {
    if (!currentRestaurant) return;

    const r = currentRestaurant;

    setLink(
      [
        "restaurantWebsite",
        "officialWebsite",
        "websiteLink"
      ],
      r.website ||
        r.officialWebsite ||
        r.websiteUrl,
      "Official Website"
    );

    setLink(
      [
        "googleMaps",
        "googleMapsLink",
        "mapsLink"
      ],
      r.googleMaps ||
        r.mapsLink ||
        r.googleMapsUrl,
      "Open in Google Maps"
    );

    setLink(
      [
        "bookingLink",
        "restaurantBookingLink"
      ],
      r.bookingLink,
      "Book a Table"
    );

    const phone =
      r.contactNumber ||
      r.phone ||
      "";

    const phoneElement =
      findElementByIds([
        "restaurantPhoneLink",
        "callRestaurant"
      ]);

    if (phoneElement && phone) {
      phoneElement.href =
        `tel:${phone.replace(/\s+/g, "")}`;

      phoneElement.style.display = "";
    }
  }

  /* =========================================================
     RENDER FACILITIES
     ========================================================= */

  function renderFacilities() {
    if (!currentRestaurant) return;

    const container =
      findElementByIds([
        "facilitiesList",
        "restaurantFacilities",
        "facilityList"
      ]);

    if (!container) return;

    const facilities =
      asArray(currentRestaurant.facilities);

    if (!facilities.length) {
      container.innerHTML =
        `<div class="empty-state">No facilities listed.</div>`;
      return;
    }

    container.innerHTML = facilities
      .map(
        (facility) => `
          <span class="facility-item">
            ${escapeHTML(facility)}
          </span>
        `
      )
      .join("");
  }

  /* =========================================================
     RENDER MENU
     ========================================================= */

  function renderMenu() {
    if (!currentRestaurant) return;

    const container =
      findElementByIds([
        "menuList",
        "restaurantMenu",
        "foodMenu",
        "menuContainer"
      ]);

    if (!container) return;

    const menu =
      asArray(currentRestaurant.menu);

    if (!menu.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div>No menu items available.</div>
        </div>
      `;

      return;
    }

    container.innerHTML = menu
      .map((food, index) => {
        const image =
          getFoodImage(food);

        return `
          <article
            class="menu-card"
            data-menu-index="${index}"
          >

            <div class="menu-image-wrap">
              <img
                src="${escapeHTML(image)}"
                alt="${escapeHTML(
                  food.name || "Food"
                )}"
                class="menu-image"
                loading="lazy"
                onerror="this.src='${DEFAULT_FOOD_IMAGE}'"
              >
            </div>

            <div class="menu-content">

              <div class="menu-top">

                <h3 class="menu-name">
                  ${escapeHTML(
                    food.name ||
                    "Menu Item"
                  )}
                </h3>

                ${
                  food.type
                    ? `
                      <span class="menu-type">
                        ${escapeHTML(food.type)}
                      </span>
                    `
                    : ""
                }

              </div>

              ${
                food.price
                  ? `
                    <div class="menu-price">
                      ${escapeHTML(food.price)}
                    </div>
                  `
                  : ""
              }

              ${
                food.description
                  ? `
                    <p class="menu-description">
                      ${escapeHTML(
                        food.description
                      )}
                    </p>
                  `
                  : ""
              }

            </div>

          </article>
        `;
      })
      .join("");
  }

  /* =========================================================
     RENDER RESTAURANT SELECTOR
     ========================================================= */

  function renderRestaurantSelector() {
    if (!currentPlace) return;

    const restaurants =
      getRestaurants(currentPlace);

    const container =
      findElementByIds([
        "restaurantList",
        "restaurantsList",
        "restaurantSelector",
        "nearbyRestaurants"
      ]);

    if (!container) return;

    /*
      If there is only one restaurant,
      still render it normally.
    */

    container.innerHTML = restaurants
      .map((restaurant) => {
        const id =
          getRestaurantId(restaurant);

        const image =
          getRestaurantImage(restaurant);

        const active =
          currentRestaurant &&
          getRestaurantId(
            currentRestaurant
          ) === id;

        const newUrl =
          `restaurant.html?id=${encodeURIComponent(
            currentPlace.id || placeId
          )}&restaurant=${encodeURIComponent(
            id
          )}`;

        return `
          <a
            class="restaurant-selector-card ${
              active ? "active" : ""
            }"
            href="${escapeHTML(newUrl)}"
          >

            <img
              src="${escapeHTML(image)}"
              alt="${escapeHTML(
                restaurant.name ||
                "Restaurant"
              )}"
              loading="lazy"
              onerror="this.src='${DEFAULT_RESTAURANT_IMAGE}'"
            >

            <div class="restaurant-selector-content">

              <h3>
                ${escapeHTML(
                  restaurant.name ||
                  "Restaurant"
                )}
              </h3>

              ${
                restaurant.cuisine
                  ? `
                    <p>
                      ${escapeHTML(
                        restaurant.cuisine
                      )}
                    </p>
                  `
                  : ""
              }

              ${
                restaurant.rating
                  ? `
                    <span>
                      ★ ${escapeHTML(
                        restaurant.rating
                      )}
                    </span>
                  `
                  : ""
              }

            </div>

          </a>
        `;
      })
      .join("");
  }

  /* =========================================================
     UPDATE RESTAURANT COUNT
     ========================================================= */

  function renderRestaurantCount() {
    if (!currentPlace) return;

    const count =
      getRestaurants(currentPlace).length;

    const elements = [
      findElementByIds([
        "restaurantCount",
        "restaurantsCount"
      ])
    ].filter(Boolean);

    elements.forEach((element) => {
      element.textContent =
        `${count} Restaurant${count === 1 ? "" : "s"}`;
    });
  }

  /* =========================================================
     PLACE INFORMATION
     ========================================================= */

  function renderPlaceInfo() {
    if (!currentPlace) return;

    setText(
      [
        "placeName",
        "restaurantPlaceName",
        "placeTitle"
      ],
      currentPlace.name || "Kolkata"
    );
  }

  /* =========================================================
     EDIT BUTTON
     ========================================================= */

  function setupEditButton() {
    if (!currentRestaurant) return;

    const id =
      getRestaurantId(currentRestaurant);

    if (!id) return;

    const editElements = [
      ...$$(
        "#editRestaurant, #restaurantEdit, #editButton"
      ),
      ...$$(".edit-restaurant")
    ];

    editElements.forEach((button) => {
      const url =
        `edit.html?type=restaurant` +
        `&placeId=${encodeURIComponent(
          currentPlace?.id || placeId
        )}` +
        `&restaurantId=${encodeURIComponent(id)}`;

      /*
        If button is an <a>
      */

      if (button.tagName === "A") {
        button.href = url;
      } else {
        button.addEventListener(
          "click",
          () => {
            window.location.href = url;
          }
        );
      }
    });
  }

  /* =========================================================
     BREADCRUMB
     ========================================================= */

  function renderBreadcrumb() {
    const breadcrumb =
      findElementByIds([
        "breadcrumb",
        "restaurantBreadcrumb"
      ]);

    if (!breadcrumb) return;

    const placeName =
      currentPlace?.name ||
      "Place";

    const restaurantName =
      currentRestaurant?.name ||
      "Restaurant";

    breadcrumb.innerHTML = `
      <span>
        ${escapeHTML(placeName)}
      </span>

      <span class="breadcrumb-separator">
        /
      </span>

      <span>
        ${escapeHTML(restaurantName)}
      </span>
    `;
  }

  /* =========================================================
     ERROR UI
     ========================================================= */

  function showError(title, message) {
    const existing =
      findElementByIds([
        "restaurantPage",
        "restaurantContainer",
        "restaurantContent",
        "mainContent"
      ]);

    const target =
      existing ||
      document.body;

    target.innerHTML = `
      <section class="restaurant-error">

        <div class="restaurant-error-icon">
          🍽️
        </div>

        <h1>
          ${escapeHTML(title)}
        </h1>

        <p>
          ${escapeHTML(message)}
        </p>

        <div class="restaurant-error-actions">

          <button
            type="button"
            id="restaurantBackButton"
          >
            ← Go Back
          </button>

          <button
            type="button"
            id="restaurantHomeButton"
          >
            Home
          </button>

        </div>

      </section>
    `;

    const back =
      $("#restaurantBackButton");

    if (back) {
      back.addEventListener(
        "click",
        () => {
          window.history.back();
        }
      );
    }

    const home =
      $("#restaurantHomeButton");

    if (home) {
      home.addEventListener(
        "click",
        () => {
          window.location.href =
            "index.html";
        }
      );
    }
  }

  /* =========================================================
     LOADING UI
     ========================================================= */

  function showLoading() {
    const loader =
      findElementByIds([
        "restaurantLoading",
        "loading",
        "pageLoading"
      ]);

    if (loader) {
      loader.style.display = "";
    }
  }

  function hideLoading() {
    const loader =
      findElementByIds([
        "restaurantLoading",
        "loading",
        "pageLoading"
      ]);

    if (loader) {
      loader.style.display = "none";
    }
  }

  /* =========================================================
     INITIAL RENDER
     ========================================================= */

  function renderAll() {
    renderMainImage();
    renderBasicInfo();
    renderLinks();
    renderFacilities();
    renderMenu();
    renderRestaurantSelector();
    renderRestaurantCount();
    renderPlaceInfo();
    renderBreadcrumb();
    setupEditButton();
    updatePageTitle();
  }

  /* =========================================================
     MAIN INITIALIZATION
     ========================================================= */

  async function initRestaurantPage() {
    showLoading();

    try {
      /*
        -----------------------------------------------
        STEP 1
        Load places.json
        -----------------------------------------------
      */

      placesData =
        await loadPlacesJSON();

      /*
        -----------------------------------------------
        STEP 2
        Find Place
        -----------------------------------------------
      */

      currentPlace =
        findPlace(
          placesData,
          placeId
        );

      if (!currentPlace) {
        hideLoading();

        showError(
          "Place Not Found",
          `We couldn't find the place "${placeId}".`
        );

        return;
      }

      /*
        -----------------------------------------------
        STEP 3
        Get all restaurants
        -----------------------------------------------
      */

      const restaurants =
        getRestaurants(
          currentPlace
        );

      if (!restaurants.length) {
        hideLoading();

        showError(
          "No Restaurants Found",
          `No restaurants have been added for ${currentPlace.name || "this place"} yet.`
        );

        return;
      }

      /*
        -----------------------------------------------
        STEP 4
        Find selected restaurant
        -----------------------------------------------
      */

      currentRestaurant =
        findRestaurant(
          restaurants,
          restaurantId
        );

      /*
        -----------------------------------------------
        STEP 5
        If URL contains invalid Restaurant ID
        -----------------------------------------------
      */

      if (
        restaurantId &&
        !currentRestaurant
      ) {
        hideLoading();

        showError(
          "Restaurant Not Found",
          `The restaurant ID "${restaurantId}" does not belong to ${currentPlace.name || "this place"}.`
        );

        return;
      }

      /*
        -----------------------------------------------
        STEP 6
        Optional backend refresh
        -----------------------------------------------

        If a backend restaurant record exists,
        use it instead of static data.
      */

      if (restaurantId) {
        const apiRestaurant =
          await loadRestaurantFromAPI(
            restaurantId
          );

        if (apiRestaurant) {
          /*
            Keep important Place information
            if API doesn't contain it.
          */

          currentRestaurant = {
            ...currentRestaurant,
            ...apiRestaurant
          };
        }
      }

      /*
        -----------------------------------------------
        STEP 7
        Render everything
        -----------------------------------------------
      */

      renderAll();

      hideLoading();

    } catch (error) {
      console.error(
        "Restaurant page error:",
        error
      );

      hideLoading();

      showError(
        "Restaurant Data Error",
        "Restaurant information could not be loaded. Please check your places.json file and try again."
      );
    }
  }

  /* =========================================================
     DOM READY
     ========================================================= */

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initRestaurantPage
    );
  } else {
    initRestaurantPage();
  }

  /* =========================================================
     PUBLIC ACCESS
     ========================================================= */

  window.KTGRestaurant = {
    getCurrentPlace: () =>
      currentPlace,

    getCurrentRestaurant: () =>
      currentRestaurant,

    getAllRestaurants: () =>
      currentPlace
        ? getRestaurants(currentPlace)
        : [],

    reload: initRestaurantPage
  };

})();

/* =========================================================
   KOLKATA TOURIST GUIDE
   RESTAURANT PAGE - FINAL VERSION
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    loadRestaurantPage();
});


/* =========================================================
   MAIN
   ========================================================= */

async function loadRestaurantPage() {

    const params = new URLSearchParams(window.location.search);

    const placeId =
        params.get("id") ||
        params.get("place") ||
        params.get("placeId");

    const restaurantId =
        params.get("restaurantId") ||
        params.get("restaurant");

    if (!placeId) {
        showError("Place ID পাওয়া যায়নি।");
        return;
    }

    try {

        // -------------------------------------------------
        // Load the current split data safely.
        // First try the old combined file, then fall back
        // to places-1.json ... places-10.json.
        // -------------------------------------------------

        const places = await loadRestaurantPlacesData();

        if (!Array.isArray(places)) {
            throw new Error("Restaurant data must be an array.");
        }

        // -------------------------------------------------
        // Find requested place
        // -------------------------------------------------

        const requested = String(placeId).trim().toLowerCase();

        const place = places.find(item => {
            if (!item || typeof item !== "object") return false;

            return [
                item.id,
                item.placeId,
                item.slug,
                item.name
            ].some(value =>
                String(value || "").trim().toLowerCase() === requested
            );
        });

        if (!place) {
            showError(`Place "${placeId}" পাওয়া যায়নি।`);
            return;
        }

        // -------------------------------------------------
        // Get restaurants
        // -------------------------------------------------

        let restaurants = Array.isArray(place.restaurants)
            ? place.restaurants.filter(
                r => r && typeof r === "object"
              )
            : [];

        if (!restaurants.length) {
            showNoRestaurants(place);
            return;
        }

        // -------------------------------------------------
        // Open one restaurant when an ID is supplied.
        // Otherwise show the restaurant list.
        // -------------------------------------------------

        if (restaurantId) {

            const requestedRestaurant =
                String(restaurantId).trim().toLowerCase();

            const selectedRestaurant = restaurants.find(r => {
                const ids = [
                    r.restaurantId,
                    r.RestaurantId,
                    r["Restaurant ID"],
                    r.id
                ];

                return ids.some(value =>
                    String(value || "").trim().toLowerCase() ===
                    requestedRestaurant
                );
            });

            if (!selectedRestaurant) {
                showError(
                    `Restaurant "${restaurantId}" পাওয়া যায়নি।`
                );
                return;
            }

            renderSingleRestaurant(
                place,
                selectedRestaurant
            );

            return;
        }

        renderRestaurantList(
            place,
            restaurants
        );

    } catch (error) {

        console.error("Restaurant loading error:", error);

        showError(
            "Restaurant information load করা যাচ্ছে না। " +
            "দয়া করে split places JSON files এবং server check করুন।"
        );
    }
}


/* =========================================================
   LOAD RESTAURANT DATA
   Supports both the old combined file and the current
   places-1.json ... places-10.json structure.
   ========================================================= */

async function loadRestaurantPlacesData() {

    const combinedCandidates = [
        "data/places.json",
        "./places.json"
    ];

    for (const url of combinedCandidates) {
        try {
            const response = await fetch(url, {
                cache: "no-store"
            });

            if (!response.ok) continue;

            const data = await response.json();

            if (Array.isArray(data)) {
                return data;
            }

            if (Array.isArray(data.places)) {
                return data.places;
            }
        } catch {
            // Try the split files below.
        }
    }

    const files = Array.from(
        { length: 10 },
        (_, index) => index + 1
    );

    const locations = [
        number => `data/places-${number}.json`,
        number => `./places-${number}.json`
    ];

    for (const makeUrl of locations) {

        const loaded = [];
        let successful = 0;

        for (const number of files) {

            try {
                const response = await fetch(
                    makeUrl(number),
                    { cache: "no-store" }
                );

                if (!response.ok) continue;

                const data = await response.json();
                const chunk = Array.isArray(data)
                    ? data
                    : Array.isArray(data.places)
                        ? data.places
                        : [];

                if (chunk.length) {
                    loaded.push(...chunk);
                    successful++;
                }
            } catch {
                // Keep trying the remaining chunks.
            }
        }

        if (successful > 0 && loaded.length > 0) {
            return loaded;
        }
    }

    throw new Error("No places JSON source could be loaded.");
}


/* =========================================================
   RESTAURANT LIST
   ========================================================= */

function renderRestaurantList(place, restaurants) {

    const app = getMainContainer();

    if (!app) {
        console.error("Restaurant page container not found.");
        return;
    }

    document.body.classList.remove("ktg-single-restaurant");
    document.body.classList.add("ktg-restaurant-list-mode");

    document.title =
        `${place.name} Restaurants | Kolkata Tourist Guide`;

    const heroImage =
        place.image ||
        getFirstRestaurantImage(restaurants) ||
        "https://images.pexels.com/photos/16569842/pexels-photo-16569842.jpeg";

    app.innerHTML = `

        <div class="ktg-restaurant-list-page">

            <!-- BIG RESTAURANT HERO -->
            <section
                class="ktg-restaurant-list-hero"
                style="--ktg-restaurant-hero-image: url('${escapeAttribute(heroImage)}');"
            >
                <div class="ktg-restaurant-hero-inner">

                    <div class="ktg-restaurant-location-pill">
                        <span>●</span>
                        Restaurants near ${escapeHTML(place.name)}
                    </div>

                    <h1>Restaurants</h1>

                    <p>
                        ${restaurants.length}
                        restaurant${restaurants.length === 1 ? "" : "s"}
                        available near ${escapeHTML(place.name)}
                    </p>

                </div>
            </section>


            <!-- BACK / HOME / DARK-LIGHT MODE -->
            <div class="ktg-restaurant-list-toolbar">

                <div class="ktg-restaurant-nav-actions">
                    <button
                        type="button"
                        class="ktg-list-back-btn"
                        onclick="goBack()"
                    >
                        ← Back
                    </button>

                    <a
                        class="ktg-list-home-btn"
                        href="index.html"
                    >
                        🏠 Home
                    </a>
                </div>

                <button
                    type="button"
                    id="ktgRestaurantThemeBtn"
                    class="ktg-list-theme-btn"
                    aria-label="Toggle dark and light mode"
                >
                    🌙 Dark Mode
                </button>

            </div>


            <!-- RESTAURANTS -->
            <main class="ktg-restaurant-list-container">

                <div class="ktg-restaurant-list-heading">
                    <div class="ktg-heading-icon">🍴</div>
                    <div>
                        <h2>
                            Restaurants near ${escapeHTML(place.name)}
                        </h2>
                        <p>
                            Choose a restaurant to view menu, facilities,
                            contact and other information.
                        </p>
                    </div>
                </div>

                <div class="ktg-restaurant-grid">
                    ${restaurants.map(
                        (restaurant, index) =>
                            createRestaurantCard(
                                place,
                                restaurant,
                                index
                            )
                    ).join("")}
                </div>

            </main>

        </div>
    `;

    setupRestaurantListTheme();
    injectRestaurantStyles();
}


/* =========================================================
   RESTAURANT LIST THEME
   ========================================================= */

function setupRestaurantListTheme() {

    const button =
        document.getElementById("ktgRestaurantThemeBtn");

    if (!button) return;

    const saved =
        localStorage.getItem("ktg_restaurant_theme");

    const apply = mode => {
        document.body.classList.toggle(
            "ktg-restaurant-light",
            mode === "light"
        );

        button.textContent =
            mode === "light"
                ? "🌙 Dark Mode"
                : "☀️ Light Mode";

        localStorage.setItem(
            "ktg_restaurant_theme",
            mode
        );
    };

    apply(saved === "light" ? "light" : "dark");

    button.addEventListener("click", () => {
        const isLight =
            document.body.classList.contains(
                "ktg-restaurant-light"
            );

        apply(isLight ? "dark" : "light");
    });
}


/* =========================================================
   SINGLE RESTAURANT
   ========================================================= */

function renderSingleRestaurant(place, restaurant) {

    document.body.classList.remove("ktg-restaurant-list-mode", "ktg-restaurant-light");
    document.body.classList.add("ktg-single-restaurant");

    const app = getMainContainer();

    if (!app) {
        console.error("Restaurant page container not found.");
        return;
    }

    const image =
        restaurant.image ||
        place.image ||
        "";

    const restaurantId =
        restaurant.restaurantId ||
        restaurant["Restaurant ID"] ||
        "";

    document.title =
        `${restaurant.name || "Restaurant"} | Kolkata Tourist Guide`;

    app.innerHTML = `

        <div class="restaurant-detail-page">

            <!-- HERO -->
            <section
                class="restaurant-detail-hero"
                style="
                    background-image:
                    linear-gradient(
                        rgba(0,0,0,.50),
                        rgba(0,0,0,.72)
                    ),
                    url('${escapeAttribute(image)}');
                "
            >

                <div class="restaurant-detail-content">

                    <div class="restaurant-small-badge">
                        🍽️ Restaurant
                    </div>

                    <h1>
                        ${escapeHTML(
                            restaurant.name ||
                            "Restaurant"
                        )}
                    </h1>

                    <p class="restaurant-description">
                        ${escapeHTML(
                            restaurant.description ||
                            "Restaurant information available in Kolkata Tourist Guide."
                        )}
                    </p>

                    ${
                        restaurant.rating
                            ? `
                                <div class="restaurant-rating">
                                    ⭐
                                    ${escapeHTML(
                                        restaurant.rating
                                    )}
                                </div>
                              `
                            : ""
                    }

                </div>

            </section>


            <!-- NAVIGATION -->
            <div class="restaurant-topbar">

                <button
                    class="restaurant-back-btn"
                    onclick="goBack()"
                >
                    ← Back
                </button>

                <a
                    class="restaurant-home-btn"
                    href="index.html"
                >
                    🏠 Home
                </a>

            </div>


            <!-- CONTENT -->
            <main class="restaurant-detail-container">

                <div class="restaurant-detail-grid">

                    <!-- LEFT -->
                    <div>

                        <div class="restaurant-info-card">

                            <h2>
                                🍴 Restaurant Information
                            </h2>

                            ${infoRow(
                                "📍 Location",
                                restaurant.location
                            )}

                            ${infoRow(
                                "🏨 Hotel",
                                restaurant.hotel
                            )}

                            ${infoRow(
                                "🍛 Cuisine",
                                restaurant.cuisine
                            )}

                            ${infoRow(
                                "⭐ Rating",
                                restaurant.rating
                            )}

                            ${infoRow(
                                "💰 Price",
                                restaurant.price
                            )}

                            ${infoRow(
                                "💳 Average Cost",
                                restaurant.averageCost
                            )}

                            ${infoRow(
                                "🕐 Opening Time",
                                restaurant.openingTime
                            )}

                            ${infoRow(
                                "🕚 Closing Time",
                                restaurant.closingTime
                            )}

                            ${infoRow(
                                "📞 Contact",
                                restaurant.contactNumber
                            )}

                        </div>


                        <!-- FACILITIES -->

                        ${
                            Array.isArray(
                                restaurant.facilities
                            ) &&
                            restaurant.facilities.length
                                ? `

                                    <div class="restaurant-info-card">

                                        <h2>
                                            ✨ Facilities
                                        </h2>

                                        <div class="facility-list">

                                            ${restaurant.facilities
                                                .map(
                                                    item => `
                                                        <span>
                                                            ✓
                                                            ${escapeHTML(
                                                                item
                                                            )}
                                                        </span>
                                                    `
                                                )
                                                .join("")}

                                        </div>

                                    </div>

                                  `
                                : ""
                        }


                        <!-- MENU -->

                        ${
                            Array.isArray(
                                restaurant.menu
                            ) &&
                            restaurant.menu.length
                                ? `

                                    <div class="restaurant-menu-card">

                                        <h2>
                                            🍽️ Menu
                                        </h2>

                                        <div class="menu-grid">

                                            ${restaurant.menu
                                                .map(
                                                    item =>
                                                        createMenuItem(
                                                            item
                                                        )
                                                )
                                                .join("")}

                                        </div>

                                    </div>

                                  `
                                : ""
                        }

                    </div>


                    <!-- RIGHT -->

                    <aside>

                        <div class="restaurant-action-card">

                            <h2>
                                📌 Quick Actions
                            </h2>

                            ${
                                restaurant.website
                                    ? `
                                        <a
                                            href="${escapeAttribute(
                                                restaurant.website
                                            )}"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            class="restaurant-action website"
                                        >
                                            🌐 Official Website
                                        </a>
                                      `
                                    : ""
                            }


                            ${
                                restaurant.contactNumber
                                    ? `
                                        <a
                                            href="tel:${escapeAttribute(
                                                restaurant.contactNumber
                                            )}"
                                            class="restaurant-action call"
                                        >
                                            📞 Call Restaurant
                                        </a>
                                      `
                                    : ""
                            }


                            <a
                                href="booking.html?type=restaurant&id=${encodeURIComponent(
                                    restaurantId
                                )}&placeId=${encodeURIComponent(place.id)}"
                                class="restaurant-action booking"
                            >
                                🍽️ Book Restaurant
                            </a>


                            <button
                                class="restaurant-action edit"
                                onclick="
                                    openRestaurantEdit(
                                        '${escapeAttribute(place.id)}',
                                        '${escapeAttribute(restaurantId)}'
                                    )
                                "
                            >
                                ✏️ Edit Restaurant
                            </button>

                        </div>


                        <!-- RESTAURANT ID -->

                        <div class="restaurant-id-card">

                            <span>
                                Restaurant ID
                            </span>

                            <strong>
                                ${escapeHTML(
                                    restaurantId ||
                                    "Not Assigned"
                                )}
                            </strong>

                        </div>


                        <!-- IMAGE -->

                        ${
                            image
                                ? `
                                    <div class="restaurant-image-card">

                                        <img
                                            src="${escapeAttribute(image)}"
                                            alt="${escapeAttribute(
                                                restaurant.name ||
                                                "Restaurant"
                                            )}"
                                            loading="lazy"
                                            onerror="
                                                this.style.display='none'
                                            "
                                        >

                                    </div>
                                  `
                                : ""
                        }

                    </aside>

                </div>

            </main>

        </div>
    `;

    injectRestaurantStyles();
}


/* =========================================================
   RESTAURANT CARD
   ========================================================= */

function createRestaurantCard(
    place,
    restaurant,
    index
) {

    const id =
        restaurant.restaurantId ||
        restaurant["Restaurant ID"] ||
        restaurant.id ||
        `restaurant-${index + 1}`;

    const image =
        restaurant.image ||
        place.image ||
        "";

    const name =
        restaurant.name ||
        `Restaurant ${index + 1}`;

    const description = Array.isArray(restaurant.description)
        ? restaurant.description.join(" ")
        : restaurant.description ||
          "A dining destination near this Kolkata attraction.";

    const location =
        restaurant.location ||
        restaurant.address ||
        "Kolkata";

    const hours =
        restaurant.openingTime
            ? `${restaurant.openingTime} – ${restaurant.closingTime || ""}`
            : restaurant.openingHours || "Hours available on restaurant page";

    return `

        <article class="ktg-restaurant-card">

            <div class="ktg-restaurant-card-image">

                ${
                    image
                        ? `
                            <img
                                src="${escapeAttribute(image)}"
                                alt="${escapeAttribute(name)}"
                                loading="lazy"
                                onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"
                            >
                            <div class="ktg-restaurant-image-fallback">
                                🍽️
                            </div>
                          `
                        : `
                            <div class="ktg-restaurant-image-fallback" style="display:flex;">
                                🍽️
                            </div>
                          `
                }

                ${
                    restaurant.rating !== undefined &&
                    restaurant.rating !== null &&
                    String(restaurant.rating).trim() !== ""
                        ? `
                            <span class="ktg-restaurant-rating">
                                ⭐ ${escapeHTML(restaurant.rating)}
                            </span>
                          `
                        : ""
                }

            </div>


            <div class="ktg-restaurant-card-body">

                <div class="ktg-restaurant-card-number">
                    Restaurant ${index + 1}
                </div>

                <h3>
                    ${escapeHTML(name)}
                </h3>

                <div class="ktg-restaurant-cuisine">
                    🍛 ${escapeHTML(
                        restaurant.cuisine || "Indian Cuisine"
                    )}
                </div>

                <p class="ktg-restaurant-description">
                    ${escapeHTML(description)}
                </p>

                <div class="ktg-restaurant-card-info">

                    <span>
                        📍 ${escapeHTML(location)}
                    </span>

                    <span>
                        💰 ${escapeHTML(
                            restaurant.price ||
                            restaurant.averageCost ||
                            "Price on request"
                        )}
                    </span>

                    <span>
                        🕐 ${escapeHTML(hours)}
                    </span>

                </div>

                <a
                    href="restaurant.html?id=${encodeURIComponent(
                        place.id
                    )}&restaurantId=${encodeURIComponent(id)}"
                    class="ktg-restaurant-view-btn"
                >
                    View Restaurant →
                </a>

            </div>

        </article>
    `;
}


/* =========================================================
   MENU ITEM
   ========================================================= */

function createMenuItem(item) {

    const image = item.image || "";

    return `

        <div class="menu-item">

            ${
                image
                    ? `
                        <img
                            src="${escapeAttribute(image)}"
                            alt="${escapeAttribute(
                                item.name || "Food"
                            )}"
                            loading="lazy"
                        >
                      `
                    : `
                        <div class="menu-no-image">
                            🍽️
                        </div>
                      `
            }

            <div class="menu-item-content">

                <h3>
                    ${escapeHTML(
                        item.name || "Menu Item"
                    )}
                </h3>

                ${
                    item.type
                        ? `
                            <span class="menu-type">
                                ${escapeHTML(item.type)}
                            </span>
                          `
                        : ""
                }

                ${
                    item.description
                        ? `
                            <p>
                                ${escapeHTML(
                                    item.description
                                )}
                            </p>
                          `
                        : ""
                }

                ${
                    item.price
                        ? `
                            <strong>
                                ${escapeHTML(item.price)}
                            </strong>
                          `
                        : ""
                }

            </div>

        </div>
    `;
}


/* =========================================================
   INFO ROW
   ========================================================= */

function infoRow(label, value) {

    if (
        value === undefined ||
        value === null ||
        String(value).trim() === ""
    ) {
        return "";
    }

    return `

        <div class="restaurant-info-row">

            <span class="restaurant-info-label">
                ${escapeHTML(label)}
            </span>

            <strong>
                ${escapeHTML(value)}
            </strong>

        </div>
    `;
}


/* =========================================================
   NO RESTAURANTS
   ========================================================= */

function showNoRestaurants(place) {

    const app = getMainContainer();

    if (!app) return;

    app.innerHTML = `

        <div class="restaurant-empty">

            <div class="restaurant-empty-icon">
                🍽️
            </div>

            <h1>
                No Restaurants Available
            </h1>

            <p>
                এখনো
                <strong>
                    ${escapeHTML(place.name)}
                </strong>
                এর জন্য কোনো restaurant যোগ করা হয়নি।
            </p>

            <a href="index.html">
                ← Back to Home
            </a>

        </div>
    `;

    injectRestaurantStyles();
}


/* =========================================================
   ERROR
   ========================================================= */

function showError(message) {

    const app = getMainContainer();

    if (!app) {
        alert(message);
        return;
    }

    app.innerHTML = `

        <div class="restaurant-error">

            <div class="restaurant-error-icon">
                ⚠️
            </div>

            <h1>
                Restaurant Data Error
            </h1>

            <p>
                ${escapeHTML(message)}
            </p>

            <div class="restaurant-error-actions">

                <button
                    onclick="location.reload()"
                >
                    🔄 Refresh
                </button>

                <a href="index.html">
                    🏠 Home
                </a>

            </div>

        </div>
    `;

    injectRestaurantStyles();
}


/* =========================================================
   FIND MAIN CONTAINER
   ========================================================= */

function getMainContainer() {

    return (
        document.getElementById("restaurantApp") ||
        document.getElementById("restaurant-page") ||
        document.getElementById("app") ||
        document.querySelector("main") ||
        document.body
    );
}


/* =========================================================
   FIRST RESTAURANT IMAGE
   ========================================================= */

function getFirstRestaurantImage(restaurants) {

    const restaurant = restaurants.find(
        r => r && r.image
    );

    return restaurant
        ? restaurant.image
        : "";
}


/* =========================================================
   EDIT
   ========================================================= */

function openRestaurantEdit(
    placeId,
    restaurantId
) {

    if (!restaurantId) {

        alert(
            "এই restaurant-এর কোনো Restaurant ID নেই।"
        );

        return;
    }

    // Use a relative URL so the edit page also works on
    // GitHub Pages projects hosted inside a repository path
    // such as /KTG/ instead of only at the domain root.
    window.location.href =
        `edit.html?type=restaurant` +
        `&placeId=${encodeURIComponent(placeId)}` +
        `&restaurantId=${encodeURIComponent(restaurantId)}`;
}


/* =========================================================
   BACK
   ========================================================= */

function goBack() {

    if (document.referrer) {
        history.back();
    } else {
        window.location.href =
            "/index.html";
    }
}


/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHTML(value) {

    if (
        value === undefined ||
        value === null
    ) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================================================
   ESCAPE ATTRIBUTE
   ========================================================= */

function escapeAttribute(value) {

    return escapeHTML(value);
}


/* =========================================================
   BASIC CSS
   ========================================================= */

function injectRestaurantStyles() {

    if (
        document.getElementById(
            "restaurant-js-styles"
        )
    ) {
        return;
    }

    const style =
        document.createElement("style");

    style.id =
        "restaurant-js-styles";

    style.textContent = `

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            font-family:
                Arial,
                "Noto Sans Bengali",
                sans-serif;
            background: #f5f6fa;
            color: #18191d;
        }

        .restaurant-page,
        .restaurant-detail-page {
            min-height: 100vh;
        }

        /* HERO */

        .restaurant-hero,
        .restaurant-detail-hero {
            min-height: 390px;
            background-size: cover;
            background-position: center;
            display: flex;
            align-items: flex-end;
            padding: 55px 7%;
            color: white;
        }

        .restaurant-hero-content,
        .restaurant-detail-content {
            max-width: 900px;
        }

        .restaurant-badge,
        .restaurant-small-badge {
            display: inline-block;
            background: rgba(255,255,255,.16);
            border: 1px solid rgba(255,255,255,.35);
            padding: 9px 16px;
            border-radius: 30px;
            margin-bottom: 15px;
            backdrop-filter: blur(8px);
        }

        .restaurant-hero h1,
        .restaurant-detail-hero h1 {
            font-size: clamp(38px, 6vw, 70px);
            margin: 0 0 10px;
            font-weight: 800;
        }

        .restaurant-hero p,
        .restaurant-detail-hero p {
            font-size: 18px;
            line-height: 1.6;
            margin: 0;
        }

        .restaurant-rating {
            margin-top: 18px;
            font-size: 20px;
        }

        /* TOP BAR */

        .restaurant-topbar {
            display: flex;
            gap: 10px;
            align-items: center;
            padding: 12px 7%;
            background: white;
            border-bottom: 1px solid #ddd;
        }

        .restaurant-back-btn,
        .restaurant-home-btn {
            border: 0;
            border-radius: 9px;
            padding: 11px 18px;
            font-size: 15px;
            cursor: pointer;
            text-decoration: none;
        }

        .restaurant-back-btn {
            background: #18191d;
            color: white;
        }

        .restaurant-home-btn {
            background: #e9edf5;
            color: #18191d;
        }

        /* CONTAINER */

        .restaurant-container,
        .restaurant-detail-container {
            width: min(1250px, 92%);
            margin: 40px auto;
        }

        .restaurant-section-title {
            display: flex;
            gap: 15px;
            align-items: center;
            margin-bottom: 25px;
        }

        .restaurant-section-title > span {
            font-size: 40px;
        }

        .restaurant-section-title h2 {
            margin: 0;
            font-size: 30px;
        }

        .restaurant-section-title p {
            margin: 6px 0 0;
            color: #666;
        }

        /* GRID */

        .restaurant-grid {
            display: grid;
            grid-template-columns:
                repeat(
                    auto-fit,
                    minmax(300px, 1fr)
                );
            gap: 24px;
        }

        /* CARD */

        .restaurant-card {
            background: white;
            border-radius: 20px;
            overflow: hidden;
            box-shadow:
                0 10px 35px
                rgba(0,0,0,.09);
            transition:
                transform .25s ease,
                box-shadow .25s ease;
        }

        .restaurant-card:hover {
            transform: translateY(-6px);
            box-shadow:
                0 18px 45px
                rgba(0,0,0,.15);
        }

        .restaurant-card-image {
            height: 230px;
            position: relative;
            background: #ddd;
        }

        .restaurant-card-image img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }

        .restaurant-card-rating {
            position: absolute;
            top: 14px;
            right: 14px;
            background: white;
            color: #111;
            padding: 7px 12px;
            border-radius: 30px;
            font-weight: 700;
        }

        .restaurant-card-body {
            padding: 22px;
        }

        .restaurant-card-number {
            color: #777;
            font-size: 13px;
            margin-bottom: 5px;
        }

        .restaurant-card h3 {
            font-size: 23px;
            margin: 5px 0 10px;
        }

        .restaurant-cuisine {
            font-weight: 600;
            margin-bottom: 12px;
        }

        .restaurant-card p {
            color: #666;
            line-height: 1.55;
        }

        .restaurant-card-info {
            display: flex;
            flex-direction: column;
            gap: 7px;
            margin: 18px 0;
            color: #555;
            font-size: 14px;
        }

        .restaurant-card-actions {
            margin-top: 18px;
        }

        .restaurant-view-btn {
            display: block;
            text-align: center;
            background: #111827;
            color: white;
            padding: 13px;
            border-radius: 10px;
            text-decoration: none;
            font-weight: 700;
        }

        /* SCREENSHOT-MATCHED RESTAURANT LIST */

        .restaurant-page {
            min-height: 100vh;
        }

        .restaurant-hero {
            min-height: 325px;
            padding: 0 7%;
            align-items: center;
            background-position: center;
        }

        .restaurant-hero-content {
            max-width: 760px;
            margin-top: 25px;
        }

        .restaurant-badge {
            display: inline-block;
            background: rgba(255,255,255,.16);
            border: 1px solid rgba(255,255,255,.30);
            padding: 8px 14px;
            border-radius: 24px;
            margin-bottom: 14px;
            backdrop-filter: blur(8px);
        }

        .restaurant-hero h1 {
            font-size: clamp(42px, 6vw, 64px);
            line-height: 1;
            margin: 0 0 10px;
            font-weight: 800;
        }

        .restaurant-hero p {
            font-size: 16px;
            line-height: 1.5;
            margin: 0;
            color: #f0f2f5;
        }

        .restaurant-topbar {
            min-height: 58px;
            padding: 10px 7%;
            background: rgba(255,255,255,.96);
            border-bottom: 1px solid #dfe3ea;
        }

        .restaurant-container {
            width: min(1250px, 92%);
            margin: 30px auto 55px;
        }

        .restaurant-section-title {
            gap: 10px;
            margin-bottom: 22px;
        }

        .restaurant-section-title > span {
            font-size: 28px;
        }

        .restaurant-section-title h2 {
            font-size: clamp(22px, 3vw, 30px);
            color: #171b24;
        }

        .restaurant-section-title p {
            font-size: 14px;
        }

        .restaurant-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 20px;
        }

        .restaurant-card {
            background: #fff;
            border-radius: 18px;
            overflow: hidden;
            box-shadow: 0 10px 32px rgba(0,0,0,.12);
        }

        .restaurant-card-image {
            height: 205px;
        }

        .restaurant-card-rating {
            top: 12px;
            right: 12px;
            padding: 6px 10px;
            font-size: 14px;
        }

        .restaurant-card-body {
            padding: 17px;
        }

        .restaurant-card-number {
            font-size: 12px;
            margin-bottom: 4px;
        }

        .restaurant-card h3 {
            font-size: 21px;
            margin: 4px 0 8px;
            color: #171b24;
        }

        .restaurant-cuisine {
            font-size: 14px;
            margin-bottom: 10px;
            color: #343a46;
        }

        .restaurant-card p {
            font-size: 13px;
            color: #68707d;
            line-height: 1.45;
            margin: 0 0 10px;
        }

        .restaurant-card-info {
            gap: 5px;
            margin: 12px 0;
            font-size: 12px;
            color: #555d69;
        }

        .restaurant-card-actions {
            margin-top: 12px;
        }

        .restaurant-view-btn {
            padding: 11px;
            border-radius: 9px;
            font-size: 13px;
            background: #111827;
        }


        @media (max-width: 620px) {
            .restaurant-grid {
                grid-template-columns: 1fr;
            }
            .restaurant-hero {
                min-height: 300px;
                padding: 0 6%;
            }
            .restaurant-container {
                width: 94%;
            }
        }


        /* =====================================================
           NEW SCREENSHOT-MATCHED RESTAURANT LIST
           ===================================================== */

        body.ktg-restaurant-list-mode {
            background: #07101b;
            color: #17202d;
            min-height: 100vh;
        }

        body.ktg-restaurant-list-mode::before {
            content: "";
            position: fixed;
            inset: 0;
            z-index: -5;
            background:
                linear-gradient(
                    rgba(4, 13, 24, .67),
                    rgba(4, 13, 24, .76)
                ),
                url("https://images.pexels.com/photos/16569842/pexels-photo-16569842.jpeg")
                center / cover no-repeat;
            pointer-events: none;
        }

        .ktg-restaurant-list-page {
            min-height: calc(100vh - 58px);
        }

        .ktg-restaurant-list-hero {
            min-height: 335px;
            display: flex;
            align-items: center;
            position: relative;
            overflow: hidden;
            color: #fff;
            background-image:
                linear-gradient(
                    90deg,
                    rgba(0,0,0,.58),
                    rgba(0,0,0,.33),
                    rgba(0,0,0,.70)
                ),
                var(--ktg-restaurant-hero-image);
            background-size: cover;
            background-position: center;
        }

        .ktg-restaurant-list-hero::after {
            content: "";
            position: absolute;
            inset: 0;
            background: linear-gradient(
                0deg,
                rgba(0,0,0,.30),
                transparent 48%
            );
            pointer-events: none;
        }

        .ktg-restaurant-hero-inner {
            width: min(1160px, 90%);
            margin: 0 auto;
            position: relative;
            z-index: 2;
            padding: 35px 0;
        }

        .ktg-restaurant-location-pill {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 14px;
            border: 1px solid rgba(255,255,255,.32);
            border-radius: 999px;
            background: rgba(255,255,255,.13);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            font-size: 13px;
            font-weight: 700;
        }

        .ktg-restaurant-location-pill span {
            font-size: 10px;
        }

        .ktg-restaurant-list-hero h1 {
            margin: 16px 0 8px;
            font-size: clamp(42px, 7vw, 70px);
            line-height: .95;
            letter-spacing: -1.5px;
            color: #fff;
        }

        .ktg-restaurant-list-hero p {
            margin: 0;
            font-size: 16px;
            color: rgba(255,255,255,.88);
        }

        .ktg-restaurant-list-toolbar {
            width: 100%;
            min-height: 62px;
            padding: 10px max(5%, calc((100% - 1160px) / 2));
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            background: rgba(255,255,255,.94);
            border-bottom: 1px solid rgba(15,25,40,.12);
            box-shadow: 0 5px 20px rgba(0,0,0,.08);
        }

        .ktg-restaurant-nav-actions {
            display: flex;
            align-items: center;
            gap: 9px;
        }

        .ktg-list-back-btn,
        .ktg-list-home-btn,
        .ktg-list-theme-btn {
            min-height: 40px;
            padding: 9px 15px;
            border-radius: 10px;
            font-size: 13px;
            font-weight: 700;
            text-decoration: none;
            border: 1px solid #dfe4ec;
            background: #f6f8fb;
            color: #17202d;
            transition: .2s ease;
        }

        .ktg-list-back-btn {
            background: #111827;
            color: #fff;
            border-color: #111827;
        }

        .ktg-list-back-btn:hover,
        .ktg-list-home-btn:hover,
        .ktg-list-theme-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 7px 18px rgba(20,30,50,.12);
        }

        .ktg-list-theme-btn {
            background: #17202d;
            color: #fff;
            border-color: #17202d;
        }

        .ktg-restaurant-list-container {
            width: min(1160px, 92%);
            margin: 0 auto;
            padding: 34px 0 60px;
        }

        .ktg-restaurant-list-heading {
            display: flex;
            align-items: flex-start;
            gap: 11px;
            margin-bottom: 22px;
            color: #fff;
        }

        .ktg-heading-icon {
            font-size: 28px;
            line-height: 1;
        }

        .ktg-restaurant-list-heading h2 {
            margin: 0;
            font-size: clamp(23px, 3vw, 31px);
            line-height: 1.2;
            color: #fff;
        }

        .ktg-restaurant-list-heading p {
            margin: 7px 0 0;
            font-size: 14px;
            line-height: 1.5;
            color: rgba(255,255,255,.72);
        }

        .ktg-restaurant-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 22px;
        }

        .ktg-restaurant-card {
            overflow: hidden;
            background: #fff;
            border: 1px solid rgba(255,255,255,.68);
            border-radius: 19px;
            box-shadow: 0 18px 42px rgba(0,0,0,.22);
            transition: transform .2s ease, box-shadow .2s ease;
        }

        .ktg-restaurant-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 23px 48px rgba(0,0,0,.28);
        }

        .ktg-restaurant-card-image {
            height: 205px;
            position: relative;
            overflow: hidden;
            background: #dfe5eb;
        }

        .ktg-restaurant-card-image img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }

        .ktg-restaurant-image-fallback {
            width: 100%;
            height: 100%;
            display: none;
            align-items: center;
            justify-content: center;
            font-size: 48px;
        }

        .ktg-restaurant-rating {
            position: absolute;
            top: 12px;
            right: 12px;
            padding: 6px 10px;
            border-radius: 999px;
            background: #fff;
            color: #242a34;
            font-size: 13px;
            font-weight: 800;
            box-shadow: 0 4px 14px rgba(0,0,0,.16);
        }

        .ktg-restaurant-card-body {
            padding: 17px;
        }

        .ktg-restaurant-card-number {
            margin-bottom: 3px;
            font-size: 11px;
            color: #818995;
        }

        .ktg-restaurant-card h3 {
            margin: 0 0 8px;
            font-size: 21px;
            line-height: 1.2;
            color: #151b25;
        }

        .ktg-restaurant-cuisine {
            margin-bottom: 10px;
            font-size: 13px;
            font-weight: 700;
            color: #353c47;
        }

        .ktg-restaurant-description {
            min-height: 39px;
            margin: 0 0 12px;
            font-size: 12.5px;
            line-height: 1.48;
            color: #69717d;
        }

        .ktg-restaurant-card-info {
            display: flex;
            flex-direction: column;
            gap: 5px;
            margin: 0 0 14px;
            font-size: 11.5px;
            line-height: 1.35;
            color: #59616c;
        }

        .ktg-restaurant-card-info span {
            display: block;
        }

        .ktg-restaurant-view-btn {
            display: block;
            width: 100%;
            padding: 11px 12px;
            border-radius: 9px;
            background: #111827;
            color: #fff;
            text-align: center;
            font-size: 13px;
            font-weight: 800;
            text-decoration: none;
        }

        .ktg-restaurant-view-btn:hover {
            background: #202b3e;
        }

        /* LIGHT MODE */
        body.ktg-restaurant-light {
            background: #eef2f6;
        }

        body.ktg-restaurant-light::before {
            background:
                linear-gradient(
                    rgba(235,240,245,.72),
                    rgba(225,231,237,.82)
                ),
                url("https://images.pexels.com/photos/16569842/pexels-photo-16569842.jpeg")
                center / cover no-repeat;
        }

        body.ktg-restaurant-light .ktg-restaurant-list-heading h2 {
            color: #18202c;
        }

        body.ktg-restaurant-light .ktg-restaurant-list-heading p {
            color: #657080;
        }

        body.ktg-restaurant-light .ktg-restaurant-list-toolbar {
            background: rgba(255,255,255,.96);
        }

        @media (max-width: 760px) {
            .ktg-restaurant-list-hero {
                min-height: 300px;
            }

            .ktg-restaurant-list-toolbar {
                padding: 10px 4%;
            }

            .ktg-restaurant-list-container {
                width: 94%;
                padding-top: 27px;
            }

            .ktg-restaurant-grid {
                grid-template-columns: 1fr;
                gap: 18px;
            }
        }

        @media (max-width: 470px) {
            .ktg-restaurant-list-toolbar {
                flex-wrap: wrap;
            }

            .ktg-list-theme-btn {
                margin-left: auto;
            }

            .ktg-restaurant-card-image {
                height: 190px;
            }

            .ktg-restaurant-list-hero h1 {
                font-size: 47px;
            }
        }

        /* DETAIL */

        .restaurant-detail-grid {
            display: grid;
            grid-template-columns:
                minmax(0, 1fr)
                330px;
            gap: 25px;
        }

        .restaurant-info-card,
        .restaurant-menu-card,
        .restaurant-action-card,
        .restaurant-id-card,
        .restaurant-image-card {
            background: white;
            border-radius: 18px;
            padding: 24px;
            margin-bottom: 22px;
            box-shadow:
                0 8px 30px
                rgba(0,0,0,.07);
        }

        .restaurant-info-card h2,
        .restaurant-menu-card h2,
        .restaurant-action-card h2 {
            margin-top: 0;
        }

        .restaurant-info-row {
            display: flex;
            justify-content: space-between;
            gap: 20px;
            padding: 14px 0;
            border-bottom: 1px solid #eee;
        }

        .restaurant-info-row:last-child {
            border-bottom: 0;
        }

        .restaurant-info-label {
            color: #666;
        }

        .facility-list {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
        }

        .facility-list span {
            background: #f1f4f8;
            padding: 9px 13px;
            border-radius: 30px;
        }

        /* MENU */

        .menu-grid {
            display: grid;
            grid-template-columns:
                repeat(
                    auto-fit,
                    minmax(250px, 1fr)
                );
            gap: 18px;
        }

        .menu-item {
            border: 1px solid #eee;
            border-radius: 15px;
            overflow: hidden;
        }

        .menu-item img,
        .menu-no-image {
            width: 100%;
            height: 180px;
            object-fit: cover;
            display: block;
            background: #eee;
        }

        .menu-no-image {
            display: grid;
            place-items: center;
            font-size: 45px;
        }

        .menu-item-content {
            padding: 16px;
        }

        .menu-item-content h3 {
            margin: 0 0 7px;
        }

        .menu-item-content p {
            color: #666;
            line-height: 1.5;
        }

        .menu-type {
            display: inline-block;
            padding: 4px 9px;
            border-radius: 20px;
            background: #eee;
            font-size: 12px;
        }

        /* ACTIONS */

        .restaurant-action {
            display: block;
            width: 100%;
            border: 0;
            text-align: center;
            padding: 13px 15px;
            border-radius: 10px;
            margin-bottom: 10px;
            text-decoration: none;
            cursor: pointer;
            font-size: 15px;
            font-weight: 700;
        }

        .restaurant-action.website {
            background: #e8f1ff;
            color: #1557a6;
        }

        .restaurant-action.call {
            background: #e8f8ed;
            color: #137333;
        }

        .restaurant-action.booking {
            background: #ff8a18;
            color: white;
        }

        .restaurant-action.edit {
            background: #111827;
            color: white;
        }

        .restaurant-id-card span {
            display: block;
            color: #777;
            font-size: 13px;
            margin-bottom: 5px;
        }

        .restaurant-id-card strong {
            word-break: break-all;
        }

        .restaurant-image-card {
            padding: 0;
            overflow: hidden;
        }

        .restaurant-image-card img {
            width: 100%;
            height: 300px;
            object-fit: cover;
            display: block;
        }

        /* ERROR */

        .restaurant-error,
        .restaurant-empty {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            padding: 30px;
        }

        .restaurant-error-icon,
        .restaurant-empty-icon {
            font-size: 60px;
        }

        .restaurant-error h1,
        .restaurant-empty h1 {
            font-size: 36px;
        }

        .restaurant-error p,
        .restaurant-empty p {
            max-width: 650px;
            color: #666;
            line-height: 1.6;
        }

        .restaurant-error-actions {
            display: flex;
            gap: 10px;
            margin-top: 20px;
        }

        .restaurant-error-actions button,
        .restaurant-error-actions a,
        .restaurant-empty a {
            border: 0;
            padding: 12px 20px;
            border-radius: 10px;
            background: #111827;
            color: white;
            text-decoration: none;
            cursor: pointer;
        }

        /* MOBILE */

        @media (max-width: 800px) {

            .restaurant-detail-grid {
                grid-template-columns: 1fr;
            }

            .restaurant-hero,
            .restaurant-detail-hero {
                min-height: 330px;
                padding: 35px 5%;
            }

            .restaurant-container,
            .restaurant-detail-container {
                width: 94%;
            }

            .restaurant-info-row {
                flex-direction: column;
                gap: 5px;
            }

        }

    `;

    document.head.appendChild(style);
}