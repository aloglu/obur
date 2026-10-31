// Prints a new Web Push key pair for reminders, as lines for the server's .env (npm run push:keys). Keep the private
// key secret; changing the keys later means every device must turn reminders on again.
import webpush from 'web-push';

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log('# A contact for the push services, e.g. mailto:you@example.com');
console.log('VAPID_SUBJECT=mailto:change-me@example.com');
