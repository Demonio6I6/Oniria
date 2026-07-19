/* eslint-disable require-jsdoc */
const {onCall, onRequest, HttpsError} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {defineSecret} = require("firebase-functions/params");
const admin = require("firebase-admin");
const axios = require("axios");
const crypto = require("crypto");

const {
  obtenerEmocionesDesdeContexto,
  obtenerInterpretacionSueno,
  obtenerPatronEmocional,
  obtenerReflexionDiaria,
  obtenerRespuestaChat,
  obtenerResumenInterpretacion,
} = require("./openai");

const REGION = "europe-west1";
const PROJECT_ID = "post-it-72f0b";
const ANONYMOUS_ACCOUNT_TTL_DAYS = 30;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const DREAM_INTERPRETATION_LIMIT_MS = DAY_IN_MS;
const DREAM_INTERPRETATION_RESERVATION_TTL_MS = 10 * 60 * 1000;
const GUEST_INTERPRETATION_LIMIT = 1;
const FREE_INTERPRETATION_LIMIT = 3;
const PREMIUM_MONTHLY_INTERPRETATION_LIMIT = 15;
const PREMIUM_DAILY_INTERPRETATION_LIMIT = 2;
const MONTHLY_EMOTIONAL_ANALYSIS_MIN_DREAMS = 10;
const MONTHLY_EMOTIONAL_ANALYSIS_LIMIT_MS = 30 * DAY_IN_MS;
const MONTHLY_EMOTIONAL_ANALYSIS_RESERVATION_TTL_MS = 10 * 60 * 1000;
const RECENT_AUTH_MAX_AGE_MS = 15 * 60 * 1000;
const REVENUECAT_API_URL = "https://api.revenuecat.com/v1";
const REVENUECAT_ENTITLEMENT_ID =
  process.env.REVENUECAT_ENTITLEMENT_ID || "Premium";
const PRODUCT_EVENT_NAMES = new Set([
  "account_conversion_completed",
  "account_cta_clicked",
  "guest_demo_completed",
  "manual_dream_saved",
  "paywall_dismissed",
  "paywall_shown",
  "purchase_failed",
  "purchase_started",
  "purchase_succeeded",
  "restore_failed",
  "restore_started",
  "restore_succeeded",
]);
const PRODUCT_EVENT_PROPERTY_NAMES = new Set([
  "accountType",
  "code",
  "method",
  "packageId",
  "reason",
]);
const PRODUCT_EVENT_HOURLY_LIMIT = 120;
const openaiApiKey = defineSecret("OPENAI_API_KEY");
const revenueCatRestApiKey = defineSecret("REVENUECAT_REST_API_KEY");
const revenueCatWebhookAuth = defineSecret("REVENUECAT_WEBHOOK_AUTH");

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: PROJECT_ID,
});

function requireAuth(request) {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError(
        "unauthenticated",
        "Debes iniciar sesión para usar esta función.",
    );
  }
}

function requireRecentAuthentication(request) {
  const authTimeSeconds = Number(request.auth?.token?.auth_time);
  const authTimeMs = authTimeSeconds * 1000;
  const authAgeMs = Date.now() - authTimeMs;

  if (
    !Number.isFinite(authTimeMs) ||
    authAgeMs < 0 ||
    authAgeMs > RECENT_AUTH_MAX_AGE_MS
  ) {
    throw new HttpsError(
        "failed-precondition",
        "Vuelve a iniciar sesion antes de eliminar tu cuenta.",
        {reason: "recent-login-required"},
    );
  }
}

function readString(data, key, options = {}) {
  const {required = false, maxLength = 12000} = options;
  const value = data ? data[key] : undefined;

  if (required && typeof value !== "string") {
    throw new HttpsError(
        "invalid-argument",
        `El campo ${key} es obligatorio.`,
    );
  }

  if (value === undefined || value === null) return "";

  if (typeof value !== "string") {
    throw new HttpsError(
        "invalid-argument",
        `El campo ${key} debe ser texto.`,
    );
  }

  const trimmed = value.trim();
  if (required && !trimmed) {
    throw new HttpsError(
        "invalid-argument",
        `El campo ${key} no puede estar vacío.`,
    );
  }

  if (trimmed.length > maxLength) {
    throw new HttpsError(
        "invalid-argument",
        `El campo ${key} es demasiado largo.`,
    );
  }

  return trimmed;
}

function readStringArray(data, key, options = {}) {
  const {required = false, maxItems = 20, maxItemLength = 6000} = options;
  const value = data ? data[key] : undefined;

  if (required && !Array.isArray(value)) {
    throw new HttpsError(
        "invalid-argument",
        `El campo ${key} debe ser una lista.`,
    );
  }

  if (!value) return [];

  if (!Array.isArray(value) || value.length > maxItems) {
    throw new HttpsError(
        "invalid-argument",
        `El campo ${key} no tiene un formato válido.`,
    );
  }

  return value.map((item) => {
    if (typeof item !== "string" || item.length > maxItemLength) {
      throw new HttpsError(
          "invalid-argument",
          `Cada elemento de ${key} debe ser texto válido.`,
      );
    }
    return item.trim();
  }).filter(Boolean);
}

function readEventProperties(data) {
  const rawProperties = data?.properties;
  if (!rawProperties || typeof rawProperties !== "object" ||
      Array.isArray(rawProperties)) {
    return {};
  }

  const entries = Object.entries(rawProperties)
      .filter(([key]) => PRODUCT_EVENT_PROPERTY_NAMES.has(key))
      .slice(0, 12);
  return Object.fromEntries(entries.map(([key, value]) => {
    const safeKey = String(key)
        .replace(/[^a-zA-Z0-9_]/g, "_")
        .slice(0, 60) || "value";
    const safeValue = typeof value === "number" ||
      typeof value === "boolean" ?
      value :
      String(value ?? "").slice(0, 240);
    return [safeKey, safeValue];
  }));
}

function getSignInProvider(authToken) {
  return authToken?.firebase?.sign_in_provider || "";
}

function isAnonymousAuthToken(authToken) {
  return getSignInProvider(authToken) === "anonymous";
}

function isAnonymousUserRecord(userRecord) {
  return Array.isArray(userRecord.providerData) &&
    userRecord.providerData.length === 0;
}

function getConfiguredStorageBucketName() {
  try {
    const firebaseConfig = JSON.parse(process.env.FIREBASE_CONFIG || "{}");
    return firebaseConfig.storageBucket || "";
  } catch (error) {
    console.warn("No se pudo leer FIREBASE_CONFIG:", error);
    return "";
  }
}

function isNotFoundStorageError(error) {
  const message = error?.message || "";
  return error?.code === 404 ||
    error?.code === "storage/bucket-not-found" ||
    message.includes("Bucket name not specified") ||
    message.includes("No such object") ||
    message.includes("Not Found") ||
    message.includes("not found");
}

