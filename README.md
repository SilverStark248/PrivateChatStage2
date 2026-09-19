# PrivateChat — Stage 1

A two-person real-time chat MVP built with:

- ASP.NET Core 9 Web API + SignalR
- Entity Framework Core + SQLite
- React + Vite
- SignalR JavaScript client

## Important

Stage 1 is NOT end-to-end encrypted and does NOT provide production-grade authentication.
It is the foundation for Stage 2, where we add:

- IndexedDB offline queue
- automatic retry/reconnect
- low-data mode
- client-side encryption / E2EE
- proper authentication and authorization

## Requirements

- .NET 9 SDK
- Node.js 20+ recommended
- npm

## Run the backend

```cmd
cd server\PrivateChat.API
dotnet restore
dotnet run
```

The API will normally be available at:

- http://localhost:5180
- https://localhost:7180

The exact ports are also printed by `dotnet run`.

## Run the frontend

Open a second terminal:

```cmd
cd client
npm install
npm run dev
```

Open the URL shown by Vite, normally:

http://localhost:5173

## Test two users

1. Open the site in your normal browser.
2. Enter `You` and join.
3. Open an Incognito/InPrivate window.
4. Enter `Her` and join.
5. Send messages between the two windows.

Both windows can use the same fixed private room in this Stage 1 MVP.

## Database

SQLite database:

`server\PrivateChat.API\Data\privatechat.db`

The database is created automatically when the server starts.

## Stage 1 limitations

This is a development MVP. Anyone who can reach the server can potentially connect because there is no real authentication yet. Do not deploy this publicly as a private communication service.



## Jenna-inspired theme

The client now uses a dark cinematic aesthetic inspired by Jenna Marie Ortega's public screen persona:
black/charcoal surfaces, restrained deep-red accents, serif display typography, subtle grain, and a JMO-style monogram.
It does not use her photographs, logos, or imply that the site is official or endorsed by her.

## Important before deployment

This Stage 1 build is a prototype. It is NOT yet suitable for sending as a truly private production chat.
Before putting it on the public internet, Stage 2/3 should add:
- HTTPS
- real authentication/invitations
- server-side authorization
- offline message queue and retry
- end-to-end encryption
- production database/backups
- rate limiting and abuse protection

For the current local build, the server uses SQLite and the browser connects to localhost.
