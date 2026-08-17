# Phase 13 Security Audit — Threat Model & Findings

## Security Architecture Summary

### Authentication & Authorization
- **Auth Provider**: Supabase Auth with @supabase/ssr v0.12.4
- **Session Management**: Server-side cookies via @supabase/ssr createServerClient()
- **Identity Validation**: All routes use `requireUser()` → `getSessionUser()` → `supabase.auth.getUser()`
- **RLS Enforcement**: All audit tables have RLS enabled with user_id-based policies
- **Service-Role Isolation**: Admin client uses `server-only` import, never bundled to client

### API Security
- **Authentication**: All `/api/*` routes require authenticated session
- **Authorization**: RLS-scoped queries via session client; service-role only for internal operations
- **Rate Limiting**: In-memory token bucket (per-IP and per-user) on auth and audit endpoints
- **Input Validation**: Comprehensive upload validation (extension, size, MIME, magic bytes, content)
- **Request IDs**: Correlation IDs for log tracing

### Data Protection
- **Storage**: Private Supabase Storage bucket with user-prefix isolation
- **File Validation**: Extension allowlist, size limits, MIME validation, magic byte checks, content validation
- **AI Security**: Output validation, no performance claims, no secrets in prompts, structured JSON validation
- **Logging**: Structured logging with no sensitive data (no passwords, tokens, keys, or source code)

### Infrastructure Security
- **Security Headers**: CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy, X-Content-Type-Options
- **Cookie Security**: Delegated to @supabase/ssr (needs verification)
- **CORS**: No explicit configuration (same-origin only, which is correct)
- **CSRF**: No explicit protection (needs analysis)

---

## Findings

### CRITICAL
**None found**

### HIGH

#### H1: CSRF Vulnerability on State-Changing Endpoints
**Severity**: HIGH  
**Category**: CSRF  
**Status**: Needs remediation

**Description**:  
The application uses cookie-based authentication (Supabase sessions) but has no CSRF protection on state-changing endpoints (POST, PUT, DELETE). If the Supabase SSR cookie configuration does not set `SameSite=strict` or `SameSite=lax`, attackers could trick authenticated users into performing unintended actions via cross-origin requests.

**Affected Endpoints**:
- POST /api/auth/login
- POST /api/auth/signup
- POST /api/auth/logout
- DELETE /api/auth/account
- POST /api/audits (create)
- POST /api/audits/[id]/run (execute)
- DELETE /api/audits/[id] (delete)

**Attack Scenario**:  
1. Attacker creates a malicious webpage with a form that auto-submits to `POST /api/audits` with attacker-controlled data
2. Victim visits the malicious page while authenticated to QuantLint
3. Browser sends the request with QuantLint session cookies
4. Audit is created on behalf of the victim without their consent

**Why Existing Controls Fail**:  
- No CSRF tokens on forms or in headers
- No explicit SameSite cookie configuration visible in code (relying on Supabase SSR defaults)
- No Origin/Referer header validation

**Remediation Required**:  
1. Verify Supabase SSR cookie configuration sets `SameSite=lax` or `SameSite=strict`
2. If not set, configure cookies explicitly with secure attributes
3. Consider adding CSRF tokens for high-risk operations (account deletion, audit execution)
4. Validate Origin header on state-changing requests

---

### MEDIUM

#### M1: In-Memory Rate Limiter Not Distributed
**Severity**: MEDIUM  
**Category**: Rate Limiting  
**Status**: Documented limitation, acceptable with caveats

**Description**:  
The rate limiter uses in-memory token buckets (`Map<RateLimitKey, Bucket>`). On Vercel serverless, each function instance has its own memory, so rate limits are per-instance, not global. An attacker can bypass limits by triggering cold starts or hitting different instances.

**Why This Is Acceptable**:  
- Documented as "best-effort" in code comments
- Supabase Auth provides its own server-side throttling as a backstop
- Raises the bar vs. no protection
- Adding Redis/distributed state would increase complexity and cost significantly

