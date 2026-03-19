#!/usr/bin/env bash
# researcher-agent.sh — Researches features, gets voted by investors + 50 orgs + 10 companies.
# Adds top-voted features to backlog. Runs every 3min. No Claude tokens.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
S="$ROOT/state/local-agent-runtime"
LOG="$S/researcher-agent.log"
mkdir -p "$S"; echo $$ > "$S/researcher-agent.pid"
log(){ printf '[%s] [RESEARCHER] %s\n' "$(date +%H:%M:%S)" "$1" | tee -a "$LOG"; }
log "=== RESEARCHER-AGENT pid=$$ ==="

while true; do
python3 << 'PYEOF'
import json, os, datetime, random, hashlib

S = "/Users/jimmymalhan/Documents/Quickhire/state/local-agent-runtime"
BACKLOG = f"{S}/backlog.json"
RESEARCH = f"{S}/research.json"
now = datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

# ── VOTER PERSONAS ────────────────────────────────────────────────────────────
INVESTORS = [
    {"name": "Sequoia Partner",    "cares": ["revenue", "retention", "viral", "moat", "LTV"],       "weight": 5},
    {"name": "a16z Partner",       "cares": ["AI", "automation", "scale", "network-effects"],        "weight": 5},
    {"name": "YC Partner",         "cares": ["PMF", "growth", "simplicity", "speed"],               "weight": 4},
    {"name": "Angel Investor",     "cares": ["job-seekers", "UX", "viral", "referral"],             "weight": 3},
    {"name": "Strategic VC",       "cares": ["enterprise", "API", "integrations", "B2B"],           "weight": 4},
]

ORG_AGENTS = [  # 50-person org internal stakeholders
    {"role": "CEO",             "cares": ["revenue", "growth", "retention", "viral"],        "count": 1},
    {"role": "CTO",             "cares": ["scalability", "reliability", "API", "security"],  "count": 2},
    {"role": "VP Product",      "cares": ["UX", "PMF", "jobs-to-be-done", "retention"],     "count": 1},
    {"role": "VP Engineering",  "cares": ["CI/CD", "testing", "performance", "scale"],      "count": 3},
    {"role": "Senior Engineer", "cares": ["API", "testing", "performance", "automation"],   "count": 8},
    {"role": "PM",              "cares": ["features", "analytics", "A/B", "UX"],            "count": 5},
    {"role": "Data Scientist",  "cares": ["ML", "AI", "scoring", "analytics", "feedback"],  "count": 4},
    {"role": "Designer",        "cares": ["UX", "accessibility", "mobile", "UI"],           "count": 3},
    {"role": "Recruiter",       "cares": ["automation", "matching", "speed", "scale"],      "count": 5},
    {"role": "Sales",           "cares": ["revenue", "enterprise", "integrations", "CRM"],  "count": 5},
    {"role": "Marketing",       "cares": ["viral", "SEO", "referral", "growth"],            "count": 5},
    {"role": "Support",         "cares": ["reliability", "errors", "UX", "recovery"],       "count": 8},
]

USER_COMPANIES = [  # 10 user companies using Quickhire
    {"name": "TechCorp (500 eng)",    "needs": ["bulk-apply", "ATS-sync", "analytics", "SSO"],         "tier": "enterprise"},
    {"name": "StartupXYZ (20 eng)",   "needs": ["fast-apply", "salary-filter", "remote-only"],          "tier": "growth"},
    {"name": "Agency Inc (50 recs)",  "needs": ["bulk-scrape", "candidate-track", "reporting"],         "tier": "business"},
    {"name": "FreelanceHub",          "needs": ["contract-roles", "hourly-rate", "multi-resume"],       "tier": "smb"},
    {"name": "MidwestCo (200 emp)",   "needs": ["local-jobs", "commute-filter", "visa-filter"],         "tier": "business"},
    {"name": "FinTechBank",           "needs": ["compliance", "security", "audit-log", "SSO"],          "tier": "enterprise"},
    {"name": "GreenEnergy",           "needs": ["diversity-filter", "culture-fit", "ESG"],              "tier": "growth"},
    {"name": "HealthcareCo",          "needs": ["license-filter", "cert-match", "background-check"],    "tier": "enterprise"},
    {"name": "ConsultingFirm",        "needs": ["multi-client", "white-label", "API"],                  "tier": "business"},
    {"name": "RemoteFirst",           "needs": ["remote-only", "timezone-filter", "async-apply"],       "tier": "growth"},
]

