const { query } = require('../connection');

const UserPreference = {
  async findByUserId(userId) {
    const result = await query('SELECT * FROM user_preferences WHERE user_id = $1', [userId]);
    return result.rows[0] || null;
  },

  async createOrUpdate(userId, fields) {
    const result = await query(
      `INSERT INTO user_preferences (user_id, auto_apply_enabled, target_roles, target_locations, min_salary, max_salary, experience_level, excluded_companies, apply_interval_minutes, notification_enabled, email_notifications, push_notifications, daily_limit)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (user_id) DO UPDATE SET
         auto_apply_enabled = COALESCE($2, user_preferences.auto_apply_enabled),
         target_roles = COALESCE($3, user_preferences.target_roles),
         target_locations = COALESCE($4, user_preferences.target_locations),
         min_salary = COALESCE($5, user_preferences.min_salary),
         max_salary = COALESCE($6, user_preferences.max_salary),
         experience_level = COALESCE($7, user_preferences.experience_level),
         excluded_companies = COALESCE($8, user_preferences.excluded_companies),
         apply_interval_minutes = COALESCE($9, user_preferences.apply_interval_minutes),
         notification_enabled = COALESCE($10, user_preferences.notification_enabled),
         email_notifications = COALESCE($11, user_preferences.email_notifications),
         push_notifications = COALESCE($12, user_preferences.push_notifications),
         daily_limit = COALESCE($13, user_preferences.daily_limit),
         updated_at = NOW()
       RETURNING *`,
      [
        userId,
        fields.autoApplyEnabled,
        fields.targetRoles,
        fields.targetLocations,
        fields.minSalary,
        fields.maxSalary,
        fields.experienceLevel,
        fields.excludedCompanies,
        fields.applyIntervalMinutes,
        fields.notificationEnabled,
        fields.emailNotifications,
        fields.pushNotifications,
        fields.dailyLimit,
      ],
    );
    return result.rows[0];
  },
};

module.exports = UserPreference;
