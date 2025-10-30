const t = require('tap')
const fsx = require('../../../../src/lib/helpers/fsx')
const sinon = require('sinon')
const proxyquire = require('proxyquire')

const Lock = require('../../../../src/lib/services/lock')
const { logger } = require('../../../../src/shared/logger')
const { stubLoggers, allLoggerNames, showLoggerCalls } = require('../../../utils/showLoggerCalls')
const Errors = require('../../../../src/lib/helpers/errors')

const lock = proxyquire('../../../../src/cli/actions/ext/lock', {
  '../../../../src/lib/helpers/isIgnoringDotenvKeys': () => true
})

/** @typedef {import('../../../utils/showLoggerCalls').SinonStubbedLoggerSet} SinonStubbedLoggerSet */

const optsStub = sinon.stub().returns({})
const fakeContext = { opts: optsStub }

let writeStub
/** @type {SinonStubbedLoggerSet} */
let loggerStubs

t.beforeEach((ct) => {
  sinon.restore()
  logger.setLevel('info')
  writeStub = sinon.stub(fsx, 'writeFileX')
  loggerStubs = stubLoggers(allLoggerNames, true)
})

t.afterEach((ct) => {
  showLoggerCalls(loggerStubs, ct.name)
  loggerStubs = {}
})

t.test('lock action - command line', async ct => {
  const optsStub = sinon.stub().returns({})
  const fakeContext = { opts: optsStub, args: ['echo', ''], envs: [] }
  sinon.stub(process, 'argv').value(['node', 'dotenvx', 'lock'])
  const stub = sinon.stub(Lock.prototype, 'run')
  stub.returns({
    processedEnvs: [
      { locked: true, envKeysFilepath: '/path/to/.env.keys.development', privateKeyName: 'DOTENVX_PRIVATE_KEY_DEVELOPMENT' },
      { locked: true, envKeysFilepath: '/path/to/.env.keys.production', privateKeyName: 'DOTENVX_PRIVATE_KEY_PRODUCTION' }
    ],
    readableStrings: [],
    readableFilepaths: [],
    uniqueInjectedKeys: []
  })
  await lock.call(fakeContext, 'myPassphrase')

  t.ok(stub.called, 'new Lock().run() called')
  ct.ok(loggerStubs.success.calledWith('✔ /path/to/.env.keys.development (DOTENVX_PRIVATE_KEY_DEVELOPMENT) locked'), 'logger.success logs')
  ct.ok(loggerStubs.success.calledWith('✔ /path/to/.env.keys.production (DOTENVX_PRIVATE_KEY_PRODUCTION) locked'), 'logger.success logs')

  ct.end()
})

t.test('lock action - successMessage', async (ct) => {
  // Stub the Lock service
  sinon.stub(Lock.prototype, 'run').returns({
    processedEnvs: [
      { locked: true, envKeysFilepath: '/path/to/.env.keys.development', privateKeyName: 'DOTENVX_PRIVATE_KEY_DEVELOPMENT' },
      { locked: true, envKeysFilepath: '/path/to/.env.keys.production', privateKeyName: 'DOTENVX_PRIVATE_KEY_PRODUCTION' }
    ],
    changedFilepaths: [],
    unchangedFilepaths: []
  })

  // const loggerSuccessStub = sinon.stub(logger, 'success')

  await lock.call(fakeContext, 'myPassphrase')

  ct.ok(loggerStubs.success.calledWith('✔ /path/to/.env.keys.development (DOTENVX_PRIVATE_KEY_DEVELOPMENT) locked'), 'logger.success logs')
  ct.ok(loggerStubs.success.calledWith('✔ /path/to/.env.keys.production (DOTENVX_PRIVATE_KEY_PRODUCTION) locked'), 'logger.success logs')

  ct.end()
})
// ============================================================================================
t.test('lock action - INVALID_PASS_PHRASE_OPTIONS', async ct => {
  const optsStub = sinon.stub().returns({})
  const fakeContext = { opts: optsStub }
  const invalidArgumentsError = new Errors({ command: 'lock' }).invalidPassPhraseOptions()
  invalidArgumentsError.help = 'Mock help'

  const processExitStub = sinon.stub(process, 'exit')

  // stub replacement for Lock.run()
  sinon.stub(Lock.prototype, 'run').returns({
    processedEnvs: [{ error: invalidArgumentsError }],
    changedFilepaths: [],
    unchangedFilepaths: []
  })

  await lock.call(fakeContext)

  t.ok(processExitStub.calledWith(1), 'process.exit(1)')
  t.ok(loggerStubs.error.calledWithMatch('[INVALID_PASS_PHRASE_OPTIONS] no passphrase provided and no --prompt flag'), 'logger.error called for invalid arguments')
  t.ok(loggerStubs.debug.calledWithMatch('lock action called'), 'logger.debug called for lock action')
  t.ok(writeStub.notCalled, 'fsx.writeFileX')
  logger.silly(`| ====== end of test: ${ct.name} ======`)

  ct.end()
})

