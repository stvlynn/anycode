export class SandboxViolationStore {
  constructor() {}
}

export const SandboxRuntimeConfigSchema = {
  parse(value) {
    return value
  },
  safeParse(value) {
    return { success: true, data: value }
  },
}

export class SandboxManager {
  static checkDependencies() {
    return { errors: [] }
  }
  static isSupportedPlatform() {
    return false
  }
  static wrapWithSandbox(command) {
    return command
  }
  static async initialize() {}
  static updateConfig() {}
  static reset() {
    return true
  }
  static getFsReadConfig() {
    return {}
  }
  static getFsWriteConfig() {
    return {}
  }
  static getNetworkRestrictionConfig() {
    return {}
  }
  static getIgnoreViolations() {
    return {}
  }
  static getAllowUnixSockets() {
    return false
  }
  static getAllowLocalBinding() {
    return false
  }
  static getEnableWeakerNestedSandbox() {
    return false
  }
  static getProxyPort() {
    return undefined
  }
  static getSocksProxyPort() {
    return undefined
  }
  static getLinuxHttpSocketPath() {
    return undefined
  }
  static getLinuxSocksSocketPath() {
    return undefined
  }
  static async waitForNetworkInitialization() {}
  static getSandboxViolationStore() {
    return new SandboxViolationStore()
  }
  static annotateStderrWithSandboxFailures(_cmd, stderr) {
    return stderr
  }
  static cleanupAfterCommand() {}
}
