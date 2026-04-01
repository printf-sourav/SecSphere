# SecSphere VS Code Extension

SecSphere scans the current file or the full workspace using your backend API and shows findings with in-editor fix actions.

## Railway Backend Setup

If your backend is deployed on Railway, configure the extension to call that URL instead of localhost.

1. Deploy backend and copy your public API base URL.
	 - Example: `https://your-service.up.railway.app/api`
2. Open VS Code Settings.
3. Search for `aiSecurityReviewAgent.apiBaseUrl`.
4. Set it to your Railway API base URL.
5. Run extension command: `Scan Current File` or `Scan Workspace`.

Notes:
- If your backend is still local, keep default: `http://localhost:5000/api`.
- If you set full scan URL ending in `/scan`, extension accepts that too.

## Extension Settings

- `aiSecurityReviewAgent.apiBaseUrl`
	- Backend API base URL used by the extension.
	- Default: `http://localhost:5000/api`

