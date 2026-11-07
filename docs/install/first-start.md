# First start and inviting people

## The first account

On its first start obur prints a one-time link in its log (valid for 24 hours, works once):

```
obur: no account exists yet. Open this link on the device you will use first …
https://obur.example.com/setup#…
```

Open it on your phone, choose your name and create a passkey. You are the household's admin. If the link expired
or got lost, make a new one: `docker exec obur obur setup-link` (on Unraid or TrueNAS, `obur setup-link` in the
container's console or shell).

Then save the **recovery codes** obur shows you somewhere safe: they let you back in if you lose your phone.

## Installing it as an app

- **iPhone:** open the address in Safari → Share → **Add to Home Screen**.
- **Android:** open it in Chrome → menu → **Install app**.

## Inviting people

Household → **Invite someone** gives a link for one person. They open it on their phone and create their own
passkey; nobody needs a password.

## Someone lost every passkey and recovery code

Make a recovery link for them (valid for an hour, works once):

```bash
docker exec obur obur recovery-link "Their name"
```

## Check the backups

Household → **Backups** shows when the last backup ran and whether the weekly restore check passed. It warns while
there is no off-site copy; see the off-site lines in `.env`.
