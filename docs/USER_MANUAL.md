# Live Psalms — User & Operator Manual

**Prepared by:** FrankSpace_KE  
**Application:** Live Psalms (Church Presentation, Worship & Scripture Projection)  
**Supported Platforms:** Windows 10/11 & Ubuntu / Debian Linux  

---

## 1. Welcome & Getting Started

**Live Psalms** is designed for church media teams, worship leaders, and pastors to project lyrics, Bible verses, announcements, videos, and sermon notes smoothly across multiple displays.

### Installing the Application
- **Windows:** Run `LivePsalms-Setup.exe` (standard installer) or `LivePsalms-Windows-Portable.exe` (no installation required).
- **Ubuntu / Debian Linux:** Install the `.deb` package and launch from your application menu or terminal:
  ```bash
  sudo dpkg -i LivePsalms-Ubuntu-amd64.deb
  live-psalms
  ```

### First-Time Setup
1. Click **Settings** (gear icon in the top-right header).
2. Set your **Church Profile** (Church Name, Tagline, Logo image, and Logo size).
3. Go to **Displays & Outputs** and click **Detect Displays** to map:
   - **Audience Output (Main Projector)** → Congregation projector/TV
   - **Stage Confidence Monitor** → Stage/back-of-hall monitor
   - **LED Wall Display** → LED wall processor (if used)

---

## 2. Main Workspace Tour

The operator screen is divided into five areas:
1. **Top Header:** Quick Mode, Sermon Mode, Slide Canvas, Output toggles (**Audience**, **Stage**, **LED Wall**), **Stream**, Export/Import Service Package, and **Settings**.
2. **Left Panel (Service Playlist):** Your ordered service items (songs, scriptures, announcements, media). Drag or use arrows to reorder; click an item to load its slides.
3. **Bottom-Left / Library Tabs:** Browse **Songs**, **Bibles** (45 offline translations), **Media/Backgrounds**, and **Themes**.
4. **Center Workspace:**
   - **Dual Monitors:** **Preview** (left) and **Program / ON AIR** (right).
   - **Slide Grid & Section Tags:** Click a slide to preview, double-click or press `Enter` to send Live.
   - **Quick Pins:** Pin frequently used songs or specific Bible verses for instant 1-click recall.
5. **Right Inspector & Bottom Control Bar:** Edit slide theme/notes, manage **Countdown Timer**, send **Stage Messages**, trigger **Parent/Nursery Alerts**, and control **Emergency Overrides** (**Black**, **Clear**, **Logo**, **Freeze**, **Stop Media**).

---

## 3. Running a Live Service

### Projecting Worship Songs
1. Open the **Songs** tab in the Library (or use `Ctrl+K` / `Cmd+K` for Global Search).
2. Click **Add to Playlist** or open a song directly.
3. Use section buttons (**Intro**, **Verse 1**, **Chorus**, **Bridge**, etc.) or arrow keys to step through lyrics live.
4. To edit lyrics or add a new song, click **New Song** or the edit icon on any song.

### Projecting Scripture (45 Offline Translations)
Live Psalms includes **45 offline Bible translations** (including English BSB, KJV, NKJV, NIV, ESV, NLT, AMP, plus Swahili `SUV`/`RSUV`, Kalenjin, Kamba, Kikuyu, Luo, and Maasai).
1. Open the **Bibles** tab or click **Book & Verse** to pick a Book, Chapter, and Verse.
2. **Single-Verse Actions:** Clicking **Live**, **Pin**, or **Translate** on a specific verse row applies only to that verse (without pulling in the whole chapter).
3. **Parallel Translations:** Select a secondary translation to project two languages side by side.

### Themes, Backgrounds & Media
- **Themes:** Choose from worship-inspired themes in the **Themes** tab to change font, alignment, scrim darkness, blur, and lower-third style.
- **Backgrounds:** Apply still images or looping motion videos at the **Global**, **Item**, or **Single Slide** level (or drag & drop onto the Program monitor).
- **User Uploads Persistence:** Uploaded videos, images, audio, and church logos are saved locally in your browser/app `IndexedDB` (`mediaVault`) and `localStorage` so they remain available across restarts.
- **Media Transport Bar:** When playing a full-screen video or audio track, use the bottom transport bar to Play/Pause, Seek, Loop, Adjust Volume, or change Playback Speed.

---

## 4. Stage Monitor Modes (Near vs. Far)

You can configure the Stage Monitor for your room layout in **Settings → Displays & Outputs → Stage Display Mode**:

| Mode | Best For | What Appears on Screen |
| :--- | :--- | :--- |
| **Near Stage (Confidence)** | Monitors close to the stage/pulpit | Current Live Slide, Upcoming Next Slide, Speaker/Stage Notes, and top Clock/Countdown bar. |
| **Far Stage (Slide & Counter Focus)** | Screens at the back of a large hall or balcony | High-contrast midnight layout focused on the **Live Slide** (auto-scaled to fit), **Giant Counter/Clock**, and prominent **Book, Verse & Translation** badges. |

> **Tip:** All output windows (**Audience**, **Stage**, **LED Wall**) open borderless and full-screen automatically. Double-click any output window to toggle fullscreen manually if needed.

---

## 5. Timers, Alerts, OBS & Live Streaming

- **Countdown Timer & Clock-Linked Events:** Open the **Timer & Clock Options** (gear icon next to the timer in the Bottom Control Bar) to:
  - Toggle **Full-Slide** countdown projection on Audience, Stage, or Both.
  - Pick an event heading (**Service**, **New Year**, **Worship**, **Sermon**, **Conference**, **Break**, **Prayer**) or type your own **Active Heading** and **When 00:00 Reached** text and click **+ Save** to reuse it anytime.
  - Switch to **System Clock Target** using **Midnight**, **New Year (Jan 1, 00:00)**, **Next Hour**, or a custom date/time picker so the timer counts down accurately against your computer's system clock.
- **Stage Messages:** Send instant text cues (with optional Flash) directly to the Stage Monitor without appearing on the Audience screen.
- **Parent / Nursery Pager Alerts:** Enter a pager code in the Bottom Control Bar to display a non-intrusive corner alert on the Audience screen.
- **Announcement Ticker:** Trigger a scrolling lower-third announcement bar across the bottom of the Audience screen.
- **OBS Studio Integration:**
  - **Browser Source:** Add `http://<YOUR-LAN-IP>:8080/?output=obs` in OBS (supports transparent background in Settings).
  - **Direct Text Files:** Live Psalms automatically writes `live_title.txt`, `live_slide.txt`, `live_subtitle.txt`, `live_combined.txt`, and `lower_third.txt` to `~/Documents/LivePsalms-OBS`.
- **RTMP Live Streaming:** Click **Stream** in the header, enter your YouTube/Facebook/Twitch RTMP URL & Stream Key (requires `ffmpeg` installed on your computer), and click Start Stream.

---

## 6. Keyboard Shortcuts Quick Reference

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + K` / `Cmd + K` | Open Global Search (Songs, Bible, Media) |
| `Enter` | Send Preview Slide Live |
| `Space` / `Right Arrow` / `Down Arrow` | Advance to Next Slide |
| `Left Arrow` / `Up Arrow` | Go to Previous Slide |
| `1` – `9` | Jump to Slide 1–9 in current item |
| `Alt + Down` / `Alt + Up` | Switch to Next / Previous Playlist Item |
| `B` | Toggle **Black** Screen |
| `Esc` | Toggle **Clear** Text (keep background) |
| `L` | Toggle **Logo** Screen |
| `F` | Toggle **Freeze** Output |

---

*© FrankSpace_KE — Live Psalms Presentation System*