# ── FEATURE CANDIDATES (researched) ─────────────────────────────────────────
FEATURE_CANDIDATES = [
    # Product / PMF
    ("Feat: viral referral program (apply → share → credits)",          6,  "feat/referral-program",      "product",  ["viral","growth","referral","revenue"]),
    ("Feat: ATS integration (Greenhouse, Lever, Workday)",              12, "feat/ats-integration",       "platform", ["ATS-sync","enterprise","integrations","API"]),
    ("Feat: bulk apply (100 jobs in 1 click)",                          8,  "feat/bulk-apply",            "product",  ["bulk-apply","automation","speed","scale"]),
    ("Feat: SSO / SAML enterprise login",                               6,  "feat/enterprise-sso",        "platform", ["SSO","enterprise","security","compliance"]),
    ("Feat: mobile app (React Native)",                                 20, "feat/mobile-app",            "product",  ["mobile","UX","viral","accessibility"]),
    ("Feat: browser extension (1-click apply anywhere)",                15, "feat/browser-extension",     "product",  ["automation","viral","scale","speed"]),
    ("Feat: white-label API for recruiting agencies",                   10, "feat/white-label-api",       "platform", ["API","B2B","revenue","enterprise"]),
    ("Feat: candidate tracking CRM for recruiters",                     8,  "feat/recruiter-crm",         "product",  ["CRM","automation","matching","reporting"]),
    # ML / AI
    ("Feat: semantic job matching v2 (sentence transformers)",          10, "feat/semantic-match-v2",     "product",  ["AI","ML","scoring","matching"]),
    ("Feat: GPT-based cover letter fine-tuned on successful apps",      8,  "feat/cover-letter-ft",       "product",  ["AI","automation","PMF","retention"]),
    ("Feat: resume parser (extract skills from PDF)",                   6,  "feat/resume-parser",         "product",  ["AI","ML","automation","UX"]),
    ("Feat: job description summarizer (TL;DR in 3 bullets)",           4,  "feat/jd-summarizer",         "product",  ["AI","UX","speed","simplicity"]),
    ("Feat: culture fit scorer (Glassdoor reviews NLP)",                8,  "feat/culture-nlp",           "product",  ["ML","AI","analytics","matching"]),
    ("Feat: A/B test framework for apply message variants",             4,  "feat/ab-framework",          "quality",  ["A/B","analytics","PMF","feedback"]),
    # Analytics / Retention
    ("Feat: job application funnel analytics (apply→screen→offer)",     5,  "feat/funnel-analytics",      "platform", ["analytics","retention","LTV","feedback"]),
    ("Feat: weekly digest email (new top-matched jobs)",                3,  "feat/weekly-digest",         "product",  ["retention","viral","growth","email"]),
    ("Feat: push notifications (job alert + application update)",       4,  "feat/push-notifications",    "product",  ["retention","mobile","UX","growth"]),
    ("Feat: user onboarding wizard (profile → first apply in 5min)",    5,  "feat/onboarding-wizard",     "product",  ["PMF","UX","retention","simplicity"]),
    # Scale / Enterprise
    ("Feat: multi-tenant architecture (orgs + users + roles)",          15, "feat/multi-tenant",          "platform", ["enterprise","B2B","scale","security"]),
    ("Feat: audit log for compliance (SOC2 readiness)",                 8,  "feat/audit-log",             "platform", ["compliance","security","enterprise","audit-log"]),
    ("Feat: rate limit dashboard (LinkedIn/Indeed quota monitor)",       3,  "feat/quota-dashboard",       "platform", ["reliability","scale","monitoring","API"]),
    ("Feat: job data warehouse (PostgreSQL → BigQuery export)",         8,  "feat/data-warehouse",        "platform", ["analytics","scale","data","AI"]),
    ("Feat: Zapier + Make.com integration",                             4,  "feat/zapier-integration",    "platform", ["integrations","API","B2B","automation"]),
    ("Feat: Slack bot (daily top 5 jobs + apply button)",               4,  "feat/slack-bot",             "product",  ["viral","retention","integrations","UX"]),
    # Testing / Quality
    ("Test: load test (1000 concurrent auto-applies)",                  4,  "test/load-test-1k",          "quality",  ["scale","reliability","performance","testing"]),
    ("Test: chaos engineering (kill scraper mid-apply, verify recovery)",3,  "test/chaos-apply",          "quality",  ["reliability","testing","resilience","scale"]),
    ("Test: security pen test (OWASP top 10 scan)",                     6,  "test/security-pentest",      "quality",  ["security","compliance","enterprise","audit-log"]),
]

