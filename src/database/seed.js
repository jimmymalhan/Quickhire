const { pool } = require('./connection');
const logger = require('../utils/logger');

const seedData = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Seed test user
    const userResult = await client.query(`
      INSERT INTO users (email, linkedin_id, first_name, last_name, profile_pic_url)
      VALUES ('testuser@example.com', 'linkedin_test_001', 'Test', 'User', 'https://example.com/pic.jpg')
      ON CONFLICT (email) DO NOTHING
      RETURNING id
    `);

    const userId = userResult.rows[0]?.id;

    if (userId) {
      // Seed user preferences
      await client.query(`
        INSERT INTO user_preferences (user_id, auto_apply_enabled, target_roles, target_locations, min_salary, max_salary, daily_limit)
        VALUES ($1, true, '{"Software Engineer","Backend Developer","Full Stack Developer"}', '{"San Francisco, CA","New York, NY","Remote"}', 100000, 200000, 25)
        ON CONFLICT (user_id) DO NOTHING
      `, [userId]);

      // Seed sample jobs
      const jobs = [
        ['Senior Software Engineer', 'TechCorp', 'San Francisco, CA', 150000, 200000, 'senior', 5],
        ['Backend Developer', 'StartupXYZ', 'New York, NY', 120000, 160000, 'mid', 3],
        ['Full Stack Engineer', 'BigCo', 'Remote', 130000, 180000, 'mid', 3],
        ['Junior Developer', 'LearnInc', 'Austin, TX', 70000, 90000, 'entry', 0],
        ['Staff Engineer', 'MegaTech', 'Seattle, WA', 200000, 280000, 'senior', 8],
      ];

      for (const [title, company, location, salaryMin, salaryMax, level, exp] of jobs) {
        const hash = Buffer.from(`${title}-${company}-${location}`).toString('base64').substring(0, 64);
        await client.query(`
          INSERT INTO jobs (title, company, location, salary_min, salary_max, job_level, experience_years, description, hash, posted_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW() - interval '1 day' * (random() * 14))
          ON CONFLICT (hash) DO NOTHING
        `, [title, company, location, salaryMin, salaryMax, level, exp, `Exciting ${title} role at ${company}.`, hash]);
      }

      logger.info('Seed data inserted successfully');
    } else {
      logger.info('Seed data already exists, skipping');
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Seed failed', { error: err.message });
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
};

seedData().catch((err) => {
  logger.error('Seed error', { error: err.message });
  process.exit(1);
});