async function touchUserActivity(uid, authToken) {
  await admin.firestore()
      .collection("users")
      .doc(uid)
      .set(
          {
            isAnonymous: isAnonymousAuthToken(authToken),
            lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          {merge: true},
      );
}

async function deleteUserFirestoreTree(uid) {
  const userRef = admin.firestore().collection("users").doc(uid);
  await admin.firestore().recursiveDelete(userRef);
}

async function deleteUserStorageFiles(uid) {
  const bucketName = getConfiguredStorageBucketName();
  let bucket;

  try {
    bucket = bucketName ?
      admin.storage().bucket(bucketName) :
      admin.storage().bucket();

    await bucket.deleteFiles({prefix: `users/${uid}/`});
  } catch (error) {
    if (isNotFoundStorageError(error)) {
      console.warn(`No hay bucket/archivos de Storage para ${uid}.`);
      return;
    }

    throw error;
  }
}

async function deleteAuthUser(uid) {
  try {
    await admin.auth().deleteUser(uid);
  } catch (error) {
    if (error?.code === "auth/user-not-found") return;
    throw error;
  }
}

async function deletePrivateUserState(uid) {
  const productEventRateRef = admin.firestore()
      .collection("privateProductEventRate")
      .doc(uid);
  const migrationsRef = admin.firestore()
      .collection("privateAnonymousMigrations");
  const [targetMigrations, sourceMigration] = await Promise.all([
    migrationsRef.where("targetUid", "==", uid).get(),
    migrationsRef.doc(uid).get(),
  ]);
  const migrationRefs = new Map();

  targetMigrations.docs.forEach((doc) => {
    migrationRefs.set(doc.ref.path, doc.ref);
  });
  if (sourceMigration.exists) {
    migrationRefs.set(sourceMigration.ref.path, sourceMigration.ref);
  }

  await deleteUserFirestoreTree(uid);
  await Promise.all([
    getAiUsageRef(uid).delete(),
    getPrivateEntitlementRef(uid).delete(),
    admin.firestore().recursiveDelete(productEventRateRef),
    ...Array.from(migrationRefs.values()).map((ref) => ref.delete()),
  ]);
}

async function deleteUserAccount(uid, revenueCatApiKey = "") {
  if (revenueCatApiKey) {
    await deleteRevenueCatCustomer(revenueCatApiKey, uid);
  }

  await deletePrivateUserState(uid);
  await deleteUserStorageFiles(uid);
  await deleteAuthUser(uid);
}

async function deleteAnonymousAccount(uid) {
  await deleteUserAccount(uid);
}

function getUserMetadataTime(userRecord) {
  const rawTime = userRecord.metadata.lastSignInTime ||
    userRecord.metadata.creationTime ||
    "";
  const time = Date.parse(rawTime);

  return Number.isFinite(time) ? time : null;
}

function getTimestampMillis(timestamp) {
  if (!timestamp) return null;
  if (typeof timestamp.toMillis === "function") return timestamp.toMillis();
  if (typeof timestamp === "number") return timestamp;
  if (timestamp instanceof Date) return timestamp.getTime();
  return null;
}

async function isStaleAnonymousUser(userRecord, cutoffMs) {
  if (!isAnonymousUserRecord(userRecord)) return false;

  const authTime = getUserMetadataTime(userRecord);
  if (authTime && authTime >= cutoffMs) return false;

  const userSnapshot = await admin.firestore()
      .collection("users")
      .doc(userRecord.uid)
      .get();
  const lastSeenAt = getTimestampMillis(userSnapshot.get("lastSeenAt"));

  return !lastSeenAt || lastSeenAt < cutoffMs;
}

const getDreamSessionRef = (uid, dreamSessionId) =>
  admin.firestore()
      .collection("users")
      .doc(uid)
      .collection("dreamSessions")
      .doc(dreamSessionId);

const getAiUsageRef = (uid) =>
  admin.firestore()
      .collection("privateAiUsage")
      .doc(uid);

const getPrivateEntitlementRef = (uid) =>
  admin.firestore()
      .collection("privateEntitlements")
      .doc(uid);

const getInstallationTrialRef = (installationId) => {
  if (!installationId) return null;
  const installationHash = crypto
      .createHash("sha256")
      .update(installationId)
      .digest("hex");
  return admin.firestore()
      .collection("privateInstallationTrials")
      .doc(installationHash);
};

function toTimestamp(millis) {
  return admin.firestore.Timestamp.fromMillis(millis);
}

function createResourceExhaustedError(message, details = {}) {
  throw new HttpsError("resource-exhausted", message, details);
}

function createAccountRequiredError(message, feature) {
  throw new HttpsError("failed-precondition", message, {
    reason: "account-required",
    accountRequired: true,
    feature,
  });
}

function createPremiumRequiredError(message, feature) {
  createResourceExhaustedError(message, {
    reason: "premium-required",
    premiumRequired: true,
    feature,
  });
}

function getCount(value) {
  const count = Number(value || 0);
  return Number.isFinite(count) ? count : 0;
}

function getUtcDayKey(millis = Date.now()) {
  return new Date(millis).toISOString().slice(0, 10);
}

function getUtcMonthKey(millis = Date.now()) {
  return new Date(millis).toISOString().slice(0, 7);
}

function getNextUtcDayMillis(millis = Date.now()) {
  const date = new Date(millis);
  return Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() + 1,
  );
}

function getNextUtcMonthMillis(millis = Date.now()) {
  const date = new Date(millis);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
}

function getActivePremiumState(entitlementData) {
  if (!entitlementData?.isPremium) return false;

  const premiumExpiresAt = getTimestampMillis(
      entitlementData.premiumExpiresAt,
  );

  return !premiumExpiresAt || premiumExpiresAt > Date.now();
}

async function getUserAccess(uid, authToken) {
  const entitlementSnapshot = await getPrivateEntitlementRef(uid).get();
  const entitlementData = entitlementSnapshot.exists ?
    entitlementSnapshot.data() :
    {};

  return {
    isAnonymous: isAnonymousAuthToken(authToken),
    isPremium: getActivePremiumState(entitlementData),
  };
}

