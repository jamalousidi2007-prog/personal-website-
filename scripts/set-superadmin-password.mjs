import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

function base64Url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signJwt({ clientEmail, privateKey, scope }) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: clientEmail,
    scope,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(data);
  signer.end();

  const signature = signer.sign(privateKey);
  return `${data}.${base64Url(signature)}`;
}

async function getAccessToken(serviceAccount) {
  const jwt = signJwt({
    clientEmail: serviceAccount.client_email,
    privateKey: serviceAccount.private_key,
    scope: [
      "https://www.googleapis.com/auth/identitytoolkit",
      "https://www.googleapis.com/auth/cloud-platform",
    ].join(" "),
  });

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: jwt,
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    throw new Error(`Failed to obtain access token: ${response.status} ${await response.text()}`);
  }

  const json = await response.json();
  return json.access_token;
}

async function firebaseRequest(url, accessToken, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Firebase request failed: ${response.status} ${text}`);
  }

  return text ? JSON.parse(text) : {};
}

async function main() {
  const [email, password] = process.argv.slice(2);

  if (!email || !password) {
    console.error("Usage: node scripts/set-superadmin-password.mjs <email> <password>");
    process.exit(1);
  }

  const serviceAccountPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    path.resolve(process.cwd(), "service-account.json");

  const raw = await fs.readFile(serviceAccountPath, "utf8");
  const serviceAccount = JSON.parse(raw);

  if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error("Service account JSON is missing project_id, client_email, or private_key.");
  }

  const accessToken = await getAccessToken(serviceAccount);
  const lookup = await firebaseRequest(
    `https://identitytoolkit.googleapis.com/v1/projects/${serviceAccount.project_id}/accounts:lookup`,
    accessToken,
    { email: [email] }
  );

  const user = lookup.users?.[0];
  if (!user?.localId) {
    throw new Error(`No Firebase Auth user found for ${email}.`);
  }

  await firebaseRequest(
    `https://identitytoolkit.googleapis.com/v1/projects/${serviceAccount.project_id}/accounts:update`,
    accessToken,
    {
      localId: user.localId,
      password,
      returnSecureToken: false,
    }
  );

  console.log(`Password updated for ${email}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
