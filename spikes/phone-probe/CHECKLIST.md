# Phone probe checklist (Phase 0)

Throwaway. Run on the iPhone against the probe at the pilot hostname while the probe is running. Results are recorded in `docs/feasibility.md`; the server also logs timings (no photos or audio) to its data folder.

Before starting: the probe operator gives you a one-time setup code.

## A. Safari

1. Open the probe URL in Safari. Note what the grey box at the top says.
2. Passkeys: enter the setup code and the label `iPhone`, tap **Create passkey**. Note what iOS shows (Face ID sheet, iCloud Keychain wording) and the result line.
3. Tap **Sign out**, then **Sign in with passkey**. Note whether the passkey sheet appears and the result.
4. Camera A: tap the file field, choose **Take Photo**, photograph a nutrition label. Note the resolution and size line, and whether you were asked for permission.
5. Camera B: tap **Start live camera** (allow access), point at a label, tap **Capture**. Note the resolution, whether focus was sharp, and the focus/torch line.
6. Voice: pick `large-v3-turbo`, press and hold **Hold to record**, say "Öğle yemeğinde iki yüz gram tavuk yedim", release. Note the transcript and the *release→result* time. Repeat 4 more times with different sentences, then twice with `small`.
7. Offline queue: add an entry `online 1`. Turn on Airplane Mode, add `offline 1` and `offline 2`. Note that they show as pending. Turn Airplane Mode off and bring the page back to the foreground. Note whether both were sent once.
8. Tap **Resend last** and confirm it reports `replayed true`.

## B. Installed app

9. Share → **Add to Home Screen**. Open it from the home screen. Note what the grey box says (should be *installed app*).
10. Is it already signed in (shared with Safari) or signed out? Note it.
11. Sign in with the passkey inside the installed app. Note the result.
12. Repeat one camera capture and one voice clip inside the installed app. Were permissions asked again?
13. Close the app fully, enable Airplane Mode, reopen it from the home screen. Does the page open? Add an entry, disable Airplane Mode, bring the app to the foreground. Was it sent once?

## C. Second credential and recovery

14. Add a second credential from a *different* authenticator (security key, or another device signing in to the same URL) while signed in, label it accordingly.
15. Remove the `iPhone` passkey from the list. Sign out. Sign in with the second credential. Note the result.
16. Tell the operator when finished so the probe is stopped and its credentials deleted. Delete the probe passkey from iOS Settings → Passwords afterwards.
