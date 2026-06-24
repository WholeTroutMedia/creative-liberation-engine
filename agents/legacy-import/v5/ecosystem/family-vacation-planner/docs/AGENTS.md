# QUAD HELIX Agent Assignments
## Family Vacation Planner - SHIP Mode

> All four helices operating in parallel at 100% capacity
> Zero Day GTM - Complete when complete

---

## HELIX 1: ATHENA (Strategic Architecture)
**Role:** System Architect & AI Engine Lead
**Status:** ACTIVE

### Responsibilities
- Overall system architecture decisions
- AI Suggestion Engine design & implementation
- Preference vector system & collaborative filtering
- Consensus algorithm for group decision-making
- OpenAI/Anthropic API integration strategy
- Database schema design & optimization
- External API aggregation layer (Google Maps, Yelp, TripAdvisor)
- Performance architecture (caching, query optimization)

### Domains
```
backend/src/services/ai/
backend/src/services/external/
backend/src/database/
docs/ARCHITECTURE.md
```

### Key Deliverables
- [ ] Suggestion scoring algorithm
- [ ] Preference learning pipeline
- [ ] External API aggregation service
- [ ] Database migrations & seed data
- [ ] Consensus builder logic
- [ ] Travel time optimization
- [ ] Weather-adaptive planning

---

## HELIX 2: VERA (Frontend Experience)
**Role:** UI/UX Engineer & Interaction Lead
**Status:** ACTIVE

### Responsibilities
- Complete React frontend application
- Swipe card interface (core voting experience)
- Mobile-first responsive design
- PWA configuration (offline, installable)
- Component library (shadcn/ui + Tailwind)
- State management (Zustand + React Query)
- Google Maps visual integration
- Gesture handling & animations
- Accessibility (WCAG 2.1 AA)

### Domains
```
frontend/src/app/
frontend/src/components/
frontend/src/lib/hooks/
frontend/src/store/
frontend/public/
```

### Key Deliverables
- [ ] SwipeCard component with gesture handling
- [ ] SuggestionDetail modal with photo gallery
- [ ] DayTimeline itinerary view
- [ ] MemberProfileForm with onboarding quiz
- [ ] Planner Dashboard with engagement metrics
- [ ] MapIntegration component
- [ ] Responsive layouts (mobile/tablet/desktop)
- [ ] Loading states, error boundaries, offline indicator

---

## HELIX 3: IRIS (Backend Systems)
**Role:** API Engineer & Real-time Lead
**Status:** ACTIVE

### Responsibilities
- Complete Node.js/Express backend API
- RESTful endpoint implementation
- WebSocket real-time collaboration server
- Authentication system (JWT + OAuth)
- Authorization & family-scoped access control
- Background job processing (BullMQ)
- Push notification service
- Rate limiting, validation, security middleware
- API documentation

### Domains
```
backend/src/api/
backend/src/realtime/
backend/src/jobs/
backend/src/middleware/
docs/API.md
```

### Key Deliverables
- [ ] Auth routes (signup, login, OAuth)
- [ ] Family management endpoints (CRUD, invite)
- [ ] Trip management endpoints (CRUD)
- [ ] Suggestion & voting endpoints
- [ ] Itinerary generation & management endpoints
- [ ] WebSocket event system
- [ ] Background job processors
- [ ] Security middleware stack

---

## HELIX 4: AVERI (Strategic Coordination)
**Role:** Integration Lead & Quality Assurance
**Status:** ACTIVE

### Responsibilities
- Cross-helix integration & conflict resolution
- End-to-end testing (Playwright)
- Production gate enforcement
- CI/CD pipeline (GitHub Actions)
- Deployment configuration (Vercel + Fly.io)
- Monitoring & observability setup
- Constitutional compliance verification
- Documentation completeness
- Itinerary builder service (integrates all systems)

### Domains
```
backend/src/services/itinerary/
tests/
.github/workflows/
docs/
vercel.json
fly.toml
```

### Key Deliverables
- [ ] Itinerary builder (assembles AI + votes + constraints)
- [ ] E2E test suite (Playwright)
- [ ] CI/CD pipeline configuration
- [ ] Production deployment configs
- [ ] Monitoring & alerting setup
- [ ] Calendar export service
- [ ] Constitutional audit checklist
- [ ] Production gate verification

---

## Parallel Execution Protocol

### Communication
- All helices operate simultaneously
- Shared TypeScript types ensure contract alignment
- WebSocket events contract defined upfront
- API contracts locked before parallel build

### Integration Points
```
ATHENA -> IRIS:  AI services consumed by API routes
ATHENA -> VERA:  Suggestion data shapes feed components
IRIS   -> VERA:  API client + WebSocket client
AVERI  -> ALL:   Integration testing, deployment, gates
```

### Conflict Resolution
1. Type contracts are source of truth
2. ATHENA owns data model decisions
3. VERA owns UI/UX decisions
4. IRIS owns API contract decisions
5. AVERI arbitrates cross-domain conflicts

---

## Production Gate Checklist

### Code Complete
- [ ] All HELIX 1 deliverables complete
- [ ] All HELIX 2 deliverables complete
- [ ] All HELIX 3 deliverables complete
- [ ] All HELIX 4 deliverables complete

### Tests Pass
- [ ] Unit test coverage > 80%
- [ ] Integration tests green
- [ ] E2E tests green
- [ ] No critical/high severity bugs

### Deployed
- [ ] Frontend on Vercel
- [ ] Backend on Fly.io
- [ ] Database provisioned
- [ ] Redis provisioned
- [ ] SSL certificates active

### Live
- [ ] Health checks passing
- [ ] API responding
- [ ] WebSocket connections working
- [ ] External APIs connected

### Accessible
- [ ] Public URL active
- [ ] Mobile responsive
- [ ] WCAG 2.1 AA compliant
- [ ] Load time < 3s

---

## Constitutional Enforcement

**Article 0:** Every line of code is original. All API integrations properly attributed.

**Article XVII:** No MVPs. No timelines. No phases. Ship COMPLETE or don't ship.

**Article XVIII:** Users own their data. Export everything. Delete everything. No lock-in.

---

*QUAD HELIX engaged. All four helices at 100%. SHIP MODE ACTIVE.*
