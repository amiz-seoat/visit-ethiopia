# Visit Ethiopia

**Visit Ethiopia** is a full-stack travel and tour web application that allows users to explore various tours across Ethiopia. Users can view detailed tour information, pricing, available transportation, and book their trips.

 

## Features
- Browse available tours with detailed descriptions
- View pricing, transportation options, and itinerary
- User registration and login
- Book tours (future payment integration)
- Admin panel to manage tours
- Responsive design for desktop and mobile

## Tech Stack
- **Frontend:** React.js, Tailwind CSS
- **Backend:** Node.js, Express.js
- **Database:** MongoDB with Mongoose
- **Authentication:** JWT (JSON Web Tokens)
- **Styling:** Tailwind CSS

## Installation

1. **Clone the repository**
```bash
git clone https://github.com/your-username/visit-ethiopia.git
cd visit-ethiopia

## Integrating frontend and backend (local)

Follow these steps to run the fullstack app locally and integrate frontend with backend:

1. Backend setup
	- Copy the example env file in the backend folder and edit values:
	  - `cd visit-ethiopia-backend-defence`
	  - Copy `config.env.example` to `config.env` and fill `DATABASE`, `JWT_SECRET`, etc.
	- Install and start backend:
	  ```powershell
	  cd visit-ethiopia-backend-defence
	  npm install
	  npm run dev   # uses nodemon server.js, default port 3000
	  ```

2. Frontend setup
	- Copy the Vite env example and point it to your backend:
	  ```powershell
	  cd visit-eth-front
	  copy .env.example .env
	  # Edit .env if you want a different backend port
	  npm install
	  npm run dev   # runs vite on port 5173 by default
	  ```

3. Verify endpoints and CORS
	- The backend `app.js` already allows `http://localhost:5173` (Vite dev) and the production frontend origin.
	- Frontend `src/api/axios.ts` uses `VITE_BACKEND_URL` with a default of `http://localhost:3000/api/v1/users` so the auth calls (`/login`, `/signup`, etc.) map correctly to backend routes.

4. Notes about cookies & tokens
	- The backend sets a cookie named `jwt` with `SameSite=None; secure` in production; for local dev you may prefer to rely on the Authorization header stored in localStorage (the frontend already stores the token on login).
	- If you want cookie auth to work locally over HTTP, change cookie `secure` conditionally in `authController.createSendToken` (set `secure: process.env.NODE_ENV === 'production'`).

5. Health-check
	- Backend exposes a simple `/` route that returns `API is working`.
	- Swagger docs are available at `/api/v1/api-docs` when backend is running.

If you'd like I can make the cookie `secure` flag conditional for you, add a small health-check script, or create a single npm script to run both frontend and backend concurrently.
