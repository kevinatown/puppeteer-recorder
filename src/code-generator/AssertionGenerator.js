import { defaults } from './ClassGenerator';

export default class AssertionGenerator {
  constructor (options) {
    this._options = { ...defaults, ...options };
  }

  generate (events) {
    return `  async runAssertions() {
      console.log('hi from assertions');\n  }`
  }
}
