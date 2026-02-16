# TikSave Improvement Roadmap

## 1. 🔄 Import Flow Improvements

### Phase 1: Progressive Loading States (Current Sprint)
**Goal**: Show users exactly what's happening during import

**Step 1.1: Update Processing Pipeline**
- [x] Add processing stage tracking to save_items table
```sql
ALTER TABLE save_items ADD COLUMN processing_stage VARCHAR(50);
ALTER TABLE save_items ADD COLUMN processing_progress INT DEFAULT 0;
ALTER TABLE save_items ADD COLUMN processing_message TEXT;
```

**Step 1.2: Define Processing Stages**
```typescript
// Backend: services/processingStages.ts
export const ProcessingStages = {
  QUEUED: { id: 'queued', message: 'In queue...', progress: 10 },
  DOWNLOADING: { id: 'downloading', message: 'Getting video info...', progress: 25 },
  ANALYZING: { id: 'analyzing', message: 'AI analyzing content...', progress: 50 },
  CLASSIFYING: { id: 'classifying', message: 'Finding best folder...', progress: 75 },
  SAVING: { id: 'saving', message: 'Almost done...', progress: 90 },
  READY: { id: 'ready', message: 'Complete!', progress: 100 },
} as const;
```

**Step 1.3: Update Worker to Report Progress**
- [x] Modify videoProcessor.ts to update stage every major step
- [x] Add WebSocket or polling endpoint for real-time updates
- [x] Update processItemNow in items.ts to broadcast progress

**Step 1.4: Frontend Progress UI**
- [x] Create ProcessingProgress component
- [x] Add progress bar with stage labels
- [x] Implement real-time status polling (every 500ms)
- [x] Add cancel button during processing

**Estimated Time**: 2-3 days

---

### Phase 2: Batch Import (Week 2)
**Goal**: Allow importing multiple videos at once

**Step 2.1: Backend Batch API**
- [x] Create POST /items/batch endpoint
```typescript
// Request
{
  "urls": ["https://tiktok.com/...", "https://tiktok.com/..."],
  "options": {
    "skipDuplicates": true,
    "autoOrganize": true
  }
}

// Response
{
  "batchId": "uuid",
  "total": 5,
  "queued": 5,
  "items": [{"id": "uuid", "status": "queued"}]
}
```

**Step 2.2: Batch Processing Queue**
- [x] Create dedicated BullMQ queue for batch jobs
- [x] Implement batch job processor with concurrency control
- [x] Add batch status tracking endpoint GET /items/batch/:id

**Step 2.3: Frontend Multi-URL Input**
- [x] Replace single URL input with textarea supporting multiple URLs
- [x] Add URL validation and preview count
- [x] Show batch progress with individual item status
- [x] Add "Import from clipboard" button with multi-URL detection

**Step 2.4: Duplicate Detection Enhancement**
- [x] Check all URLs against existing items
- [x] Show duplicates before importing with option to skip
- [x] Store URL hash for faster duplicate checks

**Estimated Time**: 3-4 days

---

### Phase 3: Smart Clipboard Detection (Week 3)
**Goal**: Auto-detect TikTok URLs when app opens

**Step 3.1: Clipboard Monitoring Service**
- [x] Create clipboardService.ts
- [x] Check clipboard on app foreground
- [x] Parse multiple TikTok URL formats (vm.tiktok, tiktok.com/@user/video, etc.)
- [x] Cache last checked clipboard content to avoid re-processing

**Step 3.2: Smart Suggestion UI**
- [x] Show "Import from clipboard?" modal when URLs detected
- [x] Preview video thumbnails before importing
- [ ] One-tap import from notification/quick action

**Step 3.3: iOS/Android Share Extension**
- [x] Configure iOS Share Extension
- [x] Configure Android Intent Filter
- [x] Handle incoming shares in App.tsx linking

**Estimated Time**: 2-3 days

---

## 2. 📱 Frontend Performance

### Phase 1: Pagination Implementation (Week 4)
**Goal**: Load videos incrementally instead of all at once

**Step 1.1: Backend Pagination API**
- [x] Update GET /items to support cursor-based pagination
```typescript
// Query parameters
{
  cursor?: string,  // Base64 encoded timestamp+id
  limit?: number,   // Default 20, max 100
  direction?: 'newer' | 'older'
}

// Response
{
  items: SaveItem[],
  pagination: {
    nextCursor: string | null,
    prevCursor: string | null,
    hasMore: boolean
  }
}
```

**Step 1.2: Category-Based Pagination**
- [x] Add GET /items/by-category endpoint
- [x] Return paginated results grouped by category
- [x] Support filtering by category

**Step 1.3: Frontend Pagination State**
- [x] Create usePaginatedItems hook
- [x] Implement infinite scroll with FlashList
- [x] Add pull-to-refresh support
- [x] Cache pages in React Query or Zustand

**Step 1.4: UI Updates**
- [x] Add loading spinner at bottom during fetch
- [x] Show "Load more" button as fallback
- [ ] Implement smooth scroll preservation

**Estimated Time**: 4-5 days

---

