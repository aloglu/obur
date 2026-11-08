# obur on Unraid

Two ways, depending on whether you want Speak and Scan:

- **obur only:** added through the Docker tab's form, like any other container. Updates appear on the Docker tab.
- **obur with Speak and Scan:** the three containers share a private network that Unraid's form cannot set up, so
  they are started together with the Docker Compose Manager plugin.

You can start with obur only and add Speak and Scan later; your data stays where it is.

## obur only

1. Make sure the array is started and Docker is enabled (**Settings → Docker**).
2. Open the **Docker** tab and click **Add Container**. Switch to **Advanced View** (top right).
3. Fill in:

   | Field | Value |
   | --- | --- |
   | Name | `obur` |
   | Repository | `ghcr.io/aloglu/obur:latest` |
   | Network Type | `Bridge` |
   | Privileged | Off |
   | Icon URL | `https://raw.githubusercontent.com/aloglu/obur/main/static/icon-512.png` |
   | WebUI | `http://[IP]:[PORT:8040]/` |
   | Extra Parameters | `--shm-size=256m --stop-timeout=60` |

4. Add a **Port**: name `Web`, container port `3000`, host port `8040` (or any free port), TCP.
5. Add two **Paths**:

   | Name | Container Path | Host Path |
   | --- | --- | --- |
   | Data | `/data` | `/mnt/cache/appdata/obur` (or `/mnt/user/appdata/obur` without a cache pool) |
   | Backups | `/data/backups` | a share on another disk if you have one, e.g. `/mnt/user/backups/obur` |

   The database is faster and safer on the cache pool (`/mnt/cache/…`) than through `/mnt/user/…`. If you have only
   one disk, leave out the Backups path; the backups then live inside the data folder.

6. Add **Variables**:

   | Name | Key | Value |
   | --- | --- | --- |
   | Address | `PUBLIC_ORIGIN` | the https address people open, e.g. `https://obur.example.com` |
   | Backup passphrase | `OBUR_BACKUP_PASSPHRASE` | a long phrase only you know; **save it in your password manager** |
   | Time zone | `TZ` | e.g. `Europe/Istanbul` |
   | Speak | `SPEECH_URL` | leave empty |
   | Scan | `LABELS_URL` | leave empty |

7. Click **Apply**, and turn on **Autostart** for the container.
8. Click the obur icon → **Logs**. obur prints a one-time link for the first account; open it on your phone once the
   https address works (see [Remote access](remote-access.md)), then follow [First start](first-start.md).

Updating: the Docker tab shows **update ready** next to obur; click it. A new first-account link: the obur icon →
**Console**, then `obur setup-link`.

## obur with Speak and Scan

1. Install **Docker Compose Manager** from **Apps** (Community Applications).
2. On the **Docker** tab, under **Compose**, click **Add New Stack**, name it `obur`.
3. Click the stack's gear → **Edit Stack** → **Compose File**, and paste the contents of
   [`deploy/compose.yaml`](../../deploy/compose.yaml).
4. Then **Env File**: paste [`deploy/.env.example`](../../deploy/.env.example) and fill in `PUBLIC_ORIGIN`,
   `OBUR_BACKUP_PASSPHRASE` and `TZ`. Add these lines so the data goes to appdata and the port is reachable from your
   network:

   ```dotenv
   OBUR_DATA_DIR=/mnt/cache/appdata/obur
   OBUR_BIND_ADDRESS=0.0.0.0
   ```

   and, with a second disk, `OBUR_BACKUP_DIR=/mnt/user/backups/obur`.
5. Click **Compose Up**. The stack's log shows the first-account link (as in step 8 above).

Updating: the stack's **Update Stack** button pulls the new images and restarts them.

## Adding Speak and Scan later

Stop and remove the obur container on the Docker tab (the appdata folder stays), then follow "obur with Speak and
Scan" with the same `OBUR_DATA_DIR`, backups folder, address and passphrase. obur opens the same database.

## Safety

The port is reachable from your home network. Do not forward it on your router: to reach obur from outside, see
[Remote access](remote-access.md). Keep **Privileged** off.
