# Lightweight React Template for KAVIA

This project provides a minimal React template with a clean, modern UI and minimal dependencies.

## Features

- **Lightweight**: No heavy UI frameworks - uses only vanilla CSS and React
- **Modern UI**: Clean, responsive design with KAVIA brand styling
- **Fast**: Minimal dependencies for quick loading times
- **Simple**: Easy to understand and modify

## Getting Started

In the project directory, you can run:

### `npm start`

Runs the app in development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

### `npm test`

Launches the test runner in interactive watch mode.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

## API Base Configuration

The frontend expects a FastAPI backend running in previews at port 3001. The base URL is discovered in code via `REACT_APP_API_BASE` or falls back to the preview URL.

- To override locally, create `.env` in `career_navigator_frontend` (see `.env.example`):
```
REACT_APP_API_BASE=http://localhost:3001
```
- Ensure the backend starts with SQLite seeding on first run and CORS allows `http://localhost:3000`.
- If roles/skills do not render:
  - Verify `REACT_APP_API_BASE` points to your backend preview URL.
  - Open the browser console to ensure no CORS or network errors. The API client will warn if default base is used.
  - Visit `${REACT_APP_API_BASE}/docs` to confirm the backend endpoints.

## End-to-End Verification Checklist

1) Roles load on Dashboard
- Visit `/`
- RoleSelector should call `GET /roles` and preselect "Chief Architect" → "CTO" if present.

2) Navigate to Roadmap
- Click "Generate Roadmap" to go to `/roadmap?fromRole=<id>&toRole=<id>`.

3) Graph renders with pan/zoom/reset
- Graph component requests `GET /graph?fromRole=&toRole=`.
- D3 force layout runs; use mouse wheel/pan to zoom; use "Reset Zoom" button to reset.

4) ProgressPanel reflects and updates status
- Progress panel fetches role detail (`GET /roles/{name}`) and `GET /roles/{name}/progress`.
- Change a status (e.g., "Business & Product" to "working_on"); it POSTs to `/roles/{name}/progress?skill_name=&status=&current_level=` and the UI updates.

5) Recommendations list loads
- Recommendations pane calls `GET /recommendations?roleId=&skillId=` with either provided skill or first role skill, showing at least sample items for the CTO "Business & Product" skill.

## Troubleshooting

- If `/roles` returns empty:
  - Confirm backend started and seeded SQLite (`on_startup` seeds the minimal dataset when no roles exist).
- CORS error:
  - Ensure backend has `allow_origins=["http://localhost:3000"]` and you are accessing the correct preview origin.
- Network errors:
  - Verify `REACT_APP_API_BASE` and that port 3001 is reachable.
- Graph shows mock data:
  - This occurs when `/graph` is unreachable; fix API base and retry.

## Customization

### Colors

The main brand colors are defined as CSS variables in `src/App.css`:

```css
:root {
  --kavia-orange: #E87A41;
  --kavia-dark: #1A1A1A;
  --text-color: #ffffff;
  --text-secondary: rgba(255, 255, 255, 0.7);
  --border-color: rgba(255, 255, 255, 0.1);
}
```

### Components

This template uses pure HTML/CSS components instead of a UI framework. You can find component styles in `src/App.css`. 

Common components include:
- Buttons (`.btn`, `.btn-large`)
- Container (`.container`)
- Navigation (`.navbar`)
- Typography (`.title`, `.subtitle`, `.description`)

## Learn More

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
