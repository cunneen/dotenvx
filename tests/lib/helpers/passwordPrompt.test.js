const t = require('tap')
const proxyquire = require('proxyquire').noCallThru().noPreserveCache()
const { startIntercept, stopIntercept } = require('capture-console')
const Sinon = require('sinon')
const { logger } = require('../../../src/shared/logger')
const { showLoggerCalls, stubLoggers, allLoggerNames } = require('../../utils/showLoggerCalls')
const { ensurePassword } = require('../../../src/lib/helpers/passwordPrompt')

let loggerStubs

t.beforeEach((ct) => {
  Sinon.restore()
  // logger.setLevel('debug')
  logger.debug(`| ====== start of test: ${ct.name} ======`)
  logger.debug('| Logger level set to debug for test:', ct.name)
  loggerStubs = stubLoggers(allLoggerNames)
})

t.afterEach((ct) => {
  Sinon.restore()
  logger.debug(`| === ${ct.name} logger stub calls:`)
  showLoggerCalls(loggerStubs, ct.name)
  logger.debug(`| ====== end of test: ${ct.name} ======`)
  loggerStubs = {}
})

// ======================================
t.test('#passwordPrompt newPassword: throws error when password confirmation doesnt match', async (ct) => {
  // use proxyquire for the 'read' module, called by the passwordPrompt function. 'read' uses (interactive) readline ;
  //   we'll use proxyquire to replace it with a sinon stub that simulates 'read'
  const sinonReadStubPasswordMismatch = Sinon
    .stub()
    .onFirstCall()
    .resolves('myPassword')
    .onSecondCall()
    .resolves('aDifferentPassword')
  // our 'promptForNewPassword' function with the 'read' module stubbed to return two different passwords on successive calls
  const { promptForNewPassword } = proxyquire('../../../src/lib/helpers/passwordPrompt.js', { read: { read: sinonReadStubPasswordMismatch } })
  let newPassword = null
  try {
    newPassword = await promptForNewPassword()
  } catch (err) {
    t.equal(err.message, 'passwords do not match')
  }

  t.equal(newPassword, null)
  ct.end()
})

// ======================================
t.test('#passwordPrompt newPassword: returns password when passwords match', async (ct) => {
  let newPassword = null
  // use proxyquire for the 'read' module, called by the passwordPrompt function. 'read' uses (interactive) readline ;
  //   we'll use proxyquire to replace it with a sinon stub that simulates 'read'
  const sinonReadStubPasswordsMatch = Sinon
    .stub()
    .onFirstCall()
    .resolves('newPassword')
    .onSecondCall()
    .resolves('newPassword')
  // our 'promptForNewPassword' function with the 'read' module stubbed to return two IDENTICAL passwords on successive calls
  const { promptForNewPassword } = proxyquire('../../../src/lib/helpers/passwordPrompt.js', { read: { read: sinonReadStubPasswordsMatch } })
  // our buffer
  let stdOutput = ''
  let stdError = ''

  // the first parameter here is the stream to capture, and the
  // second argument is the function receiving the output
  startIntercept(process.stdout, stdout => {
    stdOutput += stdout
  })
  startIntercept(process.stderr, stderr => {
    stdError += stderr
  })
  try {
    newPassword = await promptForNewPassword()
    logger.debug('newPassword:', { newPassword })
  } catch (err) {
    // this is unexpected
    t.fail(err.message)
  }

  stopIntercept(process.stdout)
  stopIntercept(process.stderr)

  // anything logged here is no longer captured
  logger.debug({ stdOutput, stdError, newPassword })
  t.equal(newPassword, 'newPassword')
  ct.end()
})

