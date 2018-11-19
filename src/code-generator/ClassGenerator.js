import CodeGenerator from './CodeGenerator';
import AssertionGenerator from './AssertionGenerator';

export const defaults = {
  wrapAsync: true,
  headless: true,
  waitForNavigation: true,
  waitForSelectorOnClick: true,
  blankLinesBetweenBlocks: true,
  useExistingBrowser: true,
  generateAssertions: true,
  useXPath: true
}

const header = `class EndToEndInstance {
  constructor(options, browser, logger) {
    this._options = options;
    this._browser = browser;
    this._logger = logger;
  }`;

const footer = `}

(options, browser, logger) => new EndToEndInstance(options, browser, logger)`;

export default class ClassGenerator {
  constructor (options) {
    this._options = { ...defaults, ...options };
    this._codeGenerator = new CodeGenerator(options);
    this._assertionGenerator = new AssertionGenerator(options);
  }

  generateCode (events) {
    return this._codeGenerator.generate(events);
  }

  generateAssertions (events) {
    return this._assertionGenerator.generate(events);
  }

  generate (events, assertions) {
    if (this._options.generateAssertions){
      return `${header}\n${this.generateCode(events)}\n${this.generateAssertions(assertions)}\n${footer}`;
    }
    return this.generateCode(events);
  }
}