**Mitigation**:  
- Monitor for abuse patterns in logs
- Consider upgrading to distributed rate limiting if abuse is detected in production
- Keep limits conservative to account for per-instance behavior

#### M2: X-Forwarded-For Header Trust
**Severity**: MEDIUM  
**Category**: Rate Limiting / IP Spoofing  
**Status**: Needs verification

**Description**:  
`clientIp()` extracts the first IP from `X-Forwarded-For` without validating that the request came through a trusted proxy. If deployed without proper proxy configuration, attackers can spoof their IP by setting `X-Forwarded-For: 1.2.3.4` to bypass per-IP rate limits.

**Attack Scenario**:  
1. Attacker sends request with header `X-Forwarded-For: 1.2.3.4`
2. Rate limiter buckets the request under IP `1.2.3.4`
3. Attacker rotates the spoofed IP to bypass rate limits

**Why This May Be Acceptable**:  
- Vercel automatically sets X-Forwarded-For and overwrites any client-provided value
- If deployed on Vercel, this is not exploitable
- If deployed elsewhere, proxy must be configured to overwrite XFF

**Remediation**:  
- Document deployment requirement: must be behind a trusted proxy that overwrites XFF
- OR: Validate that the request came from a trusted proxy IP before trusting XFF
- OR: Use a different IP extraction method (e.g., `req.socket.remoteAddress` behind a proxy)

---

### LOW

#### L1: Cookie Security Attributes Not Explicitly Configured
**Severity**: LOW  
**Category**: Cookie Security  
**Status**: Needs verification

**Description**:  
Cookie security attributes (Secure, HttpOnly, SameSite, Path, Domain) are delegated to @supabase/ssr defaults. These should be verified to ensure they meet production security requirements.

**Expected Configuration**:
- `Secure: true` (HTTPS only)
- `HttpOnly: true` (no JavaScript access)
- `SameSite: lax` or `strict` (CSRF protection)
- `Path: /` (appropriate scope)
- `Domain: <app-domain>` (not overly broad)

**Remediation**:  
- Verify @supabase/ssr v0.12.4 defaults
- If defaults are insufficient, configure cookies explicitly in createServerClient()

#### L2: No Explicit CORS Configuration
**Severity**: LOW  
**Category**: CORS  
**Status**: Acceptable (same-origin only)

**Description**:  
No explicit CORS headers are set. This is correct for a same-origin application, but there's no explicit configuration to prevent accidental cross-origin access if the deployment changes.

**Why This Is Acceptable**:  
- Next.js API routes are same-origin by default
- No `Access-Control-Allow-Origin` headers are set
- Browser will block cross-origin requests without CORS headers

**Recommendation**:  
- Document that the app is same-origin only
- If CORS is needed in the future, configure explicitly with allowlisted origins

---

### INFO

#### I1: No SSRF Vectors
**Status**: Verified secure  
**Description**: No server-side fetching of user-controlled URLs. The only external HTTP call is to the Fireworks AI API with a hardcoded base URL from environment variables.

#### I2: No XSS Vectors
**Status**: Verified secure  
**Description**: 
- No `dangerouslySetInnerHTML` usage
- No `innerHTML` usage
- React auto-escapes all rendered content
- AI output is validated and rendered as text, not HTML

#### I3: Service-Role Key Isolation
**Status**: Verified secure  
**Description**: 
- `import "server-only"` in admin.ts prevents client bundling
- Service-role key only used in server-side code
- Never exposed in API responses or logs

#### I4: RLS Enforcement
**Status**: Verified secure  
**Description**: 
- All user-facing queries use session client (RLS-scoped)
- Service-role client only used for internal operations after authorization
- Cross-user access returns 404 (not 403) to prevent information disclosure

#### I5: File Upload Validation
**Status**: Verified secure  
**Description**: 
- Extension allowlist (.py, .zip only)
- Size limit (10 MB)
- MIME type validation
- Magic byte validation (ZIP: PK\x03\x04)
- Content validation (text heuristic for Python)
- Filename sanitization (path traversal prevention)
- Storage path derived from server-verified values only

