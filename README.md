# FIKA Apps

A suite of interactive mapping applications for Fika.

## Features

- **Waternet Map**: Visualize water network data
- **SAI Map**: Safe Access Index visualization tool
- **Impact Map**: Bridge location and impact visualization with PostgreSQL integration

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   - Copy `.env.local.example` to `.env.local`
   - Add your database connection string

## Database Setup

The Impact Map requires a PostgreSQL database connection. The database should have a `bridges` table with the following fields:

- `id`: Bridge ID
- `name`: Bridge name
- `bridge_type`: Type of bridge (e.g., suspended, trail bridge)
- `year_completed`: Year the bridge was completed
- `latitude`: Latitude coordinate
- `longitude`: Longitude coordinate
- `span_length`: Bridge span length in meters
- `communities_served`: Number of communities served
- `people_served`: Number of people served

## Developing

Start the development server:

```bash
npm run dev

# or open in browser automatically
npm run dev -- --open
```

## Building

Create a production version:

```bash
npm run build
```

Preview the production build with `npm run preview`.

## Deployment

Uses Node v.22. Note that this will need to be updated before April 2027 when this version stops receiving support.

The application is configured for Vercel deployment. Add the following environment variables in Vercel:

- `DATABASE_URL`: PostgreSQL connection string
