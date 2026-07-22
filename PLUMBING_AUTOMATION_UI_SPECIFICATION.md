# Plumbing Automation Dashboard

**User Interface Specification**

**Primary design reference:** AwaazLabs Client Dashboard  
**Secondary business reference:** Finova Plumbing Ops dashboard: https://plumbing-automation-agent.netlify.app/admin  
**Document type:** Frontend information architecture, content, and design-reuse specification  

This document defines the complete user interface adaptation of the existing AwaazLabs dashboard for a plumbing automation business using Retell voice and chat agents. It establishes final wording, page purpose, content placement, navigation, statuses, actions, and design-reuse requirements.

The document is intentionally limited to frontend structure and product language. It does not define backend architecture, database design, APIs, integration steps, or code changes.

---

## Table of Contents

1. [Purpose and Scope](#1-purpose-and-scope)
2. [Reference Hierarchy and Inspection Findings](#2-reference-hierarchy-and-inspection-findings)
3. [Product Assumptions](#3-product-assumptions)
4. [Final Information Architecture](#4-final-information-architecture)
5. [Global Terminology](#5-global-terminology)
6. [Canonical UI Status Models](#6-canonical-ui-status-models)
7. [Global Design Reuse Requirements](#7-global-design-reuse-requirements)
8. [Cross-Page Interaction Rules](#8-cross-page-interaction-rules)
9. [Page-by-Page Specifications](#9-page-by-page-specifications)
10. Migration Mapping
11. Content and Copy Standards
12. Acceptance Criteria
13. Research References

---

## 1. Objective

The plumbing dashboard will reuse the established AwaazLabs visual system and page architecture while replacing the healthcare operating model with a plumbing service workflow.

The primary operational journey is:

1. A customer contacts the business through a Retell-powered inbound call or supported chat channel.
2. The AI Receptionist captures the service need, service address, urgency, and preferred service window.
3. A job is created and becomes visible in Jobs.
4. A job that requires plumber assignment enters the Dispatch Queue.
5. The Plumber Dispatch Agent contacts qualified plumbers based on specialty, service area, and availability.
6. A plumber accepts the job and the assignment becomes visible across Jobs, Dispatch Queue, and Conversations.
7. Human-owned emergencies, safety events, explicit transfer requests, and exhausted dispatch attempts appear in Escalations.
8. Completed interactions are graded in Quality and Optimization.
9. Completed jobs feed review outreach, follow-up, re-engagement, campaigns, and reporting.

---

## 2. Product Assumptions

The following assumptions are final for this UI specification.

### 2.1 Business Model

- The dashboard serves a plumbing service operation with a managed network of plumbers.
- Plumbers are operational resources, not dashboard members by default.
- Each plumber has specialties, service areas, availability, contact information, and performance data.
- Dashboard users are owners, managers, dispatchers, and viewers.
- The canonical worker term in the interface is **Plumber**. The terms provider, contractor, engineer, and technician are not used as interchangeable labels.

### 2.2 Intake and Job Creation

- An inbound customer interaction creates one job after the required service details are captured.
- The inbound agent captures a preferred service window, not a guaranteed arrival window.
- The scheduled arrival window is displayed only after a plumber assignment is accepted and confirmed.
- A customer can contact the business by Voice Agent by Retell
- The canonical work-record term is **Job**. Service request, ticket, appointment, case, and work order are not used as competing top-level labels.

### 2.3 Dispatch

- Every ready job requiring a plumber enters the Dispatch Queue.
- Plumber qualification is represented in the UI by required specialty, service area, and availability.
- The Plumber Dispatch Agent contacts qualified plumbers one at a time.
- The first explicit acceptance produces the active assignment.
- Failed or declined individual attempts do not mark the job as failed.
- A dispatch becomes Exhausted only after all eligible candidates or the configured attempt window has been exhausted.
- Exhausted dispatches remain visible in Dispatch Queue and create a linked human-owned escalation.

### 2.4 Escalation

- Escalations are not a second dispatch list.
- Escalations contain only items that require human ownership.
- Escalation triggers are customer-requested transfer, emergency condition, safety risk, out-of-service-area request, no suitable plumber, dispatch exhausted, and agent failure.
- Every escalation has an owner, severity, acknowledgement state, age, and resolution note.
---

## 3. Canonical UI Status Models

Status labels are sentence case in controls and title case in compact chips. The same label must be used in cards, filters, tables, drawers, charts, exports, and empty states.

### 3.1 Job Status

| Status | UI meaning |
|---|---|
| New | Job created; intake review is still available to staff. |
| Ready for Dispatch | Required intake is complete and plumber assignment can begin. |
| Dispatching | Plumber matching or outreach is active. |
| Assigned | A plumber accepted or was manually assigned. |
| Scheduled | An arrival window has been confirmed. |
| En Route | The assigned plumber is traveling to the service address. |
| In Progress | On-site work has started. |
| Completed | Service work is finished. |
| Canceled | The customer or business canceled the job. |

### 3.2 Assignment Status

| Status | UI meaning |
|---|---|
| Unassigned | No active plumber candidate is assigned. |
| Matching | Eligible plumbers are being evaluated. |
| Contacting | An outbound plumber call is active. |
| Awaiting Response | Contact was made and a final response is pending. |
| Accepted | A plumber accepted the job. |
| Manually Assigned | A team member assigned a plumber. |
| Exhausted | No eligible plumber accepted within the dispatch attempt window. |

### 3.3 Plumber Outreach Outcome

- Accepted, Declined, No Answer, Voicemail, Unavailable, Failed, Canceled Before Contact.

The outcome belongs to one outreach attempt. It does not replace Job Status or Assignment Status.

### 3.4 Job Priority

| Priority | Presentation |
|---|---|
| Routine | Neutral chip. |
| Urgent | Amber warning chip with text and warning icon. |
| Emergency | Red destructive chip with text and alert icon. |

Emergency is reserved for situations requiring immediate human review or emergency guidance. It is never inferred from color alone.

### 3.5 Escalation Status

- Open, Acknowledged, Resolved.

### 3.6 Escalation Severity

| Severity | Acknowledgement threshold |
|---|---|
| Attention | 4 hours |
| Urgent | 30 minutes |
| Critical | 15 minutes |

An escalation past its threshold displays an aging badge and appears in the Overview attention banner.

### 3.7 Escalation Trigger

- Customer Requested Human, Emergency Condition, Safety Risk, Out of Service Area, No Suitable Plumber, Dispatch Exhausted, Agent Failure.

### 3.8 Call Disposition

- Job Created, Existing Job Updated, Information Provided, Human Transfer, Emergency Escalation, Out of Service Area, Duplicate Request, Voicemail, No Answer, Abandoned.

### 3.9 Chat Outcome

- Resolved, Job Created, Escalated, Abandoned.

### 3.10 Review Outreach Status

- Eligible, Contacted, Reached, Ask Delivered, Link Sent, Review Posted, Declined, Opted Out.

### 3.11 Campaign Status

- Draft, Scheduled, Running, Paused, Completed.

### 3.12 Campaign Contact Status

- Queued, Attempted, Reached, Job Created, Exhausted, Opted Out.

### 3.13 Quality Flag Status

- Submitted, Under Review, Resolved.

### 3.14 Optimization Status

- Detected, In Tuning, Deployed, Verified.

### 3.15 Knowledge Request Status

- Requested, In Review, Scheduled, Live.

### 3.16 Notification Delivery Status

- Sent, Failed.

---

## 4. Global Design Reuse Requirements

### 4.1 Visual Direction

The plumbing dashboard retains the AwaazLabs light visual system:

- White page and card surfaces.
- Near-black navy primary text.
- Muted blue-gray secondary text.
- Pale blue-gray borders and selected-navigation fills.
- Dark navy primary buttons.
- Red reserved for destructive or critical states.
- Amber reserved for warning states.
- Existing categorical and sequential chart palette.

The dark visual treatment of the secondary plumbing reference is not used.

### 4.2 Application Shell

- Desktop sidebar width remains 256 pixels when expanded and 64 pixels when collapsed.
- Sidebar stays sticky and full height.
- Brand and organization name remain at the top of the sidebar.
- Sidebar group headings remain 11-pixel uppercase labels with wide tracking.
- Navigation icons remain compact line icons.
- Active navigation uses the existing muted fill and medium text weight.
- Top bar remains 56 pixels high and sticky.
- Main content retains 16-pixel horizontal padding on smaller screens and 24-pixel horizontal padding from the medium breakpoint.
- Standard main-content vertical padding remains 24 pixels.

### 4.3 Top Bar

The final top bar contains:

- Organization switcher for multi-organization users.
- Business Location filter for multi-location organizations.
- Live clock in the active Business Location timezone.
- Notifications bell and unread count.
- User menu.

The PHI-BAA or NON-PHI mode badge is removed. No replacement badge is introduced.

### 4.4 Typography

- Use the existing system sans-serif stack.
- Page title: 24 pixels, semibold, tight tracking.
- Page description: 14 pixels, muted foreground.
- Card title: existing card-title scale and weight.
- KPI label: 14 pixels, medium, muted.
- KPI value: 30 pixels, semibold, tabular numerals.
- Table and control text: 14 pixels.
- Metadata and helper text: 12 pixels.
- Sentence case is used for headings, labels, buttons, filters, and statuses.

### 4.5 Spacing and Shape

- Standard page section gap: 24 pixels.
- Overview major-section gap: 32 pixels.
- Card padding: 24 pixels.
- Filter-panel padding: 16 pixels.
- Table cell padding: 12 pixels.
- Large radius: 12 pixels.
- Medium radius: 8 pixels.
- Small radius: 6 pixels.
- Cards retain the existing one-pixel border and subtle shadow.

### 4.6 Page Headers

Every page uses the existing PageHeader layout:

- Title and description on the left.
- Actions on the right.
- Actions move below the title block on narrow screens.
- Page headers do not contain decorative illustrations.

### 4.7 KPI Cards

- KPI cards retain the current responsive grid.
- Cards can include a primary value, comparison delta, tooltip, sub-statistics, or compact chart.
- Clickable KPI cards open a pre-filtered owning page.
- Red accent is used only for critical or needs-attention values.
- Positive values remain neutral unless an established chart color is required.

### 4.8 Filters

- Filter controls remain inside bordered card surfaces.
- Search is the first control.
- Filters wrap on smaller widths.
- Applied filters are visible without opening a menu.
- Clear Filters appears only when at least one filter is active.
- Date controls use From and To labels.
- Filter labels use the canonical terms in Section 5.

### 4.9 Tables

- Tables remain the primary representation for operational records.
- Headers remain muted and medium weight.
- Rows use the existing bottom border and subtle hover treatment.
- Long tables scroll horizontally.
- Clicking a row opens the page drawer.
- The first identifying cell contains the accessible open-record button.
- Row-level buttons stop row-click propagation.
- Every table has a meaningful accessible caption.
- Empty tables use the shared EmptyState component rather than a blank body.

### 4.10 Drawers and Modals

- Record detail uses the existing right-side Drawer.
- Desktop drawer maximum width remains 640 pixels.
- Mobile drawers occupy full width.
- Drawer header stays visible while the body scrolls.
- Drawer sections use uppercase metadata labels and two-column definition grids where space permits.
- Modal dialogs are reserved for focused create, edit, confirmation, or destructive actions.
- Server logs, console access, and test-call controls do not appear in the client dashboard.

### 4.11 Charts

- Charts remain inside ChartFrame cards.
- Every chart includes a title, concise description, legend, tooltip, and View as Table control.
- Colors use the existing chart tokens.
- A status meaning is never communicated by chart color alone.
- Date-range controls use 7D, 30D, and 90D where the page supports trend comparison.
- Empty charts show a labeled no-data state rather than fabricated zero trends.

### 4.12 Responsive Behavior

The existing AwaazLabs responsive behavior is preserved:

- Sidebar remains desktop-only below the medium breakpoint.
- Content grids collapse to one column.
- KPI grids reduce column count based on available width.
- Filter controls wrap.
- Tables scroll horizontally.
- Drawers become full-width.
- Page-header actions stack beneath titles.
- Charts resize to their card width.

### 4.13 Accessibility

- Maintain visible keyboard focus.
- Preserve reduced-motion behavior.
- Use icons together with text for status and priority.
- Keep keyboard-operable tabs, drawers, dropdowns, and row-open buttons.
- Provide accessible names that identify the record, not generic labels such as Open.
- Masked values must announce whether reveal access is available.

### 4.14 Final Sidebar Navigation

The sidebar keeps the existing AwaazLabs section order. The plumbing adaptation uses the following final labels:

Implementation note: when adapting this repository, only the first two AGENTS entries are renamed and repurposed for plumbing operations. The remaining AGENTS tabs listed below them remain in the same position and continue to use the same page structure unless a later specification explicitly changes them.

- **HOME**
  - Overview
- **OPERATIONS**
  - Jobs
  - Conversations
  - Escalations
  - Dispatch Queue
- **AGENTS**
  - AI Receptionist
  - Plumber Dispatch Agent
  - Chat Agents
  - Review Taker
  - Reengagement
  - Post-Service Follow-Up
- **QUALITY**
  - Quality and Optimization
  - Agent Knowledge
- **GROWTH**
  - Reviews
  - Campaigns
- **INSIGHTS**
  - Reports and Exports
- **COMPLIANCE**
  - Audit Log
- **SETTINGS**
  - Members
  - Usage and Billing
  - Organization and Locations
  - Lines and Numbers
  - Consent and Do-Not-Call
  - Notifications

---

## 5. Page-by-Page Specifications

### 5.1 Overview

#### Page identity

> **Sidebar label:** Overview  
> **Page title:** Overview  
> **Page description:** Daily view of jobs, dispatch performance, customer conversations, agent quality, and operational attention items.

#### Purpose

Overview is the daily-glance page for owners, managers, and dispatchers. It presents business outcomes before technical telemetry. Every card links to the page that owns the underlying records.

#### AwaazLabs layout reused

Reuse the complete current Overview composition:

- PageHeader.
- Conditional attention banner.
- Live Calls panel.
- Four-card outcome sections.
- Compact distribution bars.
- Revenue estimate card.
- Quality pulse card.
- Operational telemetry cards and charts.

#### Content order

1. Page header.
2. Needs Your Attention banner.
3. Live Calls Now panel.
4. Jobs section.
5. Dispatch section.
6. Revenue Influenced section.
7. Quality Pulse section.
8. Operational Telemetry section.

#### Needs Your Attention banner

The banner appears when one or more of the following conditions exists:

- Critical or overdue escalation.
- Dispatch record in Exhausted status.
- Urgent dispatch record beyond its assignment threshold.
- Voice or messaging line health failure.
- Usage at or above 90 percent of plan allocation.

Each banner item is a separate deep link. Critical items use the destructive variant.

#### Live Calls Now

Show:

- Number of active calls.
- Live status badge.
- Active agent.
- Direction.
- Customer or plumber role.
- Elapsed duration.
- Current call stage.
- Last refresh time.

The card opens Calls filtered to active interactions.

#### Jobs KPI cards

- **Created Today:** Count and delta versus the same weekday last week.
- **Created This Week:** Count with job-creation rate from completed inbound service-intent conversations.
- **Scheduled Next 7 Days:** Count; opens Jobs filtered to Scheduled.
- **Completed and Canceled This Week:** Counts with completion rate.

#### Jobs chart

**Title:** Jobs created over time  
**Controls:** 7D and 30D  
**Series:** Voice, Web Chat, SMS, WhatsApp, Staff Entry  
**Behavior:** Stacked by intake channel.

#### Dispatch KPI cards

- **In Dispatch:** Unassigned, Matching, Contacting, and Awaiting Response combined.
- **Assigned Today:** Accepted and Manually Assigned combined.
- **Assignment Rate:** Assigned jobs divided by jobs that entered dispatch.
- **Needs Attention:** Exhausted and overdue dispatch records; destructive accent.

#### Dispatch distribution

Display a compact horizontal distribution using:

- Unassigned.
- Matching.
- Contacting.
- Awaiting Response.
- Accepted.
- Exhausted.

#### Revenue Influenced

Display one card:

- **Estimated Revenue Influenced This Month.**
- Calculation wording in tooltip: completed AI-created jobs multiplied by configured Average Job Value.
- Show contributing completed jobs and configured Average Job Value as sub-statistics.
- Hide the card when Average Job Value is not configured.
- Label the value as an estimate.

#### Quality Pulse

Show:

- Current aggregate quality score out of 100.
- 30-day sparkline.
- Optimization events this month.
- Link to Quality and Optimization.

#### Operational Telemetry

Show:

- Interaction count by agent and Overall.
- Calls Today.
- Voice Minutes Today.
- Average Call Duration.
- Average Cost per Interaction.
- Calls Over Time chart.
- Voice Minutes Over Time chart.
- Average First-Audio Response with an 800-millisecond target line.
- Interaction Success Rate with completed and attempted counts.

#### Empty and degraded states

- No live calls: **No calls are currently in progress.**
- No jobs: **New jobs will appear after the AI Receptionist, Chat Agent, or a team member completes intake.**
- No dispatch activity: **Jobs ready for plumber assignment will appear here.**
- Data unavailable: show a page-level banner while preserving the last visible scope.

---

### 5.2 Jobs

#### Page identity

> **Sidebar label:** Jobs  
> **Page title:** Jobs  
> **Page description:** The complete record of customer work, from intake through assignment, service, and completion.

#### Purpose

Jobs is the master operational record. It contains every job, including jobs that do not currently require dispatch action. It is the only page that presents the complete job lifecycle.

#### AwaazLabs layout reused

Reuse the current Appointments page:

- PageHeader.
- Five-card statistics strip.
- Search and filter card.
- Scope control.
- Table and Calendar tabs.
- Day and Week calendar controls.
- Paginated table.
- Export control.
- Right-side detail drawer.
- Manual outcome actions, notes, timeline, and flag-for-review sections.

#### Header KPI cards

- **Created Today.**
- **Scheduled Next 7 Days.**
- **Assignment Rate.**
- **Completion Rate, 30 Days.**
- **Next Scheduled Job.**

Assignment Rate includes Accepted and Manually Assigned jobs. Completion Rate excludes Canceled jobs from the denominator.

#### Scope control

Provide two compact scope buttons above the view tabs:

- **All Jobs.**
- **Needs Attention.**

Needs Attention contains Ready for Dispatch jobs without active dispatch, Exhausted dispatches, overdue Scheduled jobs without progress, and Emergency jobs without an acknowledged escalation.

#### View tabs

- **Table.**
- **Calendar.**

Calendar provides:

- **Day.**
- **Week.**

The calendar displays Requested Service Window until a Scheduled Arrival Window exists. It does not support drag-to-reschedule.

#### Filters

- Date range.
- Job Status.
- Assignment Status.
- Priority.
- Issue Type.
- Intake Channel.
- Required Specialty.
- Assigned Plumber.
- Service Area.
- Business Location.
- Language.
- Search by customer name, phone, job reference, ZIP code, or service address.

#### Table columns

Display columns in this order:

1. Service Window.
2. Customer.
3. Phone.
4. Issue or Job Type.
5. Intake Channel.
6. Priority.
7. Job Status.
8. Assignment Status.
9. Assigned Plumber.
10. Created By.
11. Service Area.
12. Business Location, when multiple locations exist.

Customer opens the drawer. Phone remains masked until authorized reveal.

#### Job drawer

The drawer title is the customer name. The description line contains Job Type, Job Status, and job reference.

Sections appear in this order:

1. **Job Record**
   - Job reference.
   - Customer.
   - Masked phone.
   - Service address.
   - ZIP code.
   - Issue Type.
   - Job Type.
   - Customer description.
   - Priority.
   - Requested Service Window.
   - Scheduled Arrival Window.
   - Intake Channel.
   - Language.

2. **Originating Interaction**
   - Source call or chat.
   - Agent.
   - Interaction timestamp.
   - Outcome.
   - Open Conversation action.

3. **Dispatch and Assignment**
   - Assignment Status.
   - Required Specialty.
   - Service Area.
   - Assigned Plumber.
   - Assignment timestamp.
   - Attempts count.
   - Open Dispatch Record action.

4. **Customer Communication**
   - Job-created confirmation.
   - Assignment confirmation.
   - Arrival-window notification.
   - Reschedule or cancellation notices.

5. **Timeline**
   - Job created.
   - Ready for Dispatch.
   - Dispatch started.
   - Plumber assigned.
   - Scheduled.
   - En Route.
   - In Progress.
   - Completed or Canceled.

6. **Outcome**
   - Mark En Route.
   - Mark In Progress.
   - Mark Completed.
   - Cancel Job.
   - Status actions are displayed only when valid for the current status.

7. **Staff Notes**
   - Append note.
   - Note history with author role and timestamp.

8. **Flag for Review**
   - Flag Interaction button.
   - Reason selector.
   - Additional context.

#### Primary actions

- Export CSV.
- Open Conversation.
- Open Dispatch Record.
- Reveal Phone.
- Mark En Route.
- Mark In Progress.
- Mark Completed.
- Cancel Job.
- Add Note.
- Flag Interaction.

#### Empty and degraded states

- First use: **No jobs yet. New jobs created by the AI Receptionist, Chat Agent, or a team member will appear here.**
- Filtered: **No jobs match these filters. Adjust the date, status, assignment, priority, or search filters.**
- Calendar: **Nothing scheduled in this window. Jobs outside the selected day or week remain available in Table view.**
- Data unavailable: **Job data is temporarily unavailable.**

---

### 5.3 Conversations

#### Page identity

> **Sidebar label:** Conversations  
> **Page title:** Conversations  
> **Page description:** Review every customer and plumber interaction handled by the automation agents.

#### Purpose

Conversations is the unified interaction record. It answers what the agent said, what the other party said, what outcome was reached, and which job, assignment, escalation, review, or campaign resulted.

#### AwaazLabs layout reused

Reuse the complete current Conversations shell:

- PageHeader.
- Calls and Chats sub-navigation.
- Shared persistent filter state.
- Live Calls panel on Calls.
- Dense interaction tables.
- Recording player.
- Transcript with speaker labels.
- QA grade breakdown.
- Linked-record panels.
- Flag-for-review action.
- Right-side drawers.

#### Shared filters

- Date range.
- Agent.
- Channel.
- Direction.
- Outcome.
- Priority.
- QA Grade band.
- Business Location.
- Search by customer name, plumber name, phone, job reference, or conversation reference.

#### Calls tab

##### Calls table columns

1. Timestamp.
2. Direction.
3. Agent.
4. Party Type.
5. Customer or Plumber.
6. Phone.
7. Duration.
8. Disposition.
9. Priority.
10. QA Grade.
11. Linked Record.
12. Business Location.

Party Type is Customer or Plumber. Linked Record displays Job, Dispatch, Escalation, Review, Campaign, or a dash.

##### Call drawer

Sections:

1. **Call Record**
   - Direction.
   - Agent.
   - Party Type.
   - Masked phone.
   - Start time.
   - Duration.
   - Disposition.
   - Business Location.

2. **Recording**
   - Audio player.
   - Playback speed.
   - Consent disclosure marker.
   - Recording unavailable state.

3. **Transcript**
   - Agent and caller speaker labels.
   - Timestamps.
   - Redaction markers.
   - Transfer and tool-action markers.

4. **Extracted Intake or Dispatch Data**
   - Customer name.
   - Service address.
   - Issue Type.
   - Job Type.
   - Priority.
   - Preferred service window.
   - Required Specialty.
   - Plumber response for outbound dispatch calls.

5. **Quality Grade**
   - Overall grade.
   - Operational Accuracy.
   - Policy and Safety Compliance.
   - Conversation Quality.
   - Task Completion.
   - Efficiency.

6. **Linked Records**
   - Job.
   - Dispatch record.
   - Escalation.
   - Review request.
   - Campaign.

7. **Flag for Review**
   - Flag Interaction.
   - Reason.
   - Additional context.

##### Calls empty states

- **No calls yet. Calls handled by the automation agents will appear here with recording, transcript, outcome, and QA grade.**
- **No calls match these filters.**
- **Recording unavailable. The call record and transcript remain available.**
- **Transcript unavailable. The call record and recording remain available.**

#### Chats tab

Chats includes Web Chat, SMS, and WhatsApp.

##### Chats list columns

1. Customer.
2. Channel.
3. Last Message.
4. Outcome.
5. Messages.
6. Linked Job.
7. Human Handoff.
8. Business Location.

##### Chat drawer

Sections:

- Customer and channel summary.
- Full timestamped message thread.
- Agent and customer speaker treatment.
- Human-handoff marker.
- Extracted intake summary.
- Linked job and escalation.
- QA grade.
- Flag Interaction action.

##### Chats empty states

- **No chats yet. Customer conversations from Web Chat, SMS, and WhatsApp will appear here.**
- **No chats match these filters.**

---

### 5.4 Escalations

#### Page identity

> **Sidebar label:** Escalations  
> **Page title:** Escalations  
> **Page description:** Human-action worklist for urgent customer needs, safety events, and dispatch failures that require ownership.

#### Purpose

Escalations contains accountable human work. It does not contain routine dispatch activity. An item enters this page only when a team member must acknowledge, own, and resolve it.

#### AwaazLabs layout reused

Reuse the current Escalations page:

- PageHeader.
- KPI strip.
- Trigger distribution.
- Filter card.
- Dense worklist table.
- Aging badges.
- One-tap acknowledgement.
- Resolution-note drawer.
- Export control.

#### KPI cards

- **Open Escalations.**
- **Overdue Escalations.**
- **Acknowledgement Rate.**
- **Median Time to Acknowledge.**

#### Trigger distribution

Show count and share for:

- Customer Requested Human.
- Emergency Condition.
- Safety Risk.
- Out of Service Area.
- No Suitable Plumber.
- Dispatch Exhausted.
- Agent Failure.

#### Filters

- Date range.
- Status.
- Severity.
- Trigger.
- Escalation Owner.
- Priority.
- Business Location.
- Service Area.
- Search by customer, phone, job reference, or escalation reference.

#### Table columns

1. Created.
2. Customer.
3. Source.
4. Severity.
5. Trigger.
6. Reason.
7. Escalation Owner.
8. Acknowledged.
9. Aging.
10. Resolution Note.
11. Business Location.

Source links to Call, Chat, Job, or Dispatch.

#### Escalation drawer

Sections:

1. **Escalation Summary**
   - Escalation reference.
   - Status.
   - Severity.
   - Trigger.
   - Created time.
   - Threshold.
   - Current age.

2. **Customer and Job**
   - Customer.
   - Masked phone.
   - Job reference.
   - Issue Type.
   - Priority.
   - Service address.

3. **Source Interaction**
   - Call or chat link.
   - Agent.
   - Relevant transcript excerpt.
   - Transfer status.

4. **Dispatch Context**
   - Assignment Status.
   - Required Specialty.
   - Service Area.
   - Attempts.
   - Last outcome.
   - Open Dispatch Record.

5. **Ownership**
   - Escalation Owner.
   - Acknowledgement timestamp.
   - Acknowledged By.

6. **Resolution**
   - Resolution Note.
   - Resolve Escalation.
   - Resolution timestamp and actor.

#### Actions

- Acknowledge.
- Assign Owner.
- Open Source.
- Open Job.
- Open Dispatch Record.
- Add Resolution Note.
- Resolve Escalation.
- Export CSV.

#### Empty states

- **No escalations. Urgent handoffs, safety events, and dispatch failures requiring human ownership will appear here.**
- **No escalations match these filters. Adjust status, severity, trigger, owner, or date filters.**

---

### 5.5 Dispatch Queue

#### Page identity

> **Sidebar label:** Dispatch Queue  
> **Page title:** Dispatch Queue  
> **Page description:** Match ready jobs with qualified plumbers, monitor outreach, and resolve assignment exceptions.

#### Purpose

Dispatch Queue is the action-oriented plumber-assignment worklist. It includes assignment activity, not the complete service lifecycle. Assigned records remain available for recent-history filtering but no longer count as active queue work.

#### AwaazLabs layout reused

Reuse the current VOB Queue composition:

- Exception-driven queue.
- Summary statistics.
- Search and filter card.
- Selectable paginated table.
- Aging indicators.
- Bulk action row.
- Export.
- Detail drawer with attempt history, recording and transcript links, notes, status timeline, and row actions.

#### KPI cards

- **Unassigned.**
- **Dispatch in Progress.**
- **Awaiting Response.**
- **Assigned Today.**
- **Needs Attention.**

Needs Attention includes Exhausted records and Urgent or Emergency jobs beyond their assignment threshold.

#### Filters

- Assignment Status.
- Job Priority.
- Required Specialty.
- Service Area.
- Queue Age.
- Current Candidate.
- Assigned Plumber.
- Escalation State.
- Business Location.
- Search by customer, job reference, ZIP code, phone, or plumber.

#### Table columns

1. Selection.
2. Job and Customer.
3. Issue or Job Type.
4. Required Specialty.
5. Service Area.
6. Priority.
7. Requested Service Window.
8. Assignment Status.
9. Current Candidate.
10. Queue Age.
11. Last Attempt.
12. Attempts.
13. Business Location.

#### Aging presentation

- Neutral before threshold.
- Amber when a Routine or Urgent dispatch is approaching its threshold.
- Red when the assignment threshold is exceeded or Assignment Status is Exhausted.
- Aging always includes text, duration, and icon.

#### Dispatch drawer

Sections:

1. **Job Summary**
   - Job reference.
   - Customer.
   - Issue Type.
   - Job Type.
   - Priority.
   - Service address.
   - Requested Service Window.
   - Open Job.

2. **Match Criteria**
   - Required Specialty.
   - Service Area.
   - ZIP code.
   - Availability requirement.
   - Business Location.

3. **Current Assignment**
   - Assignment Status.
   - Current Candidate.
   - Assigned Plumber.
   - Started time.
   - Queue age.

4. **Eligible Plumbers**
   - Plumber.
   - Specialty match.
   - Service-area match.
   - Availability.
   - Current active jobs.
   - Acceptance rate.
   - Last contacted.

5. **Outreach Attempts**
   - Attempt number.
   - Plumber.
   - Timestamp.
   - Outcome.
   - Call duration.
   - Recording.
   - Transcript.

6. **Assignment Summary**
   - Accepted by.
   - Acceptance time.
   - Scheduled Arrival Window.
   - Dispatch resolution summary.

7. **Status Timeline**
   - Ready for Dispatch.
   - Matching.
   - Contacting.
   - Awaiting Response.
   - Accepted, Manually Assigned, or Exhausted.

8. **Notes**
   - Append note.
   - Note history.

#### Row actions

- Start Outreach.
- Retry Outreach.
- Assign Manually.
- Change Candidate.
- Escalate.
- Add Note.
- Mark Exhausted.
- Open Job.

#### Queue-level actions

- Bulk Retry Outreach.
- Export CSV.
- Clear Filters.

Bulk actions appear only after one or more rows are selected.

#### Empty states

- **Dispatch Queue is clear. Jobs ready for plumber assignment will appear here.**
- **No dispatch records match these filters.**
- **No eligible plumbers found. Review the required specialty and service area, then escalate for manual handling.**

---

### 5.6 AI Receptionist

#### Page identity

> **Sidebar label:** AI Receptionist  
> **Page title:** AI Receptionist  
> **Page description:** Monitor, review, and optimize the inbound voice agent that captures new plumbing jobs.

#### Purpose

AI Receptionist is the dedicated profile page for the inbound plumbing intake agent. It explains the agent's role, performance, intake outcomes, and quality trends without duplicating the full Conversations or Jobs workspaces.

#### AwaazLabs layout reused

Reuse the current Receptionist agent page layout:

- Agent profile header.
- KPI cards.
- Performance trend cards and charts.
- Linked conversation and job entry points.
- Quality and optimization entry points.

#### Header KPI cards

- **Inbound Calls Handled.**
- **Jobs Created.**
- **Job Creation Rate.**
- **Average QA Grade.**

#### Main content

- Agent summary card with role, channel, operating hours, and supported languages.
- Intake performance chart showing handled calls and jobs created over time.
- Outcome distribution for Job Created, Information Provided, Human Transfer, Emergency Escalation, and Out of Service Area.
- Linked records section opening Conversations filtered to this agent.
- Linked records section opening Jobs created by this agent.
- Quality summary with open flags and recent optimization activity.

#### Primary actions

- Open Conversations.
- Open Jobs.
- Open Quality and Optimization.
- Open Agent Knowledge.

#### Empty and degraded states

- **No receptionist activity yet. Completed inbound calls handled by this agent will appear here.**
- **AI Receptionist metrics are temporarily unavailable.**

---

### 5.7 Plumber Dispatch Agent

#### Page identity

> **Sidebar label:** Plumber Dispatch Agent  
> **Page title:** Plumber Dispatch Agent  
> **Page description:** Monitor, review, and optimize the outbound voice agent that contacts plumbers and secures job acceptance.

#### Purpose

Plumber Dispatch Agent is the dedicated profile page for the outbound assignment agent. It explains assignment performance, plumber outreach outcomes, and dispatch quality without replacing the Dispatch Queue workspace.

#### AwaazLabs layout reused

Reuse the current VOB Agent page layout:

- Agent profile header.
- KPI cards.
- Performance trend cards and charts.
- Linked dispatch and conversation entry points.
- Quality and optimization entry points.

#### Header KPI cards

- **Outbound Calls Handled.**
- **Assignments Secured.**
- **Assignment Rate.**
- **Average QA Grade.**

#### Main content

- Agent summary card with role, channel, service areas covered, and supported languages.
- Dispatch performance chart showing outbound calls and accepted assignments over time.
- Outreach outcome distribution for Accepted, Declined, No Answer, Voicemail, Unavailable, Failed, and Canceled Before Contact.
- Linked records section opening Dispatch Queue filtered to this agent.
- Linked records section opening Conversations filtered to plumber outreach calls.
- Quality summary with open flags and recent optimization activity.

#### Primary actions

- Open Dispatch Queue.
- Open Conversations.
- Open Quality and Optimization.
- Open Agent Knowledge.

#### Empty and degraded states

- **No dispatch-agent activity yet. Completed outbound plumber calls handled by this agent will appear here.**
- **Plumber Dispatch Agent metrics are temporarily unavailable.**

---