async function buildUserAccessStatus(uid, authToken, installationId) {
  const installationTrialRef = getInstallationTrialRef(installationId);
  const [access, usageSnapshot, installationSnapshot] = await Promise.all([
    getUserAccess(uid, authToken),
    getAiUsageRef(uid).get(),
    installationTrialRef ? installationTrialRef.get() : Promise.resolve(null),
  ]);
  const usage = usageSnapshot.exists ? usageSnapshot.data() : {};
  const installationTrial = installationSnapshot?.exists ?
    installationSnapshot.data() :
    {};
  const nowMs = Date.now();
  const interpretationCount = getCount(usage.interpretationCount);
  const nextInterpretationAt = getTimestampMillis(
      usage.nextInterpretationAvailableAt,
  );
  const monthKey = getUtcMonthKey(nowMs);
  const dayKey = getUtcDayKey(nowMs);
  const premiumMonthlyUsed = usage.premiumMonthKey === monthKey ?
    getCount(usage.premiumMonthInterpretationCount) :
    0;
  const premiumDailyUsed = usage.premiumDayKey === dayKey ?
    getCount(usage.premiumDayInterpretationCount) :
    0;

  let interpretationLimit = FREE_INTERPRETATION_LIMIT;
  let interpretationRemaining = Math.max(
      FREE_INTERPRETATION_LIMIT - interpretationCount,
      0,
  );
  let blockedReason = "";
  let retryAtMillis = null;

  if (access.isAnonymous) {
    interpretationLimit = GUEST_INTERPRETATION_LIMIT;
    interpretationRemaining = Math.max(
        GUEST_INTERPRETATION_LIMIT - interpretationCount,
        0,
    );
    if (interpretationRemaining === 0 || installationTrial.guestDemoUsed) {
      interpretationRemaining = 0;
      blockedReason = "guest-demo-used";
    }
  } else if (access.isPremium) {
    interpretationLimit = PREMIUM_MONTHLY_INTERPRETATION_LIMIT;
    interpretationRemaining = Math.max(
        PREMIUM_MONTHLY_INTERPRETATION_LIMIT - premiumMonthlyUsed,
        0,
    );
    if (interpretationRemaining === 0) {
      blockedReason = "premium-monthly-limit";
      retryAtMillis = getNextUtcMonthMillis(nowMs);
    } else if (premiumDailyUsed >= PREMIUM_DAILY_INTERPRETATION_LIMIT) {
      blockedReason = "premium-daily-limit";
      retryAtMillis = getNextUtcDayMillis(nowMs);
    }
  } else if (interpretationRemaining === 0) {
    blockedReason = "free-interpretation-limit";
  } else if (nextInterpretationAt && nextInterpretationAt > nowMs) {
    blockedReason = "daily-interpretation-limit";
    retryAtMillis = nextInterpretationAt;
  }

  const nextMonthlyAnalysisAt = getTimestampMillis(
      usage.nextMonthlyAnalysisAvailableAt,
  );

  return {
    accountType: access.isAnonymous ?
      "guest" :
      access.isPremium ? "premium" : "free",
    isGuest: access.isAnonymous,
    isPremium: access.isPremium,
    limits: {
      freeInterpretations: FREE_INTERPRETATION_LIMIT,
      guestInterpretations: GUEST_INTERPRETATION_LIMIT,
      premiumDailyInterpretations: PREMIUM_DAILY_INTERPRETATION_LIMIT,
      premiumMonthlyInterpretations: PREMIUM_MONTHLY_INTERPRETATION_LIMIT,
    },
    interpretations: {
      blockedReason,
      canInterpret: !blockedReason,
      limit: interpretationLimit,
      remaining: interpretationRemaining,
      retryAt: retryAtMillis ? new Date(retryAtMillis).toISOString() : null,
      retryAtMillis,
      totalUsed: interpretationCount,
      premiumDailyLimit: PREMIUM_DAILY_INTERPRETATION_LIMIT,
      premiumDailyUsed,
      premiumMonthlyUsed,
      periodKey: access.isPremium ? monthKey : null,
    },
    monthlyAnalysis: {
      minimumDreams: MONTHLY_EMOTIONAL_ANALYSIS_MIN_DREAMS,
      canGenerate: access.isPremium &&
        (!nextMonthlyAnalysisAt || nextMonthlyAnalysisAt <= nowMs),
      nextAvailableAt: nextMonthlyAnalysisAt ?
        new Date(nextMonthlyAnalysisAt).toISOString() :
        null,
      nextAvailableAtMillis: nextMonthlyAnalysisAt,
    },
  };
}

function assertRegisteredAccount(access, feature) {
  if (!access?.isAnonymous) return;

  createAccountRequiredError(
      "Crea una cuenta para continuar con esta lectura.",
      feature,
  );
}

function assertPremiumAccess(access, feature) {
  assertRegisteredAccount(access, feature);

  if (access?.isPremium) return;

  createPremiumRequiredError(
      "Esta funcion requiere Lunentra Premium.",
      feature,
  );
}