// ============================================================================================
t.test('lock action - EMPTY_PASS_PHRASE', async ct => {
  const optsStub = sinon.stub().returns({ envKeysFile: '.env.keys' })
  const fakeContext = { opts: optsStub }
  const emptyPassphraseError = new Errors({}).emptyPassPhrase()
  emptyPassphraseError.help = 'Mock help'
  // stub replacement for Lock.run()
  sinon.stub(Lock.prototype, 'run').returns({
    processedEnvs: [{ error: emptyPassphraseError }],
    changedFilepaths: [],
    unchangedFilepaths: []
  })
  const ensurePasswordStub = sinon.stub().resolves(null)
  const lock = proxyquire.noCallThru()('../../../../src/cli/actions/ext/lock', {
    '../../../lib/helpers/passwordPrompt': { ensurePassword: ensurePasswordStub }
  })
  const processExitStub = sinon.stub(process, 'exit')

  await lock.call(fakeContext, ' "" ')
  t.ok(processExitStub.calledWith(1), 'process.exit(1)')

  t.ok(ensurePasswordStub.called, 'ensurePasswordStub called')
  t.ok(loggerStubs.error.calledWithMatch('[EMPTY_PASS_PHRASE] a valid passphrase could not be determined'), 'logger.error called for empty pass phrase')
  t.ok(writeStub.notCalled, 'fsx.writeFileX')

  ct.end()
})

// ============================================================================================
t.test('lock action - MISSING_ENV_FILE', async ct => {
  const optsStub = sinon.stub().returns({})
  const fakeContext = { opts: optsStub }
  const missingEnvFileError = new Errors({ envFilepath: '.env', filepath: '/path/to/.env' }).missingEnvFile()
  // stub replacement for Lock.run()
  const stub = sinon.stub(Lock.prototype, 'run').returns({
    processedEnvs: [{ error: missingEnvFileError, help: '(help goes here)' }],
    changedFilepaths: [],
    unchangedFilepaths: []
  })

  await lock.call(fakeContext, 'myPassphrase')

  t.ok(stub.called, 'Lock().run() called')
  t.ok(loggerStubs.error.calledWithMatch('[MISSING_ENV_FILE] missing .env file (/path/to/.env)'), 'logger.error called for missing env file')
  t.ok(loggerStubs.help.calledWithMatch('? add one with [echo "HELLO=World" > undefined] and re-run [dotenvx set]'), 'logger.help called for missing env file')
  t.ok(loggerStubs.help.calledWithMatch('[MISSING_ENV_FILE] https://github.com/dotenvx/dotenvx/issues/484'), 'logger.help called for missing env file')
  t.ok(writeStub.notCalled, 'fsx.writeFileX')

  ct.end()
})
// ============================================================================================
t.test('lock action - MULTIPLE ENVS', async ct => {
  const optsStub = sinon.stub().returns({ envKeysFile: '.env.keys', salt: 'justAPinch' })
  const fakeContext = { opts: optsStub, envs: ['development', 'production'] }
  // stub replacement for Lock.run()
  const stub = sinon.stub(Lock.prototype, 'run').returns({
    processedEnvs: [
      { locked: true, envKeysFilepath: '/path/to/.env.keys.development', privateKeyName: 'DOTENVX_PRIVATE_KEY_DEVELOPMENT' },
      { locked: true, envKeysFilepath: '/path/to/.env.keys.production', privateKeyName: 'DOTENVX_PRIVATE_KEY_PRODUCTION' }
    ],
    changedFilepaths: [],
    unchangedFilepaths: []
  })

  await lock.call(fakeContext, 'myPassphrase')

  t.ok(stub.called, 'Lock().run() called')
  t.ok(loggerStubs.success.calledWithMatch('✔ /path/to/.env.keys.development (DOTENVX_PRIVATE_KEY_DEVELOPMENT) locked'), 'logger.success called')
  t.ok(loggerStubs.success.calledWithMatch('✔ /path/to/.env.keys.production (DOTENVX_PRIVATE_KEY_PRODUCTION) locked'), 'logger.success called')
  t.ok(writeStub.notCalled, 'fsx.writeFileX')
  logger.silly(`| ====== end of test: ${ct.name} ======`)

  ct.end()
})
// ============================================================================================
t.test('lock action - CATCH ERROR', async ct => {
  const error = new Error('Mock Error')
  error.help = 'Mock Help'
  error.debug = 'Mock Debug'
  error.code = 500

  const optsStub = sinon.stub().returns({})
  const fakeContext = { opts: optsStub }
  const stub = sinon.stub(Lock.prototype, 'run').throws(error)

  const processExitStub = sinon.stub(process, 'exit')

  await lock.call(fakeContext, ' "" ')

  t.ok(stub.called, 'Lock().run() called')
  t.ok(loggerStubs.error.calledWith('Mock Error'), 'logger error')
  t.ok(loggerStubs.help.calledWith('Mock Help'), 'logger help')
  t.ok(loggerStubs.debug.calledWith('Mock Debug'), 'logger debug')
  t.ok(loggerStubs.debug.calledWith('ERROR_CODE: 500'), 'logger debug')
  t.ok(processExitStub.calledWith(1), 'process.exit(1)')
  t.ok(writeStub.notCalled, 'fsx.writeFileX')
  logger.silly(`| ====== end of test: ${ct.name} ======`)

  ct.end()
})
// ============================================================================================
t.test('lock action - Lock().run() error', async ct => {
  const optsStub = sinon.stub().returns({})
  const fakeContext = { opts: optsStub }
  // stub replacement for Lock.run()
  const stub = sinon.stub(Lock.prototype, 'run').returns({
    processedEnvs: [{ error: { code: 'MOCK_ERROR', message: '[MOCK_ERROR] message goes here', help: '[MOCK_ERROR] (help goes here)' } }],
    changedFilepaths: [],
    unchangedFilepaths: []
  })

  await lock.call(fakeContext, 'myPassphrase')

  t.ok(stub.called, 'Lock().run() called')
  t.ok(loggerStubs.error.calledWithMatch('[MOCK_ERROR] message goes here'), 'logger.error called for mock error')
  t.ok(loggerStubs.help.calledWithMatch('[MOCK_ERROR] (help goes here)'), 'logger.help called for mock error')
  t.ok(writeStub.notCalled, 'fsx.writeFileX')

  ct.end()
})
