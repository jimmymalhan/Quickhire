// routes.jsx — All Quickhire pages registered. Auto-apply enabled.
import JobFeedPage from './pages/JobFeedPage';
import ApplicationTrackerPage from './pages/ApplicationTrackerPage';
import SalaryInsightsPage from './pages/SalaryInsightsPage';
import MLDashboardPage from './pages/MLDashboardPage';

export const ROUTES = [
  { path: '/',              component: JobFeedPage,           label: 'Job Feed',         icon: '🔍' },
  { path: '/tracker',       component: ApplicationTrackerPage, label: 'Applications',     icon: '📋' },
  { path: '/salary',        component: SalaryInsightsPage,    label: 'Salary Insights',  icon: '💰' },
  { path: '/ml',            component: MLDashboardPage,       label: 'ML Intelligence',  icon: '🤖' },
];

export default ROUTES;
