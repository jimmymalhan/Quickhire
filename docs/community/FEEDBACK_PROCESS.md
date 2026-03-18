# Quickhire - User Feedback Process

## Overview

User feedback drives our product decisions. This document describes how we collect, analyze, and act on feedback.

---

## Feedback Collection Channels

### 1. In-App Feedback Widget

A persistent feedback button in the application sidebar that opens a feedback form.

**Fields:**
- Category: Bug / Feature Request / Improvement / Other
- Description (required, 10-2000 characters)
- Priority: Low / Medium / High
- Screenshot attachment (optional)
- Contact permission checkbox

**API Endpoint:** `POST /feedback`

```json
{
  "category": "feature_request",
  "description": "I'd like to filter jobs by company size",
  "priority": "medium",
  "screenshot_url": null,
  "allow_contact": true
}
```

### 2. NPS Survey

Net Promoter Score survey displayed:
- After 7 days of first use
- Every 90 days thereafter
- After significant feature releases

**Question:** "On a scale of 0-10, how likely are you to recommend Quickhire to a friend or colleague?"

**Follow-up:** "What is the primary reason for your score?"

**API Endpoint:** `POST /feedback/nps`

```json
{
  "score": 9,
  "reason": "Auto-apply saves me hours every week"
}
```

### 3. Feature Request Voting

Users can vote on proposed features in the app:

**API Endpoint:** `POST /feedback/features/:id/vote`

Features are ranked by vote count and displayed on a public roadmap.

### 4. GitHub Discussions

Open discussions for longer-form feedback. Monitored by the team and tagged for tracking.

### 5. Discord Community

Real-time feedback in #feature-requests and #help channels. Key themes are captured weekly.

### 6. User Surveys

Targeted surveys for specific features or user segments, sent via email with a link to the survey form.

---

## Feedback Processing Workflow

```
Feedback Received
       |
       v
Auto-categorize (Bug / Feature / Improvement)
       |
       v
Deduplicate (match against existing feedback)
       |
       v
Prioritize (based on frequency, impact, effort)
       |
       v
Review in weekly product meeting
       |
       v
Decision: Accept / Defer / Decline
       |
       v
If accepted: Add to roadmap, create task
       |
       v
Notify user when shipped
```

---

## Feedback Metrics Dashboard

Track the following metrics:

| Metric | Target | Frequency |
|--------|--------|-----------|
| NPS score | > 50 | Monthly |
| Feedback volume | Trending up | Weekly |
| Response time to feedback | < 48 hours | Per feedback |
| Feature request completion rate | > 30% per quarter | Quarterly |
| Bug fix time (from report) | < 7 days (P1), < 30 days (P2) | Per bug |

### Dashboard Views

1. **Overview**: NPS trend, feedback volume, top categories
2. **Feature Requests**: Ranked by votes, status (proposed/planned/building/shipped)
3. **Bug Reports**: Open count, resolution time, trend
4. **User Satisfaction**: NPS distribution, sentiment analysis

---

## Feedback Response Guidelines

### Acknowledgment
- All feedback acknowledged within 24 hours
- Automated acknowledgment email for in-app submissions
- Personal follow-up for high-impact feedback

### Templates

**Bug Report Acknowledgment:**
> Thank you for reporting this issue. We've logged it as [ID] and our team is investigating. We'll update you when we have a fix.

**Feature Request Acknowledgment:**
> Thanks for the suggestion! We've added it to our feature request tracker. You can track its status and vote on it at [link].

**Feature Shipped Notification:**
> Great news! The feature you requested -- [feature name] -- is now live. Check it out and let us know what you think.

---

## User Testing Sessions

### Schedule
- Bi-weekly, 30-minute sessions
- 3-5 participants per session
- Mix of new and experienced users

### Process
1. Recruit participants (in-app prompt or email)
2. Schedule via Calendly
3. Conduct session (screen share, think-aloud protocol)
4. Record findings in structured template
5. Share insights with team in weekly review
6. Track action items to completion

### Session Template
- **Objective**: What are we testing?
- **Tasks**: What do we ask users to do?
- **Observations**: What did we see?
- **Pain points**: Where did users struggle?
- **Suggestions**: What did users recommend?
- **Action items**: What will we change?

---

## Roadmap Communication

The public roadmap is organized in three columns:

| Column | Description |
|--------|-------------|
| **Planned** | Accepted features, not yet started |
| **In Progress** | Currently being built |
| **Shipped** | Released and available |

Roadmap is updated weekly and shared via:
- In-app roadmap page
- Monthly community newsletter
- Discord #announcements

---

**Last Updated**: 2026-03-09
