# Luz API

A comprehensive Node.js + TypeScript API for Luz, a platform that allows studios (like ceramic teachers) to create weekly or one-time slots for customers or children to book.

## 🚀 Features

- **Complete CRUD operations** for studios, customers, children, slots, and bookings
- **Public booking API** for customer-facing interfaces
- **Payment tracking** with multiple payment methods
- **Simple authentication** with API keys
- **Rate limiting** and request logging
- **Comprehensive monitoring** and health checks
- **Type-safe** with TypeScript and Zod validation
- **Test-ready** with Vitest and transaction isolation

## 📊 Database Schema

- **Studios**: Platform accounts for ceramic teachers, art studios, etc.
- **Customers**: Adult users who can book slots or register children
- **Children**: Child profiles linked to customer accounts
- **Slots**: Time slots that can be booked (one-time or recurring)
- **Bookings**: Reservations for specific slots (customer or child)
- **Invites**: Secure booking links sent to customers

## 🔧 Setup

### Prerequisites
- Node.js 20+
- PostgreSQL (via Supabase)
- pnpm

### Local Development
```bash
# Install dependencies
pnpm install

# Start local Supabase (includes PostgreSQL)
supabase start

# Run migrations
supabase db reset

# Start development server
pnpm dev

# Run tests
pnpm test

# Check types
pnpm type-check

# Format code
pnpm format
```

### Environment Variables
```bash
# Development
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres

# Authentication
API_KEYS=dev-key-123,studio-key-456

# Production
NODE_ENV=production
PORT=3000
```

## 📝 API Documentation

### Authentication

All endpoints except `/public/*` and `/health` require an API key:

```bash
# Using header
curl -H "X-API-Key: dev-key-123" http://localhost:3000/studios

# Using Authorization header
curl -H "Authorization: Bearer dev-key-123" http://localhost:3000/studios
```

### Studios

#### `POST /studios`
Create a new studio.

```json
{
  "slug": "ceramic-studio",
  "name": "Ceramic Art Studio",
  "timezone": "Asia/Jerusalem",
  "currency": "ILS"
}
```

### Customers

#### `POST /studios/:studioId/customers`
Create a new customer for a studio.

```json
{
  "firstName": "Sarah",
  "contactEmail": "sarah@example.com",
  "contactPhone": "+972501234567"
}
```

#### `GET /studios/:studioId/customers`
List all customers for a studio with child and booking counts.

#### `GET /customers/:id`
Get customer details with children and booking history.

#### `PATCH /customers/:id`
Update customer information.

#### `DELETE /customers/:id`
Delete customer (cascades to children and bookings).

### Children

#### `POST /customers/:customerId/children`
Create a new child for a customer.

```json
{
  "firstName": "Emma",
  "avatarKey": "emma-avatar.jpg"
}
```

#### `GET /customers/:customerId/children`
List all children for a customer.

#### `GET /children/:id`
Get child details with customer and booking info.

#### `PATCH /children/:id`
Update child information.

#### `DELETE /children/:id`
Delete child (cascades to bookings).

### Slots

#### `POST /studios/:studioId/slots`
Create a new time slot.

```json
{
  "title": "Kids Pottery Class",
  "startsAt": "2024-01-15T10:00:00Z",
  "durationMin": 90,
  "price": 80,
  "minParticipants": 2,
  "maxParticipants": 8,
  "forChildren": true,
  "recurrenceRule": "FREQ=WEEKLY;BYDAY=MO"
}
```

### Bookings

#### `POST /bookings`
Create a direct booking (admin/studio use).

```json
{
  "slotId": "slot-uuid",
  "customerId": "customer-uuid"
}
```

#### `GET /bookings`
List bookings with optional filters:
- `studioId`, `customerId`, `childId`, `slotId`
- `status`, `paid`
- `limit`, `offset` for pagination

#### `GET /bookings/:id`
Get detailed booking information.

#### `PATCH /bookings/:id/payment`
Mark booking as paid.

```json
{
  "paidMethod": "cash",
  "paidAt": "2024-01-15T10:30:00Z"
}
```

#### `PATCH /bookings/:id/status`
Update booking status.

```json
{
  "status": "CONFIRMED"
}
```

#### `DELETE /bookings/:id`
Cancel/delete a booking.

### Public API (No auth required)

#### `GET /public/:slug/slots?week=2024-W03`
Get available slots for a studio by week.

#### `POST /public/invites/:hash/bookings`
Create a booking using an invite link.

```json
{
  "slotId": "slot-uuid",
  "child": {
    "firstName": "Emma",
    "avatarKey": "emma-avatar.jpg"
  }
}
```

### Invites

#### `POST /studios/:studioId/invites`
Create an invite for a customer.

```json
{
  "firstName": "Sarah",
  "contactEmail": "sarah@example.com"
}
```

### Admin & Monitoring

#### `GET /health`
Basic health check.

#### `GET /admin/health`
Detailed health check with database latency.

#### `GET /admin/metrics`
System metrics including:
- Entity counts (studios, customers, bookings, etc.)
- Booking statistics by status
- Revenue metrics (last 30 days)
- Popular studios
- System uptime and memory usage

#### `GET /admin/database/status`
Database-specific metrics:
- Database size and connection info
- Table sizes
- Active connections

## 🧪 Testing

The API includes comprehensive test infrastructure:

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run in watch mode
pnpm test:watch

# Run tests with UI
pnpm test:ui
```

### Test Database

Tests use transaction isolation for speed and reliability:
- Each test runs in its own transaction
- Automatic rollback after each test
- No test pollution between runs

## 🚀 Deployment

### Docker Build
```bash
# Build image
docker build -t malshinim/luzapi:latest .

# Push to registry
docker push malshinim/luzapi:latest
```

### Kubernetes Deployment
```bash
# Deploy to k3s
kubectl apply -f helm/luz-api/
```

### GitHub Actions
The CI/CD pipeline automatically:
1. Runs tests with PostgreSQL service
2. Builds and pushes Docker image
3. Deploys to k3s cluster

## 📈 Performance & Monitoring

### Rate Limiting
- Production: 60 requests/minute per API key
- Development: 200 requests/minute

### Logging
All requests are logged with:
- Method, URL, status code
- Response time
- API key (masked)
- User agent and IP

### Error Handling
- Zod validation with detailed error messages
- Global error handler with environment-aware responses
- Database connection error handling

## 🔒 Security

- **API Key Authentication**: Required for all admin endpoints
- **Input Validation**: Zod schemas for all request bodies
- **SQL Injection Protection**: Parameterized queries
- **Rate Limiting**: Prevent abuse
- **Request Logging**: Audit trail

## 🎯 Next Steps

### Completed ✅
- Complete CRUD operations for all entities
- Comprehensive booking management
- Authentication and authorization
- Monitoring and metrics
- Type safety with TypeScript
- Fixed booking ID type consistency
- ESLint configuration

### Potential Improvements
- [ ] JWT-based authentication for better security
- [ ] WebSocket support for real-time updates
- [ ] Background job system for recurring slots
- [ ] Email/SMS notifications
- [ ] Advanced analytics and reporting
- [ ] Multi-tenant architecture
- [ ] Internationalization (i18n)
- [ ] Advanced caching with Redis

## 📚 API Reference

For complete API documentation, import the OpenAPI schema into Postman or use tools like Swagger UI. All endpoints include comprehensive validation and error responses.

## 🆘 Support

- Check the test files for usage examples
- Review the schema in `supabase/migrations/`
- Monitor logs for debugging information
- Use the `/admin/health` endpoint for system status