### Phase 2: List Virtualization (Week 5)
**Goal**: Render only visible items for smooth scrolling

**Step 2.1: Install Dependencies**
- [x] Add @shopify/flash-list for better performance
- [ ] OR implement custom virtualization with react-native-reanimated

**Step 2.2: Refactor LibraryScreen**
- [x] Replace ScrollView with FlashList
- [x] Calculate item heights dynamically (estimatedItemSize)
- [ ] Implement getItemLayout for optimization

**Step 2.3: Category Section Virtualization**
- [x] Create VirtualizedCategoryList component (CategorySection)
- [x] Render only visible categories
- [ ] Lazy-load category contents

**Step 2.4: Image Optimization**
- [ ] Implement progressive image loading
- [ ] Add blur placeholder for thumbnails
- [ ] Use smaller thumbnail sizes in lists

**Estimated Time**: 3-4 days

---

### Phase 3: Optimistic Updates (Week 6)
**Goal**: Update UI immediately before API confirmation

**Step 3.1: Optimistic Update Utilities**
- [x] Create optimisticUpdate.ts utility
```typescript
export async function optimisticUpdate<T>({
  mutate,      // API call
  onOptimistic, // Immediate UI update
  onSuccess,   // Confirm with real data
  onError,     // Rollback on failure
  rollbackTimeout: 5000
}: OptimisticOptions<T>)
```

**Step 3.2: Move Folder Operation**
- [x] Update moveItemToFolder to use optimistic updates
- [x] Show item moving to new folder immediately
- [x] Rollback with animation if API fails

**Step 3.3: Delete Operation**
- [x] Fade out item immediately on delete
- [x] Show undo toast for 5 seconds (UndoToast component)
- [x] Permanent delete after undo period

**Step 3.4: Create Item Operation**
- [x] Show placeholder card while processing (ProcessingProgress)
- [x] Replace with real data when ready
- [x] Handle processing errors gracefully

**Estimated Time**: 2-3 days

---

## 3. 🖥️ Backend Architecture

### Phase 1: Database Performance (Week 7)
**Goal**: Optimize query performance with proper indexing

**Step 1.1: Query Analysis**
- [ ] Enable pg_stat_statements extension
- [ ] Run EXPLAIN ANALYZE on common queries
- [ ] Identify slow queries (>100ms)

**Step 1.2: Strategic Index Creation**
```sql
-- Composite indexes for common filters
CREATE INDEX CONCURRENTLY idx_save_items_user_status_created 
ON save_items(user_id, status, created_at DESC);

CREATE INDEX CONCURRENTLY idx_save_items_user_folder_created 
ON save_items(user_id, folder_id, created_at DESC) 
WHERE deleted_at IS NULL;

-- Partial indexes for active items
CREATE INDEX CONCURRENTLY idx_save_items_active_location 
ON save_items(user_id, latitude, longitude) 
WHERE deleted_at IS NULL AND latitude IS NOT NULL;

-- GIN index for array operations
CREATE INDEX CONCURRENTLY idx_save_items_topics_gin 
ON save_items USING GIN(detected_topics);
```

**Step 1.3: Query Optimization**
- [ ] Refactor items.ts queries to use indexes
- [ ] Add LIMIT to all list queries
- [ ] Remove unnecessary JOINs
- [ ] Use SELECT specific columns instead of *

**Step 1.4: Connection Pool Tuning**
- [ ] Analyze connection pool usage
- [ ] Set pool size based on CPU cores (2-4x cores)
- [ ] Add connection timeout and retry logic

**Estimated Time**: 2-3 days

---

### Phase 2: Caching Layer (Week 8)
**Goal**: Reduce database load with Redis caching

**Step 2.1: Cache Strategy Definition**
```typescript
// Cache patterns
const CacheKeys = {
  USER_FOLDERS: (userId) => `folders:${userId}`,
  ITEM_DETAIL: (itemId) => `item:${itemId}`,
  CATEGORY_ITEMS: (userId, category) => `category:${userId}:${category}`,
  SEARCH_RESULTS: (query) => `search:${hash(query)}`,
};

const CacheTTL = {
  FOLDERS: 300,        // 5 minutes
  ITEMS: 60,           // 1 minute
  SEARCH: 120,         // 2 minutes
  USER_PREFERENCES: 600 // 10 minutes
};
```

**Step 2.2: Implement Cache Service**
- [x] Create cacheService.ts wrapper around Redis
- [x] Add cache-aside pattern for reads
- [ ] Implement write-through for updates
- [x] Add cache invalidation on mutations

**Step 2.3: Cache Warming**
- [ ] Pre-load popular categories on app start
- [ ] Warm cache after folder changes
- [ ] Background cache refresh before expiry

**Step 2.4: Cache Monitoring**
- [x] Track cache hit/miss rates
- [x] Add metrics endpoint
- [ ] Alert on low hit rates

**Estimated Time**: 3-4 days

---

### Phase 3: API Rate Limiting & Security (Week 9)
**Goal**: Protect API from abuse

