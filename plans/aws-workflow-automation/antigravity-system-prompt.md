# Role: Senior Frontend Engineer
# Task: Implement Automated Provisioning Flow

Connect the Crown Mercado Registration Form to our AWS Orchestration API.

## Technical Specifications:
- **Endpoint URL:** `https://o089jvtm32.execute-api.ap-southeast-2.amazonaws.com/provision`
- **Method:** `POST`
- **Payload Schema:**
  ```json
  {
    "admin_email": "string",  // Email of the user
    "subdomain": "string",    // Alphanumeric only, no spaces
    "company_name": "string"  // Display name
  }
  ```

## UI/UX Requirements:
1. **Form Validation (Zod):** 
   - `subdomain` MUST be regex `/^[a-z0-9]+$/` (lowercase only).
   - `admin_email` must be a valid email.
2. **The "Wait" State:** 
   - **CRITICAL:** Backend provisioning (Docker startup + Port allocation) takes 30-60 seconds.
   - You MUST implement a "Provisioning in progress..." loading state with a progress bar or spinner. 
   - Do NOT timeout the request; set the fetch timeout to at least 90 seconds.
3. **Success State:**
   - On success (200 OK), extract `accessUrl` from the response.
   - Display a "Success" card showing the link and a message: "An email with your credentials has been sent to [email]."
4. **Error Handling:**
   - Handle 400 (Validation error) and 500 (Server busy/limit reached) with Toast notifications.

## Implementation Details:
- Framework: Next.js (App Router)
- Styling: Tailwind CSS + shadcn/ui
- Notification: sonner or react-hot-toast
