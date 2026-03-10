/**
 * Feedback Controller
 * Handles user feedback submission, NPS surveys, and feature request voting.
 */

/**
 * Submit general feedback
 * POST /feedback
 *
 * @param {Object} req - Express request
 * @param {Object} req.body - Feedback payload
 * @param {string} req.body.category - bug | feature_request | improvement | other
 * @param {string} req.body.description - Feedback text (10-2000 chars)
 * @param {string} req.body.priority - low | medium | high
 * @param {string} [req.body.screenshot_url] - Optional screenshot URL
 * @param {boolean} req.body.allow_contact - Whether user allows follow-up contact
 * @param {Object} res - Express response
 */
const submitFeedback = async (req, res) => {
  try {
    const { category, description } = req.body;

    // Validate required fields
    if (!category || !description) {
      return res.status(400).json({
        status: 'error',
        code: 400,
        error: {
          code: 'INVALID_INPUT',
          message: 'Category and description are required',
        },
      });
    }

    const validCategories = ['bug', 'feature_request', 'improvement', 'other'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        status: 'error',
        code: 400,
        error: {
          code: 'INVALID_INPUT',
          message: `Category must be one of: ${validCategories.join(', ')}`,
        },
      });
    }

    if (description.length < 10 || description.length > 2000) {
      return res.status(400).json({
        status: 'error',
        code: 400,
        error: {
          code: 'INVALID_INPUT',
          message: 'Description must be between 10 and 2000 characters',
        },
      });
    }

    // TODO: Store feedback in database when models are available
    // const feedback = await Feedback.create({ userId, category, description, priority, screenshot_url, allow_contact });

    return res.status(201).json({
      status: 'success',
      code: 201,
      data: {
        message: 'Feedback submitted successfully',
        // id: feedback.id,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      code: 500,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to submit feedback',
      },
    });
  }
};

/**
 * Submit NPS survey response
 * POST /feedback/nps
 *
 * @param {Object} req - Express request
 * @param {Object} req.body - NPS payload
 * @param {number} req.body.score - NPS score (0-10)
 * @param {string} [req.body.reason] - Optional reason for the score
 * @param {Object} res - Express response
 */
const submitNPS = async (req, res) => {
  try {
    const { score } = req.body;

    if (score === undefined || score < 0 || score > 10 || !Number.isInteger(score)) {
      return res.status(400).json({
        status: 'error',
        code: 400,
        error: {
          code: 'INVALID_INPUT',
          message: 'Score must be an integer between 0 and 10',
        },
      });
    }

    // TODO: Store NPS response in database when models are available
    // const nps = await NPSResponse.create({ userId, score, reason });

    return res.status(201).json({
      status: 'success',
      code: 201,
      data: {
        message: 'NPS response recorded',
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      code: 500,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to submit NPS response',
      },
    });
  }
};

/**
 * Vote on a feature request
 * POST /feedback/features/:id/vote
 *
 * @param {Object} req - Express request
 * @param {string} req.params.id - Feature request ID
 * @param {Object} res - Express response
 */
const voteFeature = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        status: 'error',
        code: 400,
        error: {
          code: 'INVALID_INPUT',
          message: 'Feature request ID is required',
        },
      });
    }

    // TODO: Record vote in database when models are available
    // const vote = await FeatureVote.create({ userId, featureId: id });

    return res.status(200).json({
      status: 'success',
      code: 200,
      data: {
        message: 'Vote recorded',
        feature_id: id,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      code: 500,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to record vote',
      },
    });
  }
};

/**
 * List feature requests with vote counts
 * GET /feedback/features
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const listFeatureRequests = async (req, res) => {
  try {
    const { page = 1, per_page = 20 } = req.query;

    // TODO: Query database when models are available
    // const features = await FeatureRequest.findAll({ page, per_page, sort, order });

    return res.status(200).json({
      status: 'success',
      code: 200,
      data: [],
      meta: {
        page: parseInt(page, 10),
        per_page: parseInt(per_page, 10),
        total: 0,
        total_pages: 0,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      code: 500,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to list feature requests',
      },
    });
  }
};

module.exports = {
  submitFeedback,
  submitNPS,
  voteFeature,
  listFeatureRequests,
};
