# Insurance Flow Pro

Build a professional web-based CRM/ERP system for an insurance aggregator/brokerage firm in Pakistan.

The CRM should be modern, responsive, secure, role-based, and optimized for insurance sales, income tracking, and management reporting.

The UI should feel like a simplified version of Salesforce/HubSpot/Zoho but focused specifically on insurance operations.

USER ROLES

1. Admin

Full access to everything.

Permissions:

Create/edit/delete users

Create teams

Create insurance companies

Create insurance types

Create deal stages

Create lead sources

Access all dashboards and reports

Manage permissions

2. Management

Can:

View all dashboards

View reports

View all deals

View team performance

View income analytics

Export reports

Cannot:

Delete master data

3. Team Lead

Can:

View only his team

Manage his team’s DOs

View team deals

View team dashboard

Track performance

4. DO (Sales Agent)

Can:

Create clients

Create deals

Update stages

Upload documents

View only their own clients and deals

TEAM CREATION MODULE

Admin can create teams.

Fields:

Team Name

Team Location

Default Teams:

Lahore Head Office

Shahdra Team

Karachi Team

Lahore Team A

Each team should have:

Team Lead

Multiple DOs

DO (SALES AGENT) CREATION MODULE

Fields:

DO Name

DO Email

DO Number

DO Designation

Team (dropdown)

Team Lead (auto linked from selected team)

Permissions:

DO sees only own data

Team Lead sees team data

Management sees all data

CLIENT CREATION MODULE

Fields:

Client Company Name

POC Name

POC Number

POC Email

POC Address

Industry

NTN (optional)

Existing Insurance Company

Notes

Features:

Search clients

Client history

File attachments

Deal history under client

DEAL CREATION MODULE

When a deal is created:

Auto-generate Deal Number

Fields:

Basic Information

Deal Number (auto generated)

Cover Note Number

Policy Number

Source

Insurance Company

Insurance Type

Stage

Assigned DO

Assigned Team

Admin can create/edit:

Sources

Insurance Companies

Insurance Types

Deal Stages

PREMIUM & COMMISSION SECTION

Fields:

Gross Premium

Net Premium

Commission Percentage

Marketing Budget Percentage

Loading (PKR)

B2B Commission (PKR)

AUTO CALCULATIONS

Commission Before Tax

Multiply:
Commission Percentage × Gross Premium

Commission After Tax

Deduct 17% tax from commission before tax

Formula:
Commission Before Tax - 17%

Marketing Budget Before Tax

Multiply:
Marketing Budget Percentage × Gross Premium

Marketing Budget After Tax

Deduct 9% tax

Formula:
Marketing Budget Before Tax - 9%

Total Income

Formula:
Commission After Tax

Marketing Budget After Tax

Loading

B2B Commission

Income Percentage

Formula:
(Total Income ÷ Gross Premium) × 100

Tagged Premium Percentage

Formula:
(Income Percentage ÷ Base Percentage 13%) × 100

Tagged Premium Logic

IF Tagged Premium Percentage < 100:
Tagged Premium =
(Tagged Premium Percentage × Gross Premium)

ELSE:
Tagged Premium =
Gross Premium

DASHBOARDS

Create modern visual dashboards with charts, KPI cards, and filters.

MAIN DASHBOARD KPIs

Show:

Gross Premium

Net Premium

Tagged Premium

Total Income

Total Deals

Won Deals

Lost Deals

Active Deals

Renewal Pipeline

REPORTING & FILTERS

Allow dynamic/custom reporting by:

DO (Sales Agent)

Team

Insurance Company

Insurance Type

Month

Quarter

Year

Stage

Source

ANALYTICS

Charts:

Monthly premium trend

Income trend

Team performance

DO performance

Insurance company contribution

Insurance type contribution

RENEWAL MANAGEMENT

Track:

Expiring policies

Upcoming renewals

Renewal reminders

Renewal dashboard

Alerts:

30 days before expiry

15 days before expiry

7 days before expiry

DOCUMENT MANAGEMENT

Allow uploads:

Quotations

Policies

Cover notes

Invoices

Client documents

Store documents under:

Client

Deal

SEARCH & FILTER SYSTEM

Global search for:

Deal number

Policy number

Client name

DO name

Insurance company

EXPORT FEATURES

Allow exporting:

Excel

CSV

PDF

For:

Dashboards

Reports

Income reports

Team performance

UI/UX REQUIREMENTS

Design:

Corporate modern UI

Sidebar navigation

Fast workflow

Mobile responsive

Clean forms

Dashboard cards

Tables with filters

Theme:

Professional blue/white insurance theme

TECH STACK

Frontend:

React

Tailwind CSS

Backend:

Node.js + Express

Database:

PostgreSQL

Authentication:

Secure JWT login

Hosting:

Vercel frontend

Supabase/Render backend

IMPORTANT BUSINESS LOGIC

This CRM is NOT a generic CRM.

It is specifically designed for:

Insurance brokerage operations

Commission tracking

Premium tracking

Tagged premium calculations

Team hierarchy

Insurance reporting

Renewal management

The system should prioritize:

Speed

Simple workflow

Financial visibility

Sales tracking

Insurance-specific reporting

Avoid unnecessary complexity.

Build the system in modular scalable architecture

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://pk-policy-hub.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/17ca6d6b-12e3-4d07-900a-ba318d3d6b27).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
