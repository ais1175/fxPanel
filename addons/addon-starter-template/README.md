# addon-starter-template

A minimal fxPanel addon template to help you get started quickly. This addon demonstrates:

- **Server routes** — Authenticated GET/POST endpoints
- **Storage** — Persistent key-value data
- **Events** — Listening for game events (player join/drop)
- **WebSocket push** — Real-time updates to the panel
- **Panel page** — Full page in the sidebar
- **Panel widget** — Dashboard widget

## Getting Started

1. Copy this entire `addon-starter-template/` directory
2. Rename the folder to your addon's ID (e.g. `my-cool-addon`)
3. Update `addon.json` with your addon's details (id, name, description, author)
4. Modify `server/index.js` to add your server-side logic
5. Modify `panel/index.js` to build your panel UI
6. Restart fxPanel and approve your addon from the Addons page

## File Structure

```
addon-starter-template/
├── addon.json           ← Manifest (metadata, permissions, entry points)
├── package.json         ← Must have "type": "module"
├── README.md            ← This file
├── server/
│   └── index.js         ← Server-side code (runs in isolated child process)
└── panel/
    └── index.js         ← Panel UI components (React, loaded at runtime)
```

## Customization Checklist

- [ ] Rename the directory and update `addon.json` → `id`
- [ ] Update name, description, author, and version in `addon.json`
- [ ] Adjust `permissions.required` and `permissions.optional`
- [ ] Update `panel.pages[].component` names to match your exports
- [ ] Update `panel.widgets[].component` names to match your exports
- [ ] Update `ADDON_ID` constant in `panel/index.js`
- [ ] Replace `API_BASE` path in `panel/index.js`

## Tips

- React is available globally — do NOT bundle it in your panel entry
- Always call `addon.ready()` at the end of your server entry
- Use `addon.log.info/warn/error()` instead of `console.log`
- Check permissions in route handlers with `req.admin.hasPermission('perm')`
- Use `addon.storage.getOr(key, default)` for safe defaults
- Use wildcard routes (`/*`) for SPA catch-all patterns

## License

MIT
