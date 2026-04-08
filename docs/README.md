<p align="center">
    <img src="banner.png" alt="fxPanel">
</p>

# fxPanel

**fxPanel** is a full overhaul built on top of the existing [txAdmin](https://github.com/tabarra/txAdmin) codebase — a **full-featured web panel & in-game menu** to manage and monitor your FiveM/RedM server.

The goal is to retain full compatibility with existing txAdmin-based servers, allowing them to migrate with minimal or no changes.

## Features

Everything from txAdmin, plus ongoing improvements:

- **Recipe-based Server Deployer**: create a server in under 60 seconds ([docs](https://fxpanel.org/docs/recipes))
    - Private GitHub repository support via `$requiresGithubToken` recipes
    - Headless CLI mode for automated deployments
- **Start/Stop/Restart** your server instance or resources
- **Artifact Management**: Download and apply FXServer artifact builds directly from the panel
- **Full-featured in-game admin menu**:
    - Player Mode: NoClip, God, SuperJump
    - Teleport: waypoint, coords, back, or to players (`/tpm`, `/goto`)
    - Vehicle: Spawn, Fix, Delete, Boost
    - Heal: yourself, everyone, or within a configurable radius
    - Send Announcements, Reset World Area
    - Show player IDs with overhead tags
    - Player search/sort by distance, ID, name
    - Player interactions: Go To, Bring, Spectate, Freeze
    - Player troll: make drunk, set fire, wild attack
    - Player ban/warn/dm with editable ban durations
    - **Live Spectate**: Watch a player's screen in real-time from the web panel
    - **Screenshot Capture**: Built-in player screenshot (no `screenshot-basic` needed)
    - **Report System**: Player-initiated tickets (Player Report, Bug Report, Question) with admin review workflow and Discord notifications
- **Access control**:
    - Login via Cfx.re or password
    - Admin permission system with 40+ granular permissions and built-in presets ([docs](https://fxpanel.org/docs/permissions))
    - Per-admin statistics (bans, warns, kicks, revocations)
    - Action logging with structured JSONL system logger
- **Discord Integration**:
    - Server configurable, persistent, auto-updated status embed with customizable footer
    - Commands: `/status`, `/whitelist`, `/info` (public), `/admininfo` (admin-only)
    - Admin channel notifications for player reports, bans, crashes, whitelist requests
- **Monitoring**:
    - Auto Restart FXServer on crash or hang
    - Server CPU/RAM consumption
    - Live Console with block-based buffer, lazy-load older output, persistent clear, timestamp options, and jump-to-server-start
    - Server threads performance chart with player count, FXS/Node memory toggles, and pan navigation
    - Server Activity Log (connections, disconnections, kills, chat, explosions and [custom commands](https://fxpanel.org/docs/logs))
    - Per-resource runtime performance stats (CPU, memory, tick time)
- **Insights / Analytics Dashboard**:
    - Player count timeline with memory usage (up to 96h)
    - New players per day, cumulative growth, retention metrics (1d/7d/30d)
    - Top players by playtime, playtime distribution histogram
    - Peak hours heatmap (day-of-week x hour-of-day)
    - Admin actions timeline, session length distribution
    - Server uptime timeline and disconnect reasons
- **Player Manager**:
    - Warning & Ban system with editable durations and `players.delete` for data management
    - Whitelist system (Discord member, Discord Role, Approved License, Admin-only)
    - Player tags: auto-tags (Staff, Problematic, Newcomer) + up to 20 custom server-defined tags with resource exports
    - Player Activity tab with 28-day heatmap, peak hours, per-hour breakdown
    - Player Insights tab with identifier change detection, risk assessment, name history
    - Notes, play time tracking, session history
    - Self-contained player database (no MySQL required)
    - Database cleanup tools for old players, bans, warns, whitelists
- **Real-time playerlist** with fuzzy search, tag-based filtering and coloring
- Scheduled restarts with precision minute-boundary timing, postponable temp schedules, and warning announcements ([docs](https://fxpanel.org/docs/events))
- Translated into over 30 languages ([docs](https://fxpanel.org/docs/translation))
- FiveM Server CFG editor & validator
- Responsive web interface with Dark Mode

## Migrating from txAdmin

fxPanel is designed as a drop-in replacement. Existing `txData` directories, databases, configs, and server resources should work without modification.

## Running fxPanel

1. Replace the monitor folder in your FXServer artifacts with the fxPanel build.
2. Run FXServer **without** any `+exec server.cfg` launch argument - fxPanel will start automatically.
3. On first boot, open the URL provided in the console to configure your account and server.

## Configuration & Integrations

- Most configuration is available in the fxPanel settings page. Some options (TCP interface, port, etc.) are only available through Environment Variables - see the [Configuration docs](https://fxpanel.org/docs/configuration).
- You can listen to server events broadcasted by fxPanel to add custom behavior in your resources - see the [Events docs](https://fxpanel.org/docs/events).

## Contributing & Development

- All PRs should be based on the develop branch, including translation PRs.
- Before starting any significant PR, join the Discord and discuss it first.
- To build or run from source, see the [Development docs](https://fxpanel.org/docs/development).

## License, Credits and Thanks

- This project is licensed under the [MIT License](LICENSE).
- Originally created by [tabarra](https://github.com/tabarra) as [txAdmin](https://github.com/tabarra/txAdmin).
- Special thanks to everyone who contributed, especially the Discord community.
