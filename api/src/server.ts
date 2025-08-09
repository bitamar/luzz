import express from 'express';
import 'dotenv/config';
import studios from './routes/studios';
import slots from './routes/slots';
import invites from './routes/invites';
import publicApi from './routes/public';
import bookings from './routes/bookings';
import studioCustomers, {
  customersRouter as customersByIdRouter,
} from './routes/customers';
import customerChildren, {
  childrenRouter as childrenByIdRouter,
} from './routes/children';
import admin from './routes/admin';
import {
  requireApiKey,
  optionalAuth,
  requestLogger,
  rateLimit,
} from './middleware/auth';

const app = express();

// Middleware
app.use(express.json());
app.use(requestLogger);
app.use(rateLimit(process.env.NODE_ENV === 'production' ? 60 : 200)); // More lenient in dev

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
// Public routes (no auth required, but optional logging)
app.use('/public', optionalAuth, publicApi);

// Protected routes (require API key)
app.use('/studios', requireApiKey, studios);
app.use('/studios', requireApiKey, slots); // slots are mounted under /studios/:studioId/slots
app.use('/studios', requireApiKey, studioCustomers); // studio-scoped customers under /studios/:studioId/customers

// Resource-by-id routes and nested children
app.use('/customers', requireApiKey, customersByIdRouter); // customers by id: /customers/:id
app.use('/customers', requireApiKey, customerChildren); // /customers/:customerId/children
app.use('/children', requireApiKey, childrenByIdRouter); // children by id: /children/:id

app.use('/invites', requireApiKey, invites);
app.use('/bookings', requireApiKey, bookings);
app.use('/admin', requireApiKey, admin);

// Global error handler
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
      error: 'Internal server error',
      message:
        process.env.NODE_ENV === 'development'
          ? err.message
          : 'Something went wrong',
    });
  }
);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`API server running on port ${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
});
