# Admin Users Workstation - Environment Configuration

**Purpose:** Feature flags and environment variables for the workstation redesign  
**Scope:** Development, Staging, and Production configurations  
**Status:** Phase 0 Configuration Setup

---

## Feature Flags

### Workstation Feature Flags

Add these environment variables to your `.env.local` or deployment platform:

```bash
# Enable/disable the workstation redesign
NEXT_PUBLIC_WORKSTATION_ENABLED=false

# Enable detailed logging for workstation state changes
WORKSTATION_LOGGING_ENABLED=false

# Enable performance tracking and monitoring
WORKSTATION_PERF_TRACKING=false
```

### How to Use in Code

```typescript
// Check if workstation is enabled
if (process.env.NEXT_PUBLIC_WORKSTATION_ENABLED === 'true') {
  return <WorkstationLayout {...props} />
} else {
  return <ExecutiveDashboardTab {...props} />  // Fallback to old UI
}

// Logging
if (process.env.WORKSTATION_LOGGING_ENABLED === 'true') {
  console.log('[Workstation]', 'State update:', newState)
}

// Performance tracking
if (process.env.WORKSTATION_PERF_TRACKING === 'true') {
  performance.mark('workstation-render-end')
  const measure = performance.measure('workstation-render', 'workstation-render-start', 'workstation-render-end')
}
```

---

## Environment Setup Instructions

### Development Setup

1. **Create `.env.local` file in project root:**

```bash
# Copy from existing environment variables
NEXT_PUBLIC_WORKSTATION_ENABLED=false
WORKSTATION_LOGGING_ENABLED=true
WORKSTATION_PERF_TRACKING=true

# Keep all existing variables from system environment
```

2. **Enable Feature Flag for Testing:**

```bash
NEXT_PUBLIC_WORKSTATION_ENABLED=true
WORKSTATION_LOGGING_ENABLED=true
```

3. **Start dev server:**

```bash
pnpm dev
```

4. **Navigate to admin/users page:**

```
http://localhost:3000/admin/users
```

### Staging Environment

**Configuration:** Feature flag enabled for QA team

```bash
NEXT_PUBLIC_WORKSTATION_ENABLED=true
WORKSTATION_LOGGING_ENABLED=true
WORKSTATION_PERF_TRACKING=true
```

**Testing Focus:**
- Responsive behavior on tablets and mobile
- All browsers (Chrome, Firefox, Safari, Edge)
- Real devices, not just emulation
- Performance metrics collection

### Production Rollout

**Phase 1 (10% Users):**
```bash
NEXT_PUBLIC_WORKSTATION_ENABLED=true
WORKSTATION_LOGGING_ENABLED=false
WORKSTATION_PERF_TRACKING=true
```

**Phase 2 (25% Users):**
```bash
NEXT_PUBLIC_WORKSTATION_ENABLED=true
WORKSTATION_LOGGING_ENABLED=false
WORKSTATION_PERF_TRACKING=true
```

**Phase 3+ (100% Users):**
```bash
NEXT_PUBLIC_WORKSTATION_ENABLED=true
WORKSTATION_LOGGING_ENABLED=false
WORKSTATION_PERF_TRACKING=false
```

---

## Feature Flag Breakdown

### NEXT_PUBLIC_WORKSTATION_ENABLED

**Type:** Boolean (true/false)  
**Default:** false  
**Scope:** Client-side (public)  
**Usage:** Toggle between old UI and new workstation layout

**When True:**
- Renders WorkstationLayout component
- Hides ExecutiveDashboardTab (old UI)
- Loads workstation context and hooks

**When False:**
- Renders ExecutiveDashboardTab (current UI)
- Maintains backward compatibility
- Allows graceful fallback

### WORKSTATION_LOGGING_ENABLED

**Type:** Boolean (true/false)  
**Default:** false  
**Scope:** Server-side (sensitive)  
**Usage:** Enable detailed console logging for debugging

**What Gets Logged:**
- Context state changes
- Filter applications
- User selections
- Bulk action executions
- Performance milestones

**Example Output:**
```
[Workstation] State update: sidebarOpen = true
[Workstation] Filters applied: { roleFilter: 'ADMIN', statusFilter: 'ACTIVE' }
[Workstation] Selected 5 users for bulk action
[Workstation] Bulk action 'role_assignment' took 234ms
```

### WORKSTATION_PERF_TRACKING_ENABLED

**Type:** Boolean (true/false)  
**Default:** false  
**Scope:** Client-side  
**Usage:** Track performance metrics and send to monitoring service

**Metrics Tracked:**
- Component render times
- Filter application time
- Bulk action execution time
- Page load metrics
- Real-time sync latency

**Integration Points:**
- Performance Observer API
- Web Vitals (CLS, LCP, FID)
- Custom timing marks
- Sentry performance monitoring

---

## Configuration by Environment

### Environment Matrix

| Environment | Workstation | Logging | Perf Tracking | Notes |
|------------|------------|---------|---------------|-------|
| **Local Dev** | true | true | true | Full debugging |
| **Local Test** | true/false | true | true | Toggle testing |
| **Staging QA** | true | true | true | Pre-production test |
| **Staging Baseline** | false | false | false | Compare old vs new |
| **Production 10%** | true | false | true | Monitor early users |
| **Production 25%** | true | false | true | Expand rollout |
| **Production 50%** | true | false | true | Further expansion |
| **Production 100%** | true | false | false | Full deployment |

---

## Deployment Integration

### Vercel Environment Variables

Set in Vercel dashboard for each deployment:

```
Project Settings → Environment Variables
```

**Development Environment:**
```
NEXT_PUBLIC_WORKSTATION_ENABLED: false
WORKSTATION_LOGGING_ENABLED: false
WORKSTATION_PERF_TRACKING: false
```