function getRevenueCatAuthorizationHeader(apiKey) {
  return apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`;
}

async function fetchRevenueCatSubscriber(apiKey, appUserId) {
  if (!apiKey) {
    throw new HttpsError(
        "failed-precondition",
        "RevenueCat no esta configurado en el servidor.",
        {reason: "revenuecat-not-configured"},
    );
  }

  try {
    const response = await axios.get(
        `${REVENUECAT_API_URL}/subscribers/${encodeURIComponent(appUserId)}`,
        {
          headers: {
            "Authorization": getRevenueCatAuthorizationHeader(apiKey),
          },
          timeout: 15000,
        },
    );

    return response.data?.subscriber || null;
  } catch (error) {
    if (error?.response?.status === 404) return null;
    throw error;
  }
}

async function deleteRevenueCatCustomer(apiKey, appUserId) {
  if (!apiKey) {
    throw new HttpsError(
        "failed-precondition",
        "RevenueCat no esta configurado en el servidor.",
        {reason: "revenuecat-not-configured"},
    );
  }

  try {
    await axios.delete(
        `${REVENUECAT_API_URL}/subscribers/${encodeURIComponent(appUserId)}`,
        {
          headers: {
            "Authorization": getRevenueCatAuthorizationHeader(apiKey),
          },
          timeout: 15000,
        },
    );
  } catch (error) {
    if (error?.response?.status === 404) return;
    throw error;
  }
}

function getRevenueCatPremiumState(subscriber) {
  const entitlement =
    subscriber?.entitlements?.[REVENUECAT_ENTITLEMENT_ID] || null;
  const expiresDate = entitlement?.expires_date || "";
  const expiresAtMs = expiresDate ? Date.parse(expiresDate) : null;
  const hasValidExpiration =
    !expiresDate || (Number.isFinite(expiresAtMs) && expiresAtMs > Date.now());
  const isPremium = Boolean(entitlement && hasValidExpiration);

  return {
    isPremium,
    productIdentifier: entitlement?.product_identifier || "",
    premiumExpiresAtMs: Number.isFinite(expiresAtMs) ? expiresAtMs : null,
  };
}

async function writeRevenueCatPremiumState(uid, premiumState, source) {
  const payload = {
    entitlementId: REVENUECAT_ENTITLEMENT_ID,
    isPremium: premiumState.isPremium,
    productIdentifier: premiumState.productIdentifier || "",
    revenueCatAppUserId: uid,
    source,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (premiumState.premiumExpiresAtMs) {
    payload.premiumExpiresAt = toTimestamp(premiumState.premiumExpiresAtMs);
  } else {
    payload.premiumExpiresAt = admin.firestore.FieldValue.delete();
  }

  await getPrivateEntitlementRef(uid).set(payload, {merge: true});
}

async function refreshRevenueCatSubscriptionStatus(uid, apiKey, source) {
  const subscriber = await fetchRevenueCatSubscriber(apiKey, uid);
  const premiumState = getRevenueCatPremiumState(subscriber);

  await writeRevenueCatPremiumState(uid, premiumState, source);

  return {
    entitlementId: REVENUECAT_ENTITLEMENT_ID,
    isPremium: premiumState.isPremium,
    premiumExpiresAt: premiumState.premiumExpiresAtMs ?
      new Date(premiumState.premiumExpiresAtMs).toISOString() :
      null,
  };
}

function assertDreamSessionId(dreamSessionId) {
  if (!dreamSessionId) {
    throw new HttpsError(
        "invalid-argument",
        "Falta el identificador de la interpretacion.",
    );
  }
}

async function claimDreamInterpretationQuota(
    uid,
    dreamSessionId,
    access,
    installationId,
) {
  assertDreamSessionId(dreamSessionId);

  const usageRef = getAiUsageRef(uid);
  const nowMs = Date.now();
  const reservationExpiresAtMs =
    nowMs + DREAM_INTERPRETATION_RESERVATION_TTL_MS;
  const reservationId =
    `${dreamSessionId}_${nowMs}_${Math.random().toString(36).slice(2, 10)}`;
  const installationTrialRef = access?.isAnonymous ?
    getInstallationTrialRef(installationId) :
    null;

  await admin.firestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(usageRef);
    const installationSnapshot = installationTrialRef ?
      await transaction.get(installationTrialRef) :
      null;
    const usage = snapshot.exists ? snapshot.data() : {};
    const installationTrial = installationSnapshot?.exists ?
      installationSnapshot.data() :
      {};
    const activeReservation = usage.activeInterpretationReservation || null;
    const reservationExpiresAt = getTimestampMillis(
        activeReservation?.expiresAt,
    );

    if (reservationExpiresAt && reservationExpiresAt > nowMs) {
      createResourceExhaustedError(
          "Ya hay una interpretacion en curso. " +
            "Espera un momento antes de intentar otra vez.",
          {
            reason: "interpretation-in-progress",
            retryAt: new Date(reservationExpiresAt).toISOString(),
            retryAtMillis: reservationExpiresAt,
          },
      );
    }

    const installationReservationExpiresAt = getTimestampMillis(
        installationTrial.activeGuestDemoReservation?.expiresAt,
    );

    if (installationTrial.guestDemoUsed) {
      createResourceExhaustedError(
          "Ya se uso la interpretacion demo en esta instalacion.",
          {
            reason: "guest-demo-used",
            accountRequired: true,
            limit: GUEST_INTERPRETATION_LIMIT,
          },
      );
    }

    if (
      installationReservationExpiresAt &&
      installationReservationExpiresAt > nowMs
    ) {
      createResourceExhaustedError(
          "Ya hay una interpretacion demo en curso.",
          {
            reason: "interpretation-in-progress",
            retryAt: new Date(installationReservationExpiresAt).toISOString(),
            retryAtMillis: installationReservationExpiresAt,
          },
      );
    }

    const interpretationCount = getCount(usage.interpretationCount);
    const premiumMonthKey = getUtcMonthKey(nowMs);
    const premiumDayKey = getUtcDayKey(nowMs);
    const premiumMonthlyUsed = usage.premiumMonthKey === premiumMonthKey ?
      getCount(usage.premiumMonthInterpretationCount) :
      0;
    const premiumDailyUsed = usage.premiumDayKey === premiumDayKey ?
      getCount(usage.premiumDayInterpretationCount) :
      0;

    if (
      access?.isAnonymous &&
      interpretationCount >= GUEST_INTERPRETATION_LIMIT
    ) {
      createResourceExhaustedError(
          "Ya usaste tu interpretacion demo como invitado.",
          {
            reason: "guest-demo-used",
            accountRequired: true,
            limit: GUEST_INTERPRETATION_LIMIT,
          },
      );
    }

    if (
      !access?.isAnonymous &&
      !access?.isPremium &&
      interpretationCount >= FREE_INTERPRETATION_LIMIT
    ) {
      createResourceExhaustedError(
          "Ya usaste tus interpretaciones gratuitas.",
          {
            reason: "free-interpretation-limit",
            premiumRequired: true,
            limit: FREE_INTERPRETATION_LIMIT,
          },
      );
    }

    if (
      access?.isPremium &&
      premiumMonthlyUsed >= PREMIUM_MONTHLY_INTERPRETATION_LIMIT
    ) {
      const retryAtMillis = getNextUtcMonthMillis(nowMs);
      createResourceExhaustedError(
          "Ya usaste las lecturas Premium incluidas este mes.",
          {
            reason: "premium-monthly-limit",
            limit: PREMIUM_MONTHLY_INTERPRETATION_LIMIT,
            retryAt: new Date(retryAtMillis).toISOString(),
            retryAtMillis,
          },
      );
    }

    if (
      access?.isPremium &&
      premiumDailyUsed >= PREMIUM_DAILY_INTERPRETATION_LIMIT
    ) {
      const retryAtMillis = getNextUtcDayMillis(nowMs);
      createResourceExhaustedError(
          "Alcanzaste el limite operativo de lecturas Premium por hoy.",
          {
            reason: "premium-daily-limit",
            limit: PREMIUM_DAILY_INTERPRETATION_LIMIT,
            retryAt: new Date(retryAtMillis).toISOString(),
            retryAtMillis,
          },
      );
    }

    const nextAvailableAt = getTimestampMillis(
        usage.nextInterpretationAvailableAt,
    );

    if (!access?.isPremium && nextAvailableAt && nextAvailableAt > nowMs) {
      createResourceExhaustedError(
          "Ya usaste tu interpretacion disponible por hoy.",
          {
            reason: "daily-interpretation-limit",
            retryAt: new Date(nextAvailableAt).toISOString(),
            retryAtMillis: nextAvailableAt,
          },
      );
    }

    transaction.set(
        usageRef,
        {
          activeInterpretationReservation: {
            id: reservationId,
            dreamSessionId,
            createdAt: toTimestamp(nowMs),
            expiresAt: toTimestamp(reservationExpiresAtMs),
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        {merge: true},
    );

    if (installationTrialRef) {
      transaction.set(
          installationTrialRef,
          {
            activeGuestDemoReservation: {
              id: reservationId,
              createdAt: toTimestamp(nowMs),
              expiresAt: toTimestamp(reservationExpiresAtMs),
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          {merge: true},
      );
    }
  });

  return reservationId;
}

async function completeDreamInterpretationQuota(
    uid,
    dreamSessionId,
    reservationId,
    access,
    installationId,
) {
  const usageRef = getAiUsageRef(uid);
  const sessionRef = getDreamSessionRef(uid, dreamSessionId);
  const nowMs = Date.now();
  const nextAvailableAtMs = nowMs + DREAM_INTERPRETATION_LIMIT_MS;
  const installationTrialRef = access?.isAnonymous ?
    getInstallationTrialRef(installationId) :
    null;

  await admin.firestore().runTransaction(async (transaction) => {
    const usageSnapshot = await transaction.get(usageRef);
    const installationSnapshot = installationTrialRef ?
      await transaction.get(installationTrialRef) :
      null;
    const usage = usageSnapshot.exists ? usageSnapshot.data() : {};
    const activeReservation = usage.activeInterpretationReservation || null;

    if (
      activeReservation?.id !== reservationId ||
      activeReservation?.dreamSessionId !== dreamSessionId
    ) {
      throw new HttpsError(
          "aborted",
          "La reserva de interpretacion ya no esta activa.",
      );
    }

    if (
      installationTrialRef &&
      installationSnapshot?.data()?.activeGuestDemoReservation?.id !==
        reservationId
    ) {
      throw new HttpsError(
          "aborted",
          "La reserva de demo ya no esta activa.",
      );
    }

    const premiumMonthKey = getUtcMonthKey(nowMs);
    const premiumDayKey = getUtcDayKey(nowMs);
    const premiumMonthlyUsed = usage.premiumMonthKey === premiumMonthKey ?
      getCount(usage.premiumMonthInterpretationCount) :
      0;
    const premiumDailyUsed = usage.premiumDayKey === premiumDayKey ?
      getCount(usage.premiumDayInterpretationCount) :
      0;
    const quotaUpdates = access?.isPremium ? {
      nextInterpretationAvailableAt:
        admin.firestore.FieldValue.delete(),
      premiumMonthKey,
      premiumMonthInterpretationCount: premiumMonthlyUsed + 1,
      premiumDayKey,
      premiumDayInterpretationCount: premiumDailyUsed + 1,
    } : {
      nextInterpretationAvailableAt: toTimestamp(nextAvailableAtMs),
    };

    transaction.set(
        sessionRef,
        {
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          followUpUsed: false,
          summaryGenerated: false,
          emotionsExtracted: false,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        {merge: true},
    );

    transaction.set(
        usageRef,
        {
          activeInterpretationReservation:
            admin.firestore.FieldValue.delete(),
          lastInterpretationAt: toTimestamp(nowMs),
          lastInterpretationPlan: access?.isPremium ?
            "premium" :
            access?.isAnonymous ? "guest" : "free",
          ...quotaUpdates,
          interpretationCount: admin.firestore.FieldValue.increment(1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        {merge: true},
    );

    if (installationTrialRef) {
      transaction.set(
          installationTrialRef,
          {
            activeGuestDemoReservation:
              admin.firestore.FieldValue.delete(),
            guestDemoUsed: true,
            guestDemoUsedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          {merge: true},
      );
    }
  });
}

async function releaseDreamInterpretationQuota(
    uid,
    dreamSessionId,
    reservationId,
    access,
    installationId,
) {
  const usageRef = getAiUsageRef(uid);
  const installationTrialRef = access?.isAnonymous ?
    getInstallationTrialRef(installationId) :
    null;

  await admin.firestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(usageRef);
    const installationSnapshot = installationTrialRef ?
      await transaction.get(installationTrialRef) :
      null;
    if (!snapshot.exists) return;

    const activeReservation =
      snapshot.data().activeInterpretationReservation || null;

    if (
      activeReservation?.id !== reservationId ||
      activeReservation?.dreamSessionId !== dreamSessionId
    ) {
      return;
    }

    transaction.set(
        usageRef,
        {
          activeInterpretationReservation:
            admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        {merge: true},
    );

    if (
      installationTrialRef &&
      installationSnapshot?.data()?.activeGuestDemoReservation?.id ===
        reservationId
    ) {
      transaction.set(
          installationTrialRef,
          {
            activeGuestDemoReservation:
              admin.firestore.FieldValue.delete(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          {merge: true},
      );
    }
  });
}

function assertMonthlyEmotionalAnalysisDreamCount(dreamCount) {
  if (dreamCount >= MONTHLY_EMOTIONAL_ANALYSIS_MIN_DREAMS) return;

  throw new HttpsError(
      "failed-precondition",
      "Necesitas mas suenos guardados para generar el analisis mensual.",
      {
        reason: "monthly-analysis-min-dreams",
        requiredDreams: MONTHLY_EMOTIONAL_ANALYSIS_MIN_DREAMS,
        currentDreams: dreamCount,
      },
  );
}

async function claimMonthlyEmotionalAnalysisQuota(uid) {
  const usageRef = getAiUsageRef(uid);
  const nowMs = Date.now();
  const reservationExpiresAtMs =
    nowMs + MONTHLY_EMOTIONAL_ANALYSIS_RESERVATION_TTL_MS;
  const reservationId =
    `monthly_${nowMs}_${Math.random().toString(36).slice(2, 10)}`;

  await admin.firestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(usageRef);
    const usage = snapshot.exists ? snapshot.data() : {};
    const activeReservation = usage.activeMonthlyAnalysisReservation || null;
    const reservationExpiresAt = getTimestampMillis(
        activeReservation?.expiresAt,
    );

    if (reservationExpiresAt && reservationExpiresAt > nowMs) {
      createResourceExhaustedError(
          "Ya hay un analisis mensual en curso.",
          {
            reason: "monthly-analysis-in-progress",
            retryAt: new Date(reservationExpiresAt).toISOString(),
            retryAtMillis: reservationExpiresAt,
          },
      );
    }

    const nextAvailableAt = getTimestampMillis(
        usage.nextMonthlyAnalysisAvailableAt,
    );

    if (nextAvailableAt && nextAvailableAt > nowMs) {
      createResourceExhaustedError(
          "Ya generaste tu analisis mensual disponible.",
          {
            reason: "monthly-analysis-cooldown",
            retryAt: new Date(nextAvailableAt).toISOString(),
            retryAtMillis: nextAvailableAt,
          },
      );
    }

    transaction.set(
        usageRef,
        {
          activeMonthlyAnalysisReservation: {
            id: reservationId,
            createdAt: toTimestamp(nowMs),
            expiresAt: toTimestamp(reservationExpiresAtMs),
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        {merge: true},
    );
  });

  return reservationId;
}

async function completeMonthlyEmotionalAnalysisQuota(
    uid,
    reservationId,
    dreamCount,
) {
  const usageRef = getAiUsageRef(uid);
  const nowMs = Date.now();
  const nextAvailableAtMs = nowMs + MONTHLY_EMOTIONAL_ANALYSIS_LIMIT_MS;

  await admin.firestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(usageRef);
    const usage = snapshot.exists ? snapshot.data() : {};
    const activeReservation = usage.activeMonthlyAnalysisReservation || null;

    if (activeReservation?.id !== reservationId) {
      throw new HttpsError(
          "aborted",
          "La reserva de analisis mensual ya no esta activa.",
      );
    }

    transaction.set(
        usageRef,
        {
          activeMonthlyAnalysisReservation:
            admin.firestore.FieldValue.delete(),
          lastMonthlyAnalysisAt: toTimestamp(nowMs),
          nextMonthlyAnalysisAvailableAt: toTimestamp(nextAvailableAtMs),
          lastMonthlyAnalysisDreamCount: dreamCount,
          monthlyAnalysisCount: admin.firestore.FieldValue.increment(1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        {merge: true},
    );
  });
}

async function releaseMonthlyEmotionalAnalysisQuota(uid, reservationId) {
  const usageRef = getAiUsageRef(uid);

  await admin.firestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(usageRef);
    if (!snapshot.exists) return;

    const activeReservation =
      snapshot.data().activeMonthlyAnalysisReservation || null;

    if (activeReservation?.id !== reservationId) return;

    transaction.set(
        usageRef,
        {
          activeMonthlyAnalysisReservation:
            admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        {merge: true},
    );
  });
}

async function claimDreamFollowUp(uid, dreamSessionId) {
  assertDreamSessionId(dreamSessionId);

  const sessionRef = getDreamSessionRef(uid, dreamSessionId);

  await admin.firestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(sessionRef);

    if (!snapshot.exists) {
      throw new HttpsError(
          "failed-precondition",
          "Primero debes iniciar una interpretacion.",
      );
    }

    const sessionData = snapshot.data();
    if (sessionData && sessionData.followUpUsed) {
      throw new HttpsError(
          "resource-exhausted",
          "Esta interpretacion ya uso su ampliacion.",
      );
    }

    transaction.set(
        sessionRef,
        {
          followUpUsed: true,
          followUpUsedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        {merge: true},
    );
  });
}

async function releaseDreamFollowUp(uid, dreamSessionId) {
  await getDreamSessionRef(uid, dreamSessionId).set(
      {
        followUpUsed: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {merge: true},
  );
}

async function claimDreamSessionAction(
    uid,
    dreamSessionId,
    actionField,
    exhaustedMessage,
) {
  assertDreamSessionId(dreamSessionId);

  const sessionRef = getDreamSessionRef(uid, dreamSessionId);

  await admin.firestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(sessionRef);

    if (!snapshot.exists) {
      throw new HttpsError(
          "failed-precondition",
          "Primero debes iniciar una interpretacion.",
      );
    }

    const sessionData = snapshot.data();
    if (sessionData && sessionData[actionField]) {
      createResourceExhaustedError(exhaustedMessage, {
        reason: `${actionField}-already-used`,
      });
    }

    transaction.set(
        sessionRef,
        {
          [actionField]: true,
          [`${actionField}At`]:
            admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        {merge: true},
    );
  });
}

async function releaseDreamSessionAction(uid, dreamSessionId, actionField) {
  await getDreamSessionRef(uid, dreamSessionId).set(
      {
        [actionField]: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {merge: true},
  );
}

function aiFunction(handler) {
  return onCall(
      {
        region: REGION,
        secrets: [openaiApiKey],
        timeoutSeconds: 120,
      },
      async (request) => {
        requireAuth(request);
        await touchUserActivity(
            request.auth.uid,
            request.auth.token,
        ).catch((error) => {
          console.error("Error registrando actividad de usuario:", error);
        });

        try {
          return await handler(
              request.data || {},
              openaiApiKey.value(),
              request.auth.uid,
              request.auth.token,
          );
        } catch (error) {
          if (error instanceof HttpsError) {
            throw error;
          }

          console.error("Error en función de IA:", error);
          throw new HttpsError(
              "internal",
              "No se pudo procesar la solicitud en este momento.",
          );
        }
      },
  );
}

exports.getAccessStatus = onCall(
    {
      region: REGION,
      timeoutSeconds: 30,
    },
    async (request) => {
      requireAuth(request);
      const installationId = readString(
          request.data || {},
          "installationId",
          {maxLength: 160},
      );
      return buildUserAccessStatus(
          request.auth.uid,
          request.auth.token,
          installationId,
      );
    },
);

exports.trackProductEvent = onCall(
    {
      region: REGION,
      timeoutSeconds: 15,
    },
    async (request) => {
      requireAuth(request);
      const name = readString(request.data || {}, "name", {
        required: true,
        maxLength: 80,
      });

      if (!PRODUCT_EVENT_NAMES.has(name)) {
        throw new HttpsError(
            "invalid-argument",
            "El evento de producto no esta permitido.",
        );
      }

      const now = new Date();
      const hourKey = now.toISOString().slice(0, 13);
      const rateRef = admin.firestore()
          .collection("privateProductEventRate")
          .doc(request.auth.uid);
      const eventRef = admin.firestore()
          .collection("privateProductEvents")
          .doc();

      await admin.firestore().runTransaction(async (transaction) => {
        const rateSnapshot = await transaction.get(rateRef);
        const rate = rateSnapshot.exists ? rateSnapshot.data() : {};
        const eventCount = rate.hourKey === hourKey ?
          getCount(rate.eventCount) :
          0;

        if (eventCount >= PRODUCT_EVENT_HOURLY_LIMIT) {
          createResourceExhaustedError(
              "Se alcanzo el limite de eventos de producto.",
              {reason: "product-event-rate-limit"},
          );
        }

        transaction.set(rateRef, {
          eventCount: eventCount + 1,
          hourKey,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, {merge: true});
        transaction.set(eventRef, {
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          isAnonymous: isAnonymousAuthToken(request.auth.token),
          name,
          properties: readEventProperties(request.data || {}),
          uid: request.auth.uid,
        });
      });

      return {tracked: true};
    },
);

exports.migrateAnonymousServerState = onCall(
    {
      region: REGION,
      timeoutSeconds: 120,
    },
    async (request) => {
      requireAuth(request);
      if (isAnonymousAuthToken(request.auth.token)) {
        createAccountRequiredError(
            "Primero inicia sesion con tu cuenta.",
            "anonymous-migration",
        );
      }

      const anonymousIdToken = readString(
          request.data || {},
          "anonymousIdToken",
          {required: true, maxLength: 5000},
      );
      const decodedToken = await admin.auth().verifyIdToken(anonymousIdToken);
      const sourceUid = decodedToken.uid;
      const targetUid = request.auth.uid;

      if (sourceUid === targetUid || !isAnonymousAuthToken(decodedToken)) {
        throw new HttpsError(
            "invalid-argument",
            "La sesion de origen no es una cuenta invitada valida.",
        );
      }

      const sourceUser = await admin.auth().getUser(sourceUid);
      if (!isAnonymousUserRecord(sourceUser)) {
        throw new HttpsError(
            "failed-precondition",
            "La cuenta de origen ya no es invitada.",
        );
      }

      const migrationRef = admin.firestore()
          .collection("privateAnonymousMigrations")
          .doc(sourceUid);
      let migrationComplete = false;

      await admin.firestore().runTransaction(async (transaction) => {
        const migrationSnapshot = await transaction.get(migrationRef);
        if (migrationSnapshot.exists) {
          const migration = migrationSnapshot.data();
          if (migration.targetUid !== targetUid) {
            throw new HttpsError(
                "permission-denied",
                "Esta sesion invitada ya se vinculo a otra cuenta.",
            );
          }
          migrationComplete = migration.status === "complete";
          return;
        }

        transaction.set(migrationRef, {
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          sourceUid,
          status: "in_progress",
          targetUid,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      if (migrationComplete) {
        return {alreadyMigrated: true, migrated: true};
      }

      const sourceSessionsRef = admin.firestore()
          .collection("users")
          .doc(sourceUid)
          .collection("dreamSessions");
      const targetSessionsRef = admin.firestore()
          .collection("users")
          .doc(targetUid)
          .collection("dreamSessions");
      const sourceSessions = await sourceSessionsRef.get();
      const sessionBatch = admin.firestore().batch();
      sourceSessions.docs.forEach((sessionDoc) => {
        sessionBatch.set(
            targetSessionsRef.doc(sessionDoc.id),
            sessionDoc.data(),
            {merge: true},
        );
      });
      if (!sourceSessions.empty) await sessionBatch.commit();

      const sourceUsageRef = getAiUsageRef(sourceUid);
      const targetUsageRef = getAiUsageRef(targetUid);
      await admin.firestore().runTransaction(async (transaction) => {
        const [sourceUsageSnapshot, targetUsageSnapshot] = await Promise.all([
          transaction.get(sourceUsageRef),
          transaction.get(targetUsageRef),
        ]);
        const sourceUsage = sourceUsageSnapshot.exists ?
          sourceUsageSnapshot.data() :
          {};
        const targetUsage = targetUsageSnapshot.exists ?
          targetUsageSnapshot.data() :
          {};
        const sourceNextAt = getTimestampMillis(
            sourceUsage.nextInterpretationAvailableAt,
        );
        const targetNextAt = getTimestampMillis(
            targetUsage.nextInterpretationAvailableAt,
        );
        const mergedNextAt = Math.max(sourceNextAt || 0, targetNextAt || 0);
        const usageUpdate = {
          interpretationCount:
            getCount(sourceUsage.interpretationCount) +
            getCount(targetUsage.interpretationCount),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (mergedNextAt) {
          usageUpdate.nextInterpretationAvailableAt = toTimestamp(mergedNextAt);
        }

        transaction.set(targetUsageRef, usageUpdate, {merge: true});
        transaction.set(migrationRef, {
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          status: "complete",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, {merge: true});
      });

      await deleteAnonymousAccount(sourceUid);
      return {
        migrated: true,
        migratedDreamSessions: sourceSessions.size,
      };
    },
);

exports.deleteAnonymousUserData = onCall(
    {
      region: REGION,
      timeoutSeconds: 120,
    },
    async (request) => {
      requireAuth(request);

      const userRecord = await admin.auth().getUser(request.auth.uid);
      const isAnonymous = isAnonymousAuthToken(request.auth.token) ||
        isAnonymousUserRecord(userRecord);

      if (!isAnonymous) {
        throw new HttpsError(
            "permission-denied",
            "Solo las cuentas invitadas pueden usar esta limpieza.",
        );
      }

      try {
        await deleteAnonymousAccount(request.auth.uid);
        return {deleted: true};
      } catch (error) {
        console.error("Error borrando cuenta invitada:", error);
        throw new HttpsError(
            "internal",
            "No se pudieron borrar los datos de la cuenta invitada.",
        );
      }
    },
);

exports.deleteUserAccountData = onCall(
    {
      region: REGION,
      secrets: [revenueCatRestApiKey],
      timeoutSeconds: 120,
    },
    async (request) => {
      requireAuth(request);

      const userRecord = await admin.auth().getUser(request.auth.uid);
      const isAnonymous = isAnonymousAuthToken(request.auth.token) ||
        isAnonymousUserRecord(userRecord);

      if (!isAnonymous) {
        requireRecentAuthentication(request);
      }

      try {
        await deleteUserAccount(
            request.auth.uid,
            isAnonymous ? "" : revenueCatRestApiKey.value(),
        );
        return {deleted: true};
      } catch (error) {
        if (error instanceof HttpsError) throw error;

        console.error("Error borrando cuenta de usuario:", error);
        throw new HttpsError(
            "internal",
            "No se pudo eliminar la cuenta completa.",
        );
      }
    },
);

exports.syncRevenueCatSubscription = onCall(
    {
      region: REGION,
      secrets: [revenueCatRestApiKey],
      timeoutSeconds: 30,
    },
    async (request) => {
      requireAuth(request);

      if (isAnonymousAuthToken(request.auth.token)) {
        createAccountRequiredError(
            "Crea una cuenta para activar Premium.",
            "subscription-sync",
        );
      }

      try {
        return await refreshRevenueCatSubscriptionStatus(
            request.auth.uid,
            revenueCatRestApiKey.value(),
            "client-sync",
        );
      } catch (error) {
        if (error instanceof HttpsError) throw error;

        console.error("Error sincronizando RevenueCat:", error);
        throw new HttpsError(
            "internal",
            "No se pudo sincronizar el estado Premium.",
        );
      }
    },
);

exports.revenueCatWebhook = onRequest(
    {
      region: REGION,
      secrets: [revenueCatRestApiKey, revenueCatWebhookAuth],
      timeoutSeconds: 30,
    },
    async (request, response) => {
      if (request.method !== "POST") {
        response.status(405).send("Method not allowed");
        return;
      }

      const expectedAuth = revenueCatWebhookAuth.value();
      const receivedAuth = request.get("authorization") || "";
      const authMatches =
        expectedAuth &&
        (receivedAuth === expectedAuth ||
          receivedAuth === `Bearer ${expectedAuth}`);

      if (!authMatches) {
        response.status(401).send("Unauthorized");
        return;
      }

      const event = request.body?.event || request.body || {};
      const appUserId = event.app_user_id || event.original_app_user_id || "";

      if (!appUserId) {
        response.status(400).send("Missing app_user_id");
        return;
      }

      try {
        const result = await refreshRevenueCatSubscriptionStatus(
            appUserId,
            revenueCatRestApiKey.value(),
            "webhook",
        );

        response.status(200).json({ok: true, appUserId, result});
      } catch (error) {
        console.error("Error procesando webhook de RevenueCat:", error);
        response.status(500).send("Could not process webhook");
      }
    },
);

exports.interpretDream = aiFunction(async (data, apiKey, uid, authToken) => {
  const descripcion = readString(data, "descripcion", {
    required: true,
    maxLength: 6000,
  });
  const contextoPerfil = readString(data, "contextoPerfil", {
    maxLength: 8000,
  });
  const dreamSessionId = readString(data, "dreamSessionId", {
    required: true,
    maxLength: 120,
  });
  const installationId = readString(data, "installationId", {
    maxLength: 160,
  });
  const access = await getUserAccess(uid, authToken);

  const reservationId = await claimDreamInterpretationQuota(
      uid,
      dreamSessionId,
      access,
      installationId,
  );

  try {
    const text = await obtenerInterpretacionSueno(
        apiKey,
        descripcion,
        contextoPerfil,
    );

    await completeDreamInterpretationQuota(
        uid,
        dreamSessionId,
        reservationId,
        access,
        installationId,
    );

    return {text};
  } catch (error) {
    try {
      await releaseDreamInterpretationQuota(
          uid,
          dreamSessionId,
          reservationId,
          access,
          installationId,
      );
    } catch (releaseError) {
      console.error(
          "Error liberando reserva de interpretacion:",
          releaseError,
      );
    }

    throw error;
  }
});

exports.continueDreamChat = aiFunction(async (data, apiKey, uid, authToken) => {
  const mensajeUsuario = readString(data, "mensajeUsuario", {
    required: true,
    maxLength: 6000,
  });
  const contextoPerfil = readString(data, "contextoPerfil", {
    maxLength: 8000,
  });
  const contextoConversacion = readString(data, "contextoConversacion", {
    maxLength: 16000,
  });
  const dreamSessionId = readString(data, "dreamSessionId", {
    required: true,
    maxLength: 120,
  });
  const access = await getUserAccess(uid, authToken);

  assertRegisteredAccount(access, "dream-follow-up");

  await claimDreamFollowUp(uid, dreamSessionId);

  try {
    const text = await obtenerRespuestaChat(
        apiKey,
        mensajeUsuario,
        contextoPerfil,
        contextoConversacion,
    );
    return {text};
  } catch (error) {
    try {
      await releaseDreamFollowUp(uid, dreamSessionId);
    } catch (releaseError) {
      console.error("Error liberando ampliacion de sueno:", releaseError);
    }
    throw error;
  }
});

exports.summarizeInterpretation = aiFunction(async (data, apiKey, uid) => {
  const interpretacionCompleta = readString(data, "interpretacionCompleta", {
    required: true,
    maxLength: 16000,
  });
  const dreamSessionId = readString(data, "dreamSessionId", {
    required: true,
    maxLength: 120,
  });

  await claimDreamSessionAction(
      uid,
      dreamSessionId,
      "summaryGenerated",
      "Esta interpretacion ya genero su resumen.",
  );

  try {
    const text = await obtenerResumenInterpretacion(
        apiKey,
        interpretacionCompleta,
    );
    return {text};
  } catch (error) {
    try {
      await releaseDreamSessionAction(uid, dreamSessionId, "summaryGenerated");
    } catch (releaseError) {
      console.error("Error liberando resumen de sueno:", releaseError);
    }
    throw error;
  }
});

exports.extractDreamEmotions = aiFunction(async (data, apiKey, uid) => {
  const descripcion = readString(data, "descripcion", {
    required: true,
    maxLength: 6000,
  });
  const contextoPerfil = readString(data, "contextoPerfil", {
    maxLength: 8000,
  });
  const dreamSessionId = readString(data, "dreamSessionId", {
    required: true,
    maxLength: 120,
  });

  await claimDreamSessionAction(
      uid,
      dreamSessionId,
      "emotionsExtracted",
      "Esta interpretacion ya extrajo sus emociones.",
  );

  try {
    const emociones = await obtenerEmocionesDesdeContexto(
        apiKey,
        descripcion,
        contextoPerfil,
    );
    return {emociones};
  } catch (error) {
    try {
      await releaseDreamSessionAction(uid, dreamSessionId, "emotionsExtracted");
    } catch (releaseError) {
      console.error("Error liberando emociones de sueno:", releaseError);
    }
    throw error;
  }
});

exports.findEmotionalPattern = aiFunction(async (
    data,
    apiKey,
    uid,
    authToken,
) => {
  const suenos = readStringArray(data, "suenos", {
    required: true,
    maxItems: 45,
    maxItemLength: 2500,
  });
  const periodo = readString(data, "periodo", {
    maxLength: 120,
  });
  const access = await getUserAccess(uid, authToken);

  assertPremiumAccess(access, "monthly-analysis");
  assertMonthlyEmotionalAnalysisDreamCount(suenos.length);

  const reservationId = await claimMonthlyEmotionalAnalysisQuota(uid);

  try {
    const text = await obtenerPatronEmocional(apiKey, suenos, periodo);
    await completeMonthlyEmotionalAnalysisQuota(
        uid,
        reservationId,
        suenos.length,
    );
    return {text};
  } catch (error) {
    try {
      await releaseMonthlyEmotionalAnalysisQuota(uid, reservationId);
    } catch (releaseError) {
      console.error("Error liberando analisis mensual:", releaseError);
    }
    throw error;
  }
});

async function sendPushNotification(token, message) {
  const expoPushEndpoint = "https://exp.host/--/api/v2/push/send";
  const payload = {
    to: token,
    sound: "default",
    title: "Reflexión del Día",
    body: message,
  };

  try {
    const response = await axios.post(
        expoPushEndpoint,
        payload,
        {
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
          },
        },
    );
    console.log("Notificación enviada:", response.data);
  } catch (error) {
    console.error("Error al enviar la notificación:", error);
  }
}

exports.dailyReflection = onSchedule(
    {
      schedule: "every 24 hours",
      timeZone: "UTC",
      region: REGION,
      secrets: [openaiApiKey],
    },
    async () => {
      let reflectionMessage;

      try {
        reflectionMessage = await obtenerReflexionDiaria(openaiApiKey.value());
      } catch (error) {
        console.error("Error al obtener la reflexión:", error);
        reflectionMessage =
          "Tómate un momento para observar cómo te sientes hoy.";
      }

      try {
        const usersSnapshot = await admin.firestore()
            .collection("users")
            .get();
        const sendNotifications = usersSnapshot.docs.map(async (doc) => {
          const data = doc.data();
          if (data.fcmToken) {
            return sendPushNotification(data.fcmToken, reflectionMessage);
          }

          console.log(`No hay token para el usuario ${doc.id}`);
          return null;
        });

        await Promise.all(sendNotifications);
        console.log("Notificaciones enviadas exitosamente.");
      } catch (error) {
        console.error("Error al enviar notificaciones:", error);
      }

      return null;
    },
);

exports.cleanupStaleAnonymousUsers = onSchedule(
    {
      schedule: "every 24 hours",
      timeZone: "UTC",
      region: REGION,
      timeoutSeconds: 540,
    },
    async () => {
      const cutoffMs = Date.now() -
        (ANONYMOUS_ACCOUNT_TTL_DAYS * DAY_IN_MS);
      let pageToken;
      let deletedCount = 0;

      do {
        const result = await admin.auth().listUsers(1000, pageToken);
        pageToken = result.pageToken;

        for (const userRecord of result.users) {
          try {
            const shouldDelete = await isStaleAnonymousUser(
                userRecord,
                cutoffMs,
            );

            if (!shouldDelete) continue;

            await deleteAnonymousAccount(userRecord.uid);
            deletedCount += 1;
          } catch (error) {
            console.error(
                `Error limpiando invitado ${userRecord.uid}:`,
                error,
            );
          }
        }
      } while (pageToken);

      console.log(
          `Cuentas invitadas antiguas borradas: ${deletedCount}.`,
      );

      return null;
    },
);
