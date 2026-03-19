// api/mocks/index.js — Mock all backend features. Swap for real API in prod.
const delay = (ms = 400) => new Promise(r => setTimeout(r, ms));

const JOBS = [
  { id: 1, title: "Senior Software Engineer", company: "Google", location: "Remote", salary: "$180k-$220k", match: 94, source: "LinkedIn", posted: "2h ago", status: "new" },
  { id: 2, title: "Staff Engineer", company: "Meta", location: "Menlo Park, CA", salary: "$200k-$250k", match: 87, source: "Indeed", posted: "4h ago", status: "new" },
  { id: 3, title: "Principal Engineer", company: "Stripe", location: "Remote", salary: "$190k-$230k", match: 91, source: "LinkedIn", posted: "1h ago", status: "new" },
  { id: 4, title: "Engineering Manager", company: "Airbnb", location: "San Francisco, CA", salary: "$210k-$260k", match: 78, source: "Glassdoor", posted: "6h ago", status: "new" },
  { id: 5, title: "Tech Lead", company: "Shopify", location: "Remote", salary: "$170k-$200k", match: 85, source: "LinkedIn", posted: "3h ago", status: "new" },
];

const APPLICATIONS = [
  { id: 1, job: "Senior SWE @ Google", status: "interview", appliedAt: "2026-03-15", nextStep: "Technical round March 22" },
  { id: 2, job: "Staff Eng @ Meta", status: "applied", appliedAt: "2026-03-17", nextStep: "Waiting for response" },
  { id: 3, job: "Backend Eng @ Stripe", status: "rejected", appliedAt: "2026-03-10", nextStep: null },
  { id: 4, job: "SWE @ Netflix", status: "offer", appliedAt: "2026-03-05", nextStep: "Offer: $195k — negotiate by March 25" },
];

export const mockApi = {
  // Job scraping (LinkedIn + Indeed + Glassdoor)
  getJobs: async (filters = {}) => {
    await delay();
    let jobs = [...JOBS];
    if (filters.minSalary) jobs = jobs.filter(j => parseInt(j.salary) >= filters.minSalary);
    if (filters.minMatch) jobs = jobs.filter(j => j.match >= filters.minMatch);
    if (filters.remote) jobs = jobs.filter(j => j.location.includes("Remote"));
    if (filters.company && filters.blacklist?.includes(filters.company)) return [];
    return { jobs, total: jobs.length, sources: ["LinkedIn", "Indeed", "Glassdoor"] };
  },

  // Auto-apply engine
  autoApply: async (jobId) => {
    await delay(1200);
    const job = JOBS.find(j => j.id === jobId);
    if (!job) return { success: false, error: "Job not found" };
    return { success: true, jobId, message: `Auto-applied to ${job.title} @ ${job.company}`, coverLetter: true, resumeOptimized: true };
  },

  // ML job matching
  getMatchScore: async (jobId) => {
    await delay(600);
    const job = JOBS.find(j => j.id === jobId) || { match: 80 };
    return { score: job.match, breakdown: { skills: 92, experience: 88, culture: 85, salary: 90 }, recommendation: job.match > 80 ? "STRONG_APPLY" : "CONSIDER" };
  },

  // AI cover letter generator
  generateCoverLetter: async (jobId) => {
    await delay(800);
    const job = JOBS.find(j => j.id === jobId);
    return { coverLetter: `Dear Hiring Team,\n\nI am writing to express my strong interest in the ${job?.title || "position"} role at ${job?.company || "your company"}.\n\nMy experience in building scalable distributed systems directly aligns with your requirements...\n\nBest regards,\nJimmy Malhan`, wordCount: 320 };
  },

  // AI resume optimizer
  optimizeResume: async (jobId) => {
    await delay(700);
    return { score: 88, improvements: ["Add quantified metrics to bullets", "Include Kubernetes experience", "Highlight system design projects"], keywordsAdded: ["distributed systems", "microservices", "Kubernetes"] };
  },

  // Rejection predictor
  predictRejection: async (jobId) => {
    await delay(500);
    return { probability: 0.18, confidence: 0.85, riskFactors: ["Missing ML experience", "Overqualified for level"], recommendations: ["Highlight leadership", "Emphasize scale"] };
  },

  // Salary advisor
  getSalaryAdvice: async (jobId) => {
    await delay(400);
    return { marketRate: "$185k-$225k", negotiationFloor: "$195k", targetAsk: "$215k", script: "Based on my X years of experience building systems at Y scale, I am targeting $215k..." };
  },

  // Application tracker
  getApplications: async () => { await delay(); return { applications: APPLICATIONS, stats: { total: 24, interviews: 6, offers: 2, rejected: 8, pending: 8 } }; },
  updateApplicationStatus: async (id, status) => { await delay(300); return { id, status, updatedAt: new Date().toISOString() }; },

  // Email notifications
  scheduleFollowUp: async (appId, daysDelay = 7) => {
    await delay(200);
    const sendAt = new Date(Date.now() + daysDelay * 86400000).toISOString();
    return { scheduled: true, appId, sendAt, template: "follow_up_v1" };
  },

  // Rate limiting status
  getRateLimitStatus: async () => {
    await delay(100);
    return { linkedin: { remaining: 45, resetAt: "2026-03-19T18:00:00Z" }, indeed: { remaining: 98, resetAt: "2026-03-19T20:00:00Z" }, appliesPerHour: 12, appliesPerDay: 47 };
  },

  // Interview prep
  getInterviewPrep: async (jobId) => {
    await delay(600);
    return { questions: ["Tell me about a time you scaled a system to 1M+ users", "How do you handle technical disagreements?", "Design a rate limiter"], tips: ["Use STAR format", "Prepare 3 examples of impact", "Ask about eng culture"] };
  },

  // Profile scorer
  getProfileScore: async () => {
    await delay(400);
    return { score: 78, sections: { headline: 90, about: 70, experience: 85, skills: 65, recommendations: 60 }, topImprovements: ["Add 5 more skills", "Get 3 recommendations", "Improve about section"] };
  },

  // Skills gap
  getSkillsGap: async (jobId) => {
    await delay(500);
    return { missing: ["Go", "Rust", "ML/PyTorch"], partial: ["Kubernetes", "gRPC"], strong: ["Node.js", "PostgreSQL", "System Design"], learningPlan: [{ skill: "Go", eta: "3 weeks", resource: "Tour of Go" }] };
  },

  // Salary insights
  getSalaryInsights: async (title) => {
    await delay(400);
    return { title, p25: "$155k", p50: "$185k", p75: "$220k", p90: "$260k", byCity: { Remote: "$185k", "San Francisco": "$220k", "New York": "$210k" }, trend: "+8% YoY" };
  },
};

export default mockApi;