**Staging Environment:**
```
NEXT_PUBLIC_WORKSTATION_ENABLED: true
WORKSTATION_LOGGING_ENABLED: true
WORKSTATION_PERF_TRACKING: true
```

**Production Environment (Initial):**
```
NEXT_PUBLIC_WORKSTATION_ENABLED: false
WORKSTATION_LOGGING_ENABLED: false
WORKSTATION_PERF_TRACKING: false
```

**Production Environment (10% Rollout):**
```
NEXT_PUBLIC_WORKSTATION_ENABLED: true (via API, not env var)
WORKSTATION_LOGGING_ENABLED: false
WORKSTATION_PERF_TRACKING: true
```

### Netlify Environment Variables

Set in Netlify dashboard under `Site settings → Build & Deploy → Environment`

```
NEXT_PUBLIC_WORKSTATION_ENABLED=false
WORKSTATION_LOGGING_ENABLED=false
WORKSTATION_PERF_TRACKING=false
```

---

## Testing Configuration

### Test Environment Setup

**vitest.config.ts Configuration:**

```typescript
export default defineConfig({
  test: {
    // ...
    env: {
      NEXT_PUBLIC_WORKSTATION_ENABLED: 'true',
      WORKSTATION_LOGGING_ENABLED: 'false',
      WORKSTATION_PERF_TRACKING: 'false'
    }
  }
})
```

### Running Tests

**All workstation tests:**
```bash
pnpm test -- src/app/admin/users/components/workstation
```

**With logging enabled:**
```bash
WORKSTATION_LOGGING_ENABLED=true pnpm test
```

**Performance tests only:**
```bash
pnpm test -- --grep "performance|perf"
```

---

## Monitoring & Observability

### Sentry Integration

Feature flags and performance metrics are automatically tracked:

```typescript
// Sentry will capture feature flag state
Sentry.captureMessage('Workstation rendered', {
  level: 'info',
  tags: {
    feature: 'workstation_redesign',
    enabled: process.env.NEXT_PUBLIC_WORKSTATION_ENABLED
  }
})
```

### Analytics Events

Track feature flag adoption:

```typescript
// Google Analytics
gtag('event', 'workstation_enabled', {
  event_category: 'feature_flag',
  event_label: 'workstation_redesign',
  value: process.env.NEXT_PUBLIC_WORKSTATION_ENABLED === 'true' ? 1 : 0
})
```

### Performance Monitoring

Using Web Vitals API:

```typescript
import { getCLS, getLCP, getFID } from 'web-vitals'

if (process.env.WORKSTATION_PERF_TRACKING === 'true') {
  getCLS(console.log)
  getLCP(console.log)
  getFID(console.log)
}
```

---

## Gradual Rollout Configuration

### Phase-Based Feature Flag

**Implementation:**

```typescript
// Determine feature flag based on user ID or percentage
export function isWorkstationEnabled(userId: string): boolean {
  if (process.env.NEXT_PUBLIC_WORKSTATION_ENABLED !== 'true') {
    return false
  }

  // Get current rollout phase
  const phase = process.env.WORKSTATION_ROLLOUT_PHASE || '0'
  const percentage = {
    '1': 0.10,    // 10% users
    '2': 0.25,    // 25% users
    '3': 0.50,    // 50% users
    '4': 1.0      // 100% users
  }[phase] || 0

  // Hash user ID for consistent assignment
  const hash = hashUserId(userId)
  return (hash % 100) < (percentage * 100)
}
```

**Configuration:**

| Phase | Percentage | Users | Env Variable |
|-------|-----------|-------|---|
| 1 | 10% | ~4.2 | WORKSTATION_ROLLOUT_PHASE=1 |
| 2 | 25% | ~10.5 | WORKSTATION_ROLLOUT_PHASE=2 |
| 3 | 50% | ~21 | WORKSTATION_ROLLOUT_PHASE=3 |
| 4 | 100% | All | WORKSTATION_ROLLOUT_PHASE=4 |

---

## Troubleshooting

### Feature Flag Not Working

**Issue:** Workstation not showing up even with flag enabled

**Solutions:**
1. Clear browser cache
2. Restart dev server: `pnpm dev`
3. Check `NEXT_PUBLIC_WORKSTATION_ENABLED` is visible to client
4. Verify in browser console: `process.env.NEXT_PUBLIC_WORKSTATION_ENABLED`

### Logging Not Appearing

**Issue:** Console logs not showing

**Solutions:**
1. Set `WORKSTATION_LOGGING_ENABLED=true`
2. Check browser console (not terminal)
3. Restart dev server after env change
4. Ensure logs are at `[Workstation]` level

### Performance Metrics Missing

**Issue:** Performance data not collected

**Solutions:**
1. Enable `WORKSTATION_PERF_TRACKING=true`
2. Check Sentry dashboard
3. Verify performance marks in DevTools
4. Check Network tab for telemetry requests

---

## Next Steps

1. **Phase 1:** Use feature flags for component development
2. **Phase 4:** Finalize performance baselines
3. **Phase 6:** Configure gradual rollout percentages
4. **Post-Launch:** Monitor and adjust rollout schedule

---

## Related Documentation

- [Implementation Log](./ADMIN_USERS_IMPLEMENTATION_LOG.md)
- [Phase Checklist](./ADMIN_USERS_PHASE_0_CHECKLIST.md)
- [Quick Start Guide](./ADMIN_USERS_WORKSTATION_QUICK_START.md)

---

**Document Created:** Phase 0  
**Configuration Status:** ✅ Documented, Ready for Implementation  
**Last Updated:** Phase 0 Completion
