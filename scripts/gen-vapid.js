// Generates a VAPID public/private key pair for Web Push.
// Run: npm run gen-vapid
// Then copy the two keys into your .env file.
import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();

console.log("\n  Add these to your .env:\n");
console.log("VAPID_PUBLIC_KEY=" + keys.publicKey);
console.log("VAPID_PRIVATE_KEY=" + keys.privateKey);
console.log("\n  (Keep the private key secret. The public key is safe to ship to the browser.)\n");
