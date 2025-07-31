# Luz API Testing Plan

## Current Status
- **Overall Coverage**: 11.73%
- **Target Coverage**: 80%+
- **Well Tested**: `studios.ts` (90.62%)
- **Needs Testing**: All other routes (0% coverage)

## Testing Strategy

### Phase 1: Core Route Testing (Priority: HIGH)
**Target**: `slots.ts` - Business-critical functionality

#### Test Scenarios for slots.ts:
- ✅ **Valid slot creation**
  - Basic slot with all required fields
  - Slot with recurrence rule
  - Adult vs children slots
- ✅ **Validation tests**
  - Invalid studio ID (non-existent, non-numeric)
  - Invalid datetime formats
  - Invalid duration (negative, zero, > 24 hours)
  - Invalid participant counts (min > max)
  - Invalid price (negative)
- ✅ **Business logic tests**
  - Studio existence validation
  - Slot scheduling conflicts (future enhancement)
  - Price formatting and decimal handling

**Estimated Effort**: 2-3 hours  
**Expected Coverage**: ~85%

### Phase 2: Public API Testing (Priority: HIGH)  
**Target**: `public.ts` - Customer-facing endpoints

#### Test Scenarios for public.ts:

**GET /public/:slug/slots**:
- ✅ **Valid requests**
  - Valid studio slug + week parameter
  - Empty week (no slots)
  - Week with multiple slots
  - Slots grouped by day correctly
- ✅ **Validation tests**
  - Invalid studio slug
  - Invalid week format (not YYYY-WW)
  - Missing week parameter
  - Out-of-range week numbers

**POST /public/invites/:hash/bookings**:
- ✅ **Valid booking creation**
  - Adult booking with existing customer
  - Child booking with new child data
  - Child booking with existing child ID
- ✅ **Security & validation tests**
  - Invalid/expired invite hash
  - Non-existent slot ID
  - Slot for children without child data
  - Adult slot with child data (should fail)
  - Slot from different studio than invite

**Estimated Effort**: 4-5 hours  
**Expected Coverage**: ~80%

### Phase 3: Invite System Testing (Priority: MEDIUM)
**Target**: `invites.ts` - Security-critical functionality

#### Test Scenarios for invites.ts:
- ✅ **Valid invite creation**
  - New customer with email
  - New customer with phone
  - Existing customer (should reuse)
  - Customer with both email and phone
- ✅ **Validation tests**
  - Invalid studio ID
  - Missing customer data
  - Invalid email format
  - Missing both email and phone
- ✅ **Security tests**
  - Hash uniqueness
  - Hash collision handling
  - Invite URL format
  - Expiration date (30 days)

**Estimated Effort**: 2-3 hours  
**Expected Coverage**: ~85%

### Phase 4: Payment Testing (Priority: MEDIUM)
**Target**: `bookings.ts` - Payment handling

#### Test Scenarios for bookings.ts:

**PATCH /bookings/:id/payment**:
- ✅ **Valid payment updates**
  - All payment methods (cash, bit, paybox, transfer)
  - With custom paid_at timestamp
  - With auto-generated timestamp
- ✅ **Validation tests**
  - Invalid booking ID
  - Non-existent booking
  - Already paid booking
  - Invalid payment method
  - Invalid timestamp format

**GET /bookings/:id** (bonus endpoint):
- ✅ **Valid retrieval**
  - Adult booking details
  - Child booking details
  - Booking with all related data
- ✅ **Error cases**
  - Non-existent booking
  - Invalid booking ID format

**Estimated Effort**: 2-3 hours  
**Expected Coverage**: ~85%

### Phase 5: Integration Testing (Priority: LOW)
**Target**: `server.ts` - Express app integration

#### Test Scenarios for server.ts:
- ✅ **Server startup**
  - Health check endpoint
  - Route mounting
  - JSON middleware
- ✅ **Error handling**
  - Global error handler
  - 404 handler
  - Invalid JSON handling
- ✅ **Integration tests**
  - Cross-route workflows
  - End-to-end scenarios

**Estimated Effort**: 2 hours  
**Expected Coverage**: ~70%

### Phase 6: Edge Cases & Cleanup (Priority: LOW)
**Target**: Complete remaining coverage gaps

#### Focus Areas:
- ✅ **Complete studios.ts coverage** (lines 43-45)
- ✅ **Database edge cases** (connection failures, timeouts)
- ✅ **Error boundary testing**
- ✅ **Performance edge cases**

**Estimated Effort**: 1-2 hours  
**Expected Coverage**: ~90%+

## Implementation Order

1. **Week 1**: Phase 1 (slots.ts) - Foundation
2. **Week 1**: Phase 2 (public.ts) - Customer experience  
3. **Week 2**: Phase 3 (invites.ts) - Security
4. **Week 2**: Phase 4 (bookings.ts) - Payments
5. **Week 3**: Phase 5 (server.ts) - Integration
6. **Week 3**: Phase 6 - Polish & edge cases

## Tools & Setup

### Test Database Setup
```bash
# Create test-specific database
DATABASE_URL_TEST=postgresql://postgres:postgres@127.0.0.1:54322/postgres_test
```

### Coverage Scripts
```bash
# Add to package.json
"test:coverage": "NODE_ENV=test vitest run --coverage",
"test:watch": "NODE_ENV=test vitest --coverage",
"test:ui": "NODE_ENV=test vitest --ui"
```

### Shared Test Utilities
- Database cleanup helpers
- Test data factories
- Common assertion helpers
- Mock HTTP client setup

## Success Criteria

- **Overall Coverage**: >80%
- **Per-file Coverage**: >85% for business logic
- **No Flaky Tests**: All tests must be deterministic
- **Fast Execution**: Test suite <10 seconds
- **Clear Reporting**: Detailed failure messages

## Testing Best Practices

1. **Arrange-Act-Assert** pattern
2. **Independent tests** (no shared state)
3. **Descriptive test names** 
4. **Edge case coverage**
5. **Error path testing**
6. **Database cleanup** between tests
7. **Mock external dependencies**

## Risk Mitigation

- **Database state**: Clean tables between tests
- **Async operations**: Proper async/await usage  
- **Race conditions**: Sequential test execution
- **Environment isolation**: Separate test DB
- **Secret management**: Test-safe environment variables 