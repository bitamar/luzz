import express from 'express';
import 'dotenv/config';
import studios from './routes/studios';
import slots from './routes/slots';
import invites from './routes/invites';
import publicApi from './routes/public';
import bookings from './routes/bookings';

const app = express();

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/studios', studios);
app.use('/studios', slots); // slots are mounted under /studios/:studioId/slots
app.use('/invites', invites);
app.use('/public', publicApi);
app.use('/bookings', bookings);

// Global error handler
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
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