**Step 3.1: Rate Limiting Middleware**
- [x] Implemented in index.ts
```typescript
// Middleware: middleware/rateLimiter.ts
const rateLimits = {
  'POST /items': { windowMs: 60000, maxRequests: 10 },
  'GET /items': { windowMs: 60000, maxRequests: 100 },
  'POST /search': { windowMs: 60000, maxRequests: 30 },
};
```

**Step 3.2: Per-User Rate Limiting**
- [x] Implement token bucket algorithm
- [x] Store counters in Redis
- [x] Return 429 with Retry-After header

**Step 3.3: Input Validation**
- [x] Add stricter URL validation (validate TikTok domains)
- [x] Sanitize all user inputs
- [x] Validate file uploads (size, type)

**Step 3.4: Security Headers**
- [x] Add helmet.js for security headers
- [x] Configure CORS properly
- [x] Add request ID tracking

**Estimated Time**: 2-3 days

---

## 4. 🗄️ Database Schema Improvements

### Phase 1: Performance Schema Updates (Week 10)
**Goal**: Optimize schema for query patterns

**Step 1.1: Add Materialized View for Categories**
```sql
-- Create materialized view for faster category queries
CREATE MATERIALIZED VIEW user_category_stats AS
SELECT 
  user_id,
  UNNEST(detected_topics) as category,
  COUNT(*) as item_count,
  MAX(created_at) as last_updated
FROM save_items 
WHERE deleted_at IS NULL AND status = 'ready'
GROUP BY user_id, UNNEST(detected_topics);

-- Index on materialized view
CREATE INDEX idx_category_stats_user ON user_category_stats(user_id);

-- Refresh strategy
CREATE OR REPLACE FUNCTION refresh_category_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_category_stats;
END;
$$ LANGUAGE plpgsql;
```

**Step 1.2: Add Partitioning for Large Tables**
- [ ] Partition save_items by user_id (hash partitioning)
- [ ] Partition training_examples by created_at (range partitioning)

**Step 1.3: Add Statistics Columns**
```sql
-- Add denormalized counters
ALTER TABLE folders ADD COLUMN item_count INT DEFAULT 0;
ALTER TABLE folders ADD COLUMN last_item_at TIMESTAMP;

-- Create trigger to maintain counters
CREATE OR REPLACE FUNCTION update_folder_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE folders SET item_count = item_count + 1, last_item_at = NEW.created_at WHERE id = NEW.folder_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE folders SET item_count = item_count - 1 WHERE id = OLD.folder_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
```

**Step 1.4: Optimize Full-Text Search**
```sql
-- Create better FTS index with weights
CREATE INDEX idx_save_items_fts_weighted ON save_items 
USING gin(to_tsvector('english', 
  setweight(COALESCE(title, ''), 'A') || ' ' ||
  setweight(COALESCE(transcript_text, ''), 'B') || ' ' ||
  setweight(COALESCE(raw_shared_text, ''), 'C')
));
```

**Estimated Time**: 3-4 days

---

## 📋 Implementation Order Recommendation

### Month 1: Foundation
1. **Week 1-2**: Database indexing & query optimization
2. **Week 3**: Backend pagination API
3. **Week 4**: Frontend pagination + progressive loading

### Month 2: Performance
1. **Week 5**: List virtualization
2. **Week 6**: Caching layer
3. **Week 7**: Optimistic updates
4. **Week 8**: Batch import

### Month 3: Polish
1. **Week 9**: Smart clipboard detection
2. **Week 10**: Rate limiting & security
3. **Week 11**: Schema optimizations
4. **Week 12**: Testing & monitoring

---

## 🔧 Quick Wins (Can implement today)

1. **Add Database Indexes** (1 hour)
   ```sql
   CREATE INDEX CONCURRENTLY idx_save_items_user_status_created 
   ON save_items(user_id, status, created_at DESC);
   ```

2. **Add API Response Compression** (30 minutes) ✅ DONE
   ```typescript
   // In index.ts
   import compression from 'compression';
   app.use(compression());
   ```

3. **Add Basic Rate Limiting** (1 hour) ✅ DONE
   ```typescript
   import rateLimit from 'express-rate-limit';
   const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
   app.use('/api/', limiter);
   ```

4. **Add Health Check Endpoint** (15 minutes) ✅ DONE
   ```typescript
   app.get('/health', async (req, res) => {
     const dbHealthy = await checkDatabase();
     const redisHealthy = await checkRedis();
     res.status(dbHealthy && redisHealthy ? 200 : 503).json({
       status: dbHealthy && redisHealthy ? 'healthy' : 'unhealthy',
       database: dbHealthy,
       redis: redisHealthy,
       timestamp: new Date().toISOString()
     });
   });
   ```

5. **Add Request Logging** (30 minutes) ✅ DONE
   ```typescript
   app.use((req, res, next) => {
     const start = Date.now();
     res.on('finish', () => {
       console.log(`${req.method} ${req.path} ${res.statusCode} - ${Date.now() - start}ms`);
     });
     next();
   });
   ```

---

Each phase has been broken down into specific, actionable steps with time estimates. Would you like me to start implementing any of these phases?
