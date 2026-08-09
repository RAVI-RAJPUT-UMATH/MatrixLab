/**
 * MatrixLab — core error type.
 *
 * Every mathematical failure in MatrixLab is reported through MLError with a
 * message written for a student, not a stack trace. Algorithms never return a
 * silently-wrong answer: if a precondition fails, they throw.
 */
(function (ML) {
  'use strict';

  class MLError extends Error {
    /**
     * @param {string} message Friendly, complete sentence explaining the problem.
     * @param {object} [details] Optional structured context (e.g. {row, col, hint}).
     */
    constructor(message, details) {
      super(message);
      this.name = 'MLError';
      this.details = details || null;
    }
  }

  ML.MLError = MLError;

  /** Throw a friendly error. */
  ML.fail = function (message, details) {
    throw new MLError(message, details);
  };

  /** Throw a friendly error unless `condition` holds. */
  ML.assert = function (condition, message, details) {
    if (!condition) throw new MLError(message, details);
  };

  ML.version = '1.0.0';
})((globalThis.ML = globalThis.ML || {}));