#### I6: AI Security
**Status**: Verified secure  
**Description**: 
- AI output validated against schema
- Performance claims rejected (hallucination defense)
- No secrets in prompts
- Provider errors logged without API keys
- AI output rendered as text, not executed

#### I7: Error Message Sanitization
**Status**: Verified secure  
**Description**: 
- No stack traces in API responses
- No internal error details leaked
- Generic error messages for users
- Detailed errors logged server-side only

#### I8: Redirect Validation
**Status**: Verified secure  
**Description**: 
- Auth callback validates redirect URL (must start with `/`, not `//`)
- No open redirect vulnerabilities found

---

## Controls Verified (Secure)

1. ✅ Authentication: Server-validated via Supabase Auth
2. ✅ Authorization: RLS enforced on all tables
3. ✅ IDOR/BOLA: Cross-user access returns 404
4. ✅ Input Validation: Comprehensive upload validation
5. ✅ Storage Security: Private bucket, user-prefix isolation
6. ✅ AI Security: Output validation, no performance claims
7. ✅ Service-Role Isolation: server-only import, never in client
8. ✅ Security Headers: CSP, HSTS, X-Frame-Options, etc.
9. ✅ Logging Security: No sensitive data logged
10. ✅ Error Handling: No stack traces or internal details leaked
11. ✅ XSS Prevention: No dangerouslySetInnerHTML, React auto-escaping
12. ✅ SSRF Prevention: No user-controlled URL fetching
13. ✅ Path Traversal Prevention: Filename sanitization, server-controlled paths
14. ✅ Request IDs: Correlation for log tracing
15. ✅ Rate Limiting: Per-IP and per-user limits (with documented limitations)

---

## Threat Model

### Attacker Capabilities
- Can create accounts and authenticate
- Can upload files (.py, .zip)
- Can create and execute audits
- Can view their own audit results
- Can attempt to access other users' audits
- Can send crafted requests to API endpoints
- Can attempt to bypass rate limits
- Can attempt CSRF attacks (if cookies are not SameSite)

### Attacker Goals
- Access other users' audit data (IDOR/BOLA)
- Execute audits on behalf of other users (CSRF)
- Bypass rate limits to perform bulk operations
- Upload malicious files to execute code (RCE)
- Extract service-role key or other secrets
- Perform denial-of-service attacks
- Escalate privileges

### Trust Boundaries
1. **Browser → API**: Authenticated via cookies, validated server-side
2. **API → Database**: RLS enforced, service-role only for internal operations
3. **API → Storage**: Service-role client, paths derived from server-verified values
4. **API → AI Provider**: Hardcoded base URL, no user-controlled URLs
5. **Worker → Database**: Service-role client, processes queued jobs only

### Attack Surfaces
1. **Authentication endpoints**: Login, signup, logout (rate-limited)
2. **Audit creation**: File upload, JSON input (validated, rate-limited)
3. **Audit execution**: Queue-based, durable (rate-limited)
4. **Audit results**: RLS-scoped reads (authorized)
5. **File storage**: Private bucket, user-prefix isolation (authorized)
6. **AI enrichment**: Provider API, output validation (controlled)

---

## Next Steps

### Phase B: Attack Path Analysis
Analyze HIGH findings (H1: CSRF) in detail:
1. Verify Supabase SSR cookie configuration
2. Determine if SameSite is set correctly
3. If not, implement CSRF protection
4. Add regression tests

### Phase C: Implementation
- Fix H1 (CSRF) if vulnerable
- Document M1 (rate limiter) and M2 (XFF trust) as known limitations
- Verify L1 (cookie attributes) and document

### Phase D: Regression Tests
- Add CSRF protection tests
- Add cookie attribute verification tests
- Add rate limit bypass tests (document limitations)

### Phase E: Verification
- Run all tests
- Verify no regressions
- Produce final security report
