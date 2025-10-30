// prompt for a password
const { read } = require('read')
const { logger } = require('../../shared/logger')
const Errors = require('./errors')

function _sanitizePassword (password) {
  // normalizes the string, and strips leading and trailing quotes and whitespace
  if (password) {
    const quotesRegex = /^['"]+|['"]+$/g
    return password.normalize().trim().replace(quotesRegex, '')
  } else {
    return null
  }
}

/**
 * Ensures a password is provided; if not, and a prompt is requested,
 *   it will either prompt for a new password (if shouldConfirm is true) or
 *   for a password (if shouldConfirm is false).
 * If no password is provided and no prompt is requested, it will throw an error.
 * If no password is provided and it is not a TTY (i.e. not an interactive shell),
 *   it will throw an error.
 * @param {string} password - password to use if provided
 * @param {boolean} isPromptRequested - whether to prompt for a password if none is provided
 * @param {boolean} shouldConfirm - whether to prompt for a new password and confirm it
 * @returns {Promise<string>} - the password to use
 * @throws {Errors.invalidPassPhraseOptions} - if no password is provided and no prompt is requested
 * @throws {Errors.invalidPassPhraseOptionsNonTTY} - if no password is provided and it is not a TTY
 */
async function ensurePassword (password, isPromptRequested, shouldConfirm) {
  if (password) {
    return password
  }

  if (!isPromptRequested) {
    logger.debug('no password provided and no prompt requested; will throw an error')
    throw new Errors().invalidPassPhraseOptions()
  } else if (!process.stdout.isTTY) {
    logger.debug('no password provided and not a TTY so will not prompt for password; will throw an error')
    throw new Errors().invalidPassPhraseOptionsNonTTY()
  } else {
    if (shouldConfirm) {
      return _sanitizePassword(await promptForNewPassword())
    } else {
      return _sanitizePassword(await promptForPassword())
    }
  }
}

/**
 * Prompts the user to enter a password.
 * The entered password is not echoed to the console.
 * @returns {Promise<string>} - the entered password
 */
async function promptForPassword () {
  const password = await read({
    prompt: 'enter password> ', silent: true, replace: '*'
  })
  return password
}

/**
 * Prompts the user to enter a new password, and to confirm it.
 * The entered password is not echoed to the console.
 * If the entered password and its confirmation do not match, an error is thrown.
 * @returns {Promise<string>} - the newly entered password, if it matches its confirmation
 * @throws {Error} - if the password and its confirmation do not match
 */
async function promptForNewPassword () {
  const password = await read({
    prompt: 'enter password> ', silent: true, replace: '*'
  })
  const confirm = await read({
    prompt: 'confirm password> ', silent: true, replace: '*'
  })
  if (password !== confirm) {
    throw new Error('passwords do not match')
  } else {
    return password
  }
}

module.exports = { ensurePassword, promptForPassword, promptForNewPassword }
