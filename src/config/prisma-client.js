// dotenv/config is a side-effect-only import — requiring it immediately reads the
// .env file and populates process.env before any other statement in this module runs.
// This is the shorthand equivalent of: require('dotenv').config()
// It is repeated here (env.js also calls it) because this file may be loaded in
// contexts where env.js hasn't been imported yet (e.g. Prisma CLI scripts, migrations).
require('dotenv/config');

// PrismaPg is the official Prisma driver adapter for the `pg` (node-postgres) package.
// Prisma 7 moved away from its own built-in DB drivers and now delegates low-level
// connection handling to native database drivers via the adapter pattern.
// Using the adapter gives access to pg's connection pooling, SSL config, and
// runtime features that Prisma's legacy built-in driver did not expose.
const { PrismaPg } = require('@prisma/adapter-pg');

// PrismaClient is the auto-generated query builder / ORM client.
// Its API (prisma.user.findMany, prisma.appointment.create, etc.) is derived from
// the models defined in prisma/schema.prisma and regenerated with `npm run prisma:generate`.
const { PrismaClient } = require('@prisma/client');

// Create the pg adapter with the PostgreSQL connection string from the environment.
// PrismaPg internally creates a pg.Pool, which manages a pool of reusable TCP
// connections to the database — opening a new connection per query would be far slower.
// connectionString is read directly from process.env here (not from env.js) because
// env.js imports this file, which would create a circular dependency.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

// Instantiate the Prisma client and wire it to the pg adapter.
// Passing { adapter } tells PrismaClient to delegate all query execution to PrismaPg
// instead of using its own built-in driver.
// This single instance is reused across the entire application — creating a new
// PrismaClient per request would exhaust the connection pool and cause performance issues.
const prisma = new PrismaClient({ adapter });

// Export the singleton so every module that needs DB access imports the same instance.
// Node's module cache ensures this file is only executed once per process lifetime,
// so `prisma` is a true singleton regardless of how many files import it.
module.exports = prisma;