// ======================================
t.test('#passwordPrompt password: returns password', async (ct) => {
  let enteredPassword = null
  // use proxyquire for the 'read' module, called by the passwordPrompt function. 'read' uses (interactive) readline ;
  //   we'll use proxyquire to replace it with a sinon stub that simulates 'read'
  const sinonReadStubPassword = Sinon
    .stub()
    .onFirstCall()
    .resolves('existingPassword')
  // our 'promptForNewPassword' function with the 'read' module stubbed to return two IDENTICAL passwords on successive calls
  const { promptForPassword } = proxyquire('../../../src/lib/helpers/passwordPrompt.js', { read: { read: sinonReadStubPassword } })

  // our buffer
  let stdOutput = ''
  let stdError = ''

  // the first parameter here is the stream to capture, and the
  // second argument is the function receiving the output
  startIntercept(process.stdout, stdout => {
    stdOutput += stdout
  })
  startIntercept(process.stderr, stderr => {
    stdError += stderr
  })
  try {
    enteredPassword = await promptForPassword()
    logger.debug('newPassword:', { enteredPassword })
  } catch (err) {
    // this is unexpected
    t.fail(err.message)
  }

  stopIntercept(process.stdout)
  stopIntercept(process.stderr)

  // anything logged here is no longer captured
  logger.debug({ stdOutput, stdError, enteredPassword })
  t.equal(enteredPassword, 'existingPassword')
  ct.end()
})
// ======================================
t.test('#passwordPrompt ensurePassword: returns sanitized and normalized password', async (ct) => {
  // these will all be the same when trimmed, dequoted and normalized
  const pass1 = '\u0041\u006d\u00e9\u006c\u0069\u0065' // same as pass3, ignoring quotes and spaces
  const pass2 = '\u0041\u006d\u0065\u0301\u006c\u0069\u0065' // same as pass4, ignoring quotes and spaces
  const pass3 = '"Amélie" ' // same as pass1, ignoring quotes and spaces
  const pass4 = ' "Amélie"' // same as pass2, ignoring quotes and spaces

  // an input of an empty string will be returned as null
  const emptyPassphrase = ''

  // assert that the inputs are different
  t.not(pass1, pass2)
  t.not(pass1, pass4)
  t.not(pass3, pass4)
  t.not(pass2, pass3)

  let enteredPassword1 = null
  let enteredPassword2 = null
  let enteredPassword3 = null
  let enteredPassword4 = null

  let enteredEmptyPassphrase = null

  const expected1 = pass1.normalize().trim().replace(/^['"]+|['"]+$/g, '')
  // use proxyquire for the 'read' module, called by the passwordPrompt function. 'read' uses (interactive) readline ;
  //   we'll use proxyquire to replace it with a sinon stub that simulates 'read'
  const sinonReadStubPassword = Sinon
    .stub()
    .onFirstCall().resolves(pass1)
    .onSecondCall().resolves(pass1)
    .onThirdCall().resolves(pass2)
    .onCall(3).resolves(pass3)
    .onCall(4).resolves(pass4)
    .onCall(5).resolves(emptyPassphrase)

  // our 'ensurePassword' function with the 'read' module stubbed to return the above passwords on successive calls
  const { ensurePassword } = proxyquire('../../../src/lib/helpers/passwordPrompt.js', { read: { read: sinonReadStubPassword } })

  // we need to override the value of process.stdout.isTTY
  // for the ensurePassword function
  const proto = Object.getPrototypeOf(process.stdout)
  const oldTTYVal = proto.isTTY
  proto.isTTY = true

  try {
    enteredPassword1 = await ensurePassword(null, true, true) // prompt requested, confirm requested
    enteredPassword2 = await ensurePassword(null, true, false) // prompt requested, confirm NOT requested
    enteredPassword3 = await ensurePassword(null, true, false) // prompt requested, confirm NOT requested
    enteredPassword4 = await ensurePassword(null, true, false) // prompt requested, confirm NOT requested
    enteredEmptyPassphrase = await ensurePassword(null, true, false) // prompt requested, confirm NOT requested
  } catch (err) {
    // this is unexpected
    t.fail(err.message)
  } finally {
    proto.isTTY = oldTTYVal
  }

  // all our inputs should be the same
  t.equal(enteredPassword1, expected1)
  t.equal(enteredPassword2, expected1)
  t.equal(enteredPassword3, expected1)
  t.equal(enteredPassword4, expected1)
  t.same(enteredEmptyPassphrase, null)
  ct.end()
})
// ======================================

t.test('#passwordPrompt ensurePassword: should error when requesting prompt and not a TTY', async (ct) => {
  // we need to override the value of process.stdout.isTTY
  // for the ensurePassword function
  const proto = Object.getPrototypeOf(process.stdout)
  const oldTTYVal = proto.isTTY
  proto.isTTY = false
  let errThrown
  try {
    await ensurePassword(null, true, true) // prompt requested, confirm NOT requested
  } catch (err) {
    // this is unexpected
    errThrown = err
  } finally {
    proto.isTTY = oldTTYVal
  }

  t.ok(errThrown)
  t.same(errThrown?.message, '[INVALID_PASS_PHRASE_OPTIONS_NONTTY] no passphrase provided and cannot prompt (not a TTY)')
  ct.end()
})