# ── VOTING ENGINE ─────────────────────────────────────────────────────────────
def vote(feature_tags, voters_care, weight=1):
    return sum(weight for kw in voters_care if kw in feature_tags)

scores = {}
for title, eta, br, team, tags in FEATURE_CANDIDATES:
    score = 0
    voters = []

    # Investor votes (weighted 5x)
    for inv in INVESTORS:
        v = vote(tags, inv["cares"], inv["weight"])
        score += v * 3  # investors weighted 3x over org
        if v > 0: voters.append(f"{inv['name']}(+{v*3})")

    # Org agent votes
    for role in ORG_AGENTS:
        v = vote(tags, role["cares"]) * role["count"]
        score += v
        if v > 0: voters.append(f"{role['role']}(+{v})")

    # User company votes
    for co in USER_COMPANIES:
        v = vote(tags, co["needs"])
        multiplier = 4 if co["tier"] == "enterprise" else 2 if co["tier"] == "business" else 1
        score += v * multiplier
        if v > 0: voters.append(f"{co['name']}(+{v*multiplier})")

    scores[title] = {"score": score, "eta": eta, "br": br, "team": team,
                     "tags": tags, "voters": voters[:5]}

ranked = sorted(scores.items(), key=lambda x: -x[1]["score"])

# ── ADD TOP-VOTED TO BACKLOG ───────────────────────────────────────────────────
bl = []
try: bl = json.load(open(BACKLOG))
except: pass

existing = {t["title"] for t in bl}
max_id = max((t.get("id", 0) for t in bl), default=41)
added = 0

for title, meta in ranked:
    if title in existing: continue
    if meta["score"] < 10: continue  # minimum vote threshold
    max_id += 1
    bl.append({
        "id": max_id, "p": max_id, "title": title,
        "eta_hrs": meta["eta"], "br": meta["br"], "team": meta["team"],
        "status": "ready", "worker": "",
        "vote_score": meta["score"],
        "top_voters": meta["voters"],
    })
    added += 1

# Re-sort by vote score for priority (voted features jump the queue)
pending = [t for t in bl if t.get("status") != "done"]
done_tasks = [t for t in bl if t.get("status") == "done"]
pending.sort(key=lambda t: (-(t.get("vote_score", 0)), t.get("p", 999)))
for i, t in enumerate(pending): t["p"] = i + 1
bl = done_tasks + pending

json.dump(bl, open(BACKLOG, "w"), indent=2)

# Write research report
total_votes = sum(v["score"] for _, v in ranked)
research = {
    "at": now, "cycle": int(datetime.datetime.utcnow().timestamp()) % 10000,
    "candidates_researched": len(FEATURE_CANDIDATES),
    "new_added": added,
    "total_backlog": len(bl),
    "top_10_by_vote": [
        {"rank": i+1, "title": t[:60], "score": s["score"],
         "eta_hrs": s["eta"], "top_voter": s["voters"][0] if s["voters"] else ""}
        for i, (t, s) in enumerate(ranked[:10])
    ],
    "voter_breakdown": {
        "investors": len(INVESTORS),
        "org_roles": len(ORG_AGENTS),
        "total_org_headcount": sum(r["count"] for r in ORG_AGENTS),
        "user_companies": len(USER_COMPANIES),
        "enterprise_cos": sum(1 for c in USER_COMPANIES if c["tier"] == "enterprise"),
    }
}
json.dump(research, open(RESEARCH, "w"), indent=2)

print(f"Research complete: {len(FEATURE_CANDIDATES)} candidates evaluated")
print(f"Added {added} new features to backlog (vote threshold: 10+)")
print(f"Total backlog: {len(bl)} tasks")
print(f"Top 3 by vote:")
for i, (t, s) in enumerate(ranked[:3]):
    print(f"  #{i+1} score={s['score']} eta={s['eta']}h  {t[:65]}")
PYEOF

log "Research cycle done. Next in 180s."
sleep 180
done
