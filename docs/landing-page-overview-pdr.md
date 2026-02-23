# Project Overview & Product Development Requirements (PDR)

## 1. Project Overview
**Project Name:** Crown Mercado Sign-Up Portal
**Purpose:** Provide a seamless, automated interface for users to request and provision dedicated instances of the Crown Mercado system.

## 2. Target Audience
- B2B clients requiring isolated system environments.
- Individual entrepreneurs looking for custom-branded system instances.
- System administrators managing multiple system deployments.

## 3. Core Value Proposition
- **Automation:** Reduces manual intervention in system setup.
- **Speed:** Rapid provisioning (15-20 minutes) compared to manual configuration.
- **Branding:** Supports custom subdomains (e.g., `company.crownmercado.com`).
- **Simplicity:** Intuitive single-page registration process.

## 4. Functional Requirements

### 4.1 Registration Form
- **Fields:**
    - `email`: Validated email address for administrative contact.
    - `companyName`: Name of the organization.
    - `subdomain`: Desired subdomain prefix (validated for alphanumeric and hyphens).
    - `acceptTerms`: Mandatory checkbox for terms of service.
- **Validation:** Real-time feedback using Zod and React Hook Form.

### 4.2 Provisioning Integration
- **API Call:** Send a POST request to the AWS provisioning endpoint on form submission.
- **Payload:**
    ```json
    {
      "admin_email": "string",
      "subdomain": "string",
      "company_name": "string"
    }
    ```
- **Feedback:** Success/Error notifications via Toast.

### 4.3 Content Sections
- **Hero:** Impactful introduction to the system.
- **Features:** Highlight key benefits of the Crown Mercado system.
- **Footer:** Links and copyright information.

## 5. Non-Functional Requirements
- **Performance:** Optimized bundle size using Vite.
- **Responsiveness:** Mobile-first design using Tailwind CSS.
- **Type Safety:** Comprehensive TypeScript implementation.
- **Accessibility:** ARIA-compliant UI components via shadcn/ui (Radix UI).

## 6. Success Metrics
- Average time to complete registration < 2 minutes.
- API success rate > 99%.
- Mobile conversion rate comparable to desktop.
