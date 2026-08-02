# V1 Scope

## Core Philosophy
V1 must solve exactly one problem exceptionally well: "Where should I live in Bengaluru based on my office, budget, and lifestyle?" 

It must be realistically shippable within approximately 21 development days using AI-assisted implementation. To achieve this, scope must be aggressively protected.

## IN SCOPE (V1)

### User Stories
- As a user, I can input my work location (using a search bar or map click) so the system knows my daily destination.
- As a user, I can input my housing constraints (budget, BHK type) so I don't see unaffordable areas.
- As a user, I can select lifestyle priorities (e.g., metro access, nightlife, quietness) so the ranking reflects my preferences.
- As a user, I can see a ranked list of neighbourhoods with a "BLR Score" indicating how well they match my inputs.
- As a user, I can click on a recommendation to see a data-driven explanation of why it was chosen (Pros/Cons).
- As a user, I can view the recommended neighbourhoods on an interactive map.
- As a user, I can copy a shareable link to send my results to a friend or partner.

### Acceptance Criteria
- **Recommendation Engine**: Must be deterministic, mathematical, and explainable. No black-box AI scores.
- **Geospatial**: Must use PostGIS for calculating distances and identifying area containment.
- **Data**: Must have baseline data for at least 30-50 well-known Bengaluru neighbourhoods.
- **UI/UX**: Must work flawlessly on mobile and desktop web.

### Launch Criteria
- V1 is deployed to a production environment (e.g., VPS or PaaS).
- CI/CD pipeline runs tests and linters successfully.
- Baseline datasets are seeded into the production database.

## OUT OF SCOPE (V1)
*These features are explicitly excluded from the first public release.*

### Explicit Non-Goals
- **User Accounts / Login**: V1 will use anonymous sessions or shareable encoded URLs to save state. No OAuth or password management yet.
- **Microservices**: The system will be a modular monolith.
- **Kubernetes**: Standard Docker Compose or simple container hosting is sufficient.
- **Redis/Celery**: Background workers are not needed unless data ingestion takes too long, which can be done offline for V1.
- **Live Traffic APIs**: Do not integrate Google Maps Distance Matrix. We will use spatial heuristics or open routing engines.
- **LLM/AI Generation**: Explanations must be generated via rules and templates based on data, not via expensive LLM calls.
- **Mobile Apps**: iOS/Android native apps are out of scope. Web only.
- **Real Estate Listings**: We are recommending *areas*, not linking to specific broker listings for houses.
- **User-generated Content**: No crowdsourcing of data or reviews in V1. All data is managed by the system.
