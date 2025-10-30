const { logger } = require('./../../../shared/logger')

const Unlock = require('./../../../lib/services/unlock')

const catchAndLog = require('../../../lib/helpers/catchAndLog')
const { ensurePassword } = require('../../../lib/helpers/passwordPrompt')
const Errors = require('../../../lib/helpers/errors')

const _performUnlock = (passphrase, salt, envs, envKeysFilepath) => {
  logger.debug(`about to call new Unlock(...).run() with envs: ${JSON.stringify(envs)}, envKeysFilepath: ${envKeysFilepath}, passphrase: ${passphrase}, salt: ${salt}`)

  const {
    processedEnvs
  } = new Unlock(envs, envKeysFilepath, passphrase, salt).run()

  logger.debug(`Unlock.run() completed returning processedEnvs: ${JSON.stringify(processedEnvs)}`)

  for (const processedEnv of processedEnvs) {
    if (processedEnv.error) {
      logger.verbose(`processedEnv got error: ${JSON.stringify(processedEnv.error)}`)

      if (processedEnv.error.code === 'MISSING_ENV_FILE') {
        logger.warn(processedEnv.error.message)
        logger.help(`? add one with [echo "HELLO=World" > ${processedEnv.envFilepath}] and re-run [dotenvx set]`)
      } else {
        logger.warn(processedEnv.error.message)
        if (processedEnv.error.help) {
          logger.help(processedEnv.error.help)
        }
      }
    }
  }

  for (const processedEnv of processedEnvs) {
    if (processedEnv.error) {
      logger.error(processedEnv.error.message)
      if (processedEnv.error.help) {
        logger.help(processedEnv.error.help)
      }
    }
    if (processedEnv.unlocked) {
      logger.success(`✔ ${processedEnv.envKeysFilepath} (${processedEnv.privateKeyName}) unlocked`)
    }
  }
}

function unlock (passphrase) {
  logger.debug('unlock action called')

  const options = this.opts()
  logger.debug(`options: ${JSON.stringify(options)}`)

  const envs = this.envs
  const envKeysFilepath = options.envKeysFile
  const salt = options.salt

  // this will prompt for a password if none is provided and --prompt is true
  return ensurePassword(passphrase, options.prompt, false).then((passphrase) => {
    if (passphrase) {
      logger.debug(`passphrase: ${passphrase}`)
      return _performUnlock(passphrase, salt, envs, envKeysFilepath)
    } else {
      logger.debug('no passphrase provided via prompt; will throw an error')
      return Promise.reject(new Errors().emptyPassPhrase())
    }
  }).catch((error) => {
    catchAndLog(error)
    process.exit(1)
  })
}

module.exports = unlock
