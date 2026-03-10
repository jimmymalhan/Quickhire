# Quickhire - Setup & Installation Guide

## Prerequisites

Before setting up Quickhire, ensure you have the following installed:

| Software | Minimum Version | Purpose |
|----------|----------------|---------|
| Node.js | 18.x+ | Runtime environment |
| npm | 9.x+ | Package manager |
| PostgreSQL | 14+ | Primary database |
| Redis | 7+ | Caching & job queue |
| Git | 2.30+ | Version control |

### Optional Tools
- **Docker** (24+): For containerized development
- **pgAdmin** or **DBeaver**: Database GUI
- **Redis Insight**: Redis GUI
- **Postman** or **Insomnia**: API testing

---

## 1. Clone the Repository

```bash
git clone https://github.com/quickhire/quickhire-auto-apply.git
cd quickhire-auto-apply
```

---

## 2. Install Dependencies

```bash
npm install
```

This installs all backend and frontend dependencies defined in `package.json`.

---

## 3. Environment Configuration

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` with the following required values:

```env
# Server
NODE_ENV=development
PORT=8000
FRONTEND_URL=http://localhost:3000

# Database (PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=quickhire_dev
DB_USER=your_db_user
DB_PASSWORD=your_db_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# LinkedIn OAuth
LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret
LINKEDIN_REDIRECT_URI=http://localhost:8000/auth/linkedin/callback

# JWT
JWT_SECRET=generate_a_strong_secret_here
JWT_EXPIRES_IN=7d

# Encryption
ENCRYPTION_KEY=generate_a_32_byte_hex_key

# Logging
LOG_LEVEL=debug
```

### Generating Secrets

```bash
# Generate JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Generate encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### LinkedIn Developer Setup

1. Go to [LinkedIn Developer Portal](https://developer.linkedin.com/)
2. Create a new application
3. Under "Auth" tab, add redirect URL: `http://localhost:8000/auth/linkedin/callback`
4. Copy Client ID and Client Secret to your `.env`
5. Request the following OAuth scopes: `r_liteprofile`, `r_emailaddress`, `w_member_social`

---

## 4. Database Setup

### Create the Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database and user
CREATE DATABASE quickhire_dev;
CREATE USER quickhire_user WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE quickhire_dev TO quickhire_user;
\q
```

### Run Migrations

```bash
npm run db:migrate
```

### Seed Demo Data (optional)

```bash
npm run db:seed
```

---

## 5. Redis Setup

### macOS (Homebrew)

```bash
brew install redis
brew services start redis
```

### Ubuntu/Debian

```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis
sudo systemctl enable redis
```

### Verify Redis

```bash
redis-cli ping
# Expected: PONG
```

---

## 6. Start the Application

### Development Mode (with hot reload)

```bash
npm run dev
```

This starts:
- **Backend API**: http://localhost:8000
- **Frontend**: http://localhost:3000

### Production Mode

```bash
npm run build
npm start
```

---

## 7. Verify Installation

### Health Check

```bash
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "success",
  "data": {
    "server": "running",
    "database": "connected",
    "redis": "connected"
  }
}
```

### Run Tests

```bash
npm test
```

---

## 8. Docker Setup (Alternative)

If you prefer Docker:

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

The `docker-compose.yml` includes PostgreSQL, Redis, and the application.

---

## Common Setup Issues

### Port Already in Use

```bash
# Find process using port 8000
lsof -i :8000
# Kill it
kill -9 <PID>
```

### PostgreSQL Connection Refused

- Verify PostgreSQL is running: `pg_isready`
- Check credentials in `.env`
- Ensure the database exists: `psql -l | grep quickhire`

### Redis Connection Failed

- Verify Redis is running: `redis-cli ping`
- Check REDIS_HOST and REDIS_PORT in `.env`

### Node Version Mismatch

```bash
# Use nvm to switch versions
nvm install 18
nvm use 18
```

### LinkedIn OAuth Errors

- Verify redirect URI matches exactly (including trailing slashes)
- Ensure OAuth scopes are approved
- Check that Client ID and Secret are correct

---

## Next Steps

- Read [CONTRIBUTING.md](../CONTRIBUTING.md) to start developing
- See [API.md](./API.md) for API reference
- Check [TESTING.md](./TESTING.md) for running tests
- Review [DEPLOYMENT.md](./DEPLOYMENT.md) for production setup

---

**Last Updated**: 2026-03-09
