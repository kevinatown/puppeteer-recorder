import domEvents from './dom-events-to-record'
import pptrActions from './pptr-actions'
import Block from './Block'
import { defaults } from './ClassGenerator';

const importPuppeteer = `const puppeteer = require('puppeteer');\n`
const tryStart = `try {
  `;
const catchEnd = `} catch (e) {
    throw e;
  }`;
const newPage = `const page = await browser.newPage();`

const header = `const browser = await puppeteer.launch()
  ${newPage}`

const footer = `await browser.close()`

const wrappedHeader = `(async () => {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()\n`

const useBrowserPageHeader = `async (browser) => {
  ${tryStart}
    ${newPage}`;

const useBrowserPageFooter = `  ${catchEnd}
  return page;
}`

const wrappedFooter = `  await browser.close()
})()`

const classHeader = `  async getInstance () {
    try {`;

const classFooter = `    } catch(e) {
      throw new Error(e);
    }
  }`;

export default class CodeGenerator {
  constructor (options) {
    this._options = Object.assign(defaults, options)
    this._blocks = []
    this._frame = 'page'
    this._frameId = 0
    this._allFrames = {}
    this._navigationPromiseSet = false
  }

  generate (events) {
    if (this._options.generateAssertions) {
      return `${classHeader}\n${this._parseEvents(events)}\n${classFooter}`;ß
    }
    if (this._options.useExistingBrowser) {
      return useBrowserPageHeader + this._parseEvents(events) + useBrowserPageFooter
    }
    return importPuppeteer + this._getHeader() + this._parseEvents(events) + this._getFooter()
  }

  _getHeader () {
    console.debug(this._options)
    let hdr = this._options.wrapAsync ? wrappedHeader : header
    hdr = this._options.headless ? hdr : hdr.replace('launch()', 'launch({ headless: false })')
    return hdr
  }

  _getFooter () {
    if (this._options.useExistingBrowser) {
      return '';
    }
    return this._options.wrapAsync ? wrappedFooter : footer
  }

  _parseEvents (events) {
    console.log(`generating code for ${events ? events.length : 0} events`)
    let result = ''
    for (let i = 0; i < events.length; i++) {
      const { action, value, href, keyCode, tagName, frameId, frameUrl } = events[i]

      let selector = events[i].selector;
      // 
      // TODO: FIX THIS SHIT, kinda messy
      // 
      if (this._options.useXPath) {
        selector = events[i].xPath;
      }
      // console.log(action, selector, value, href, keyCode, tagName, frameId, frameUrl)
      // we need to keep a handle on what frames events originate from
      this._setFrames(frameId, frameUrl)

      switch (action) {
        case 'keydown':
          if (keyCode === 9) {
            this._blocks.push(this._handleKeyDown(selector, value, keyCode))
          }
          break
        case 'click':
          const next = i + 1
          if (events[next] && events[next].action === 'navigation*' && this._options.waitForNavigation && !this._navigationPromiseSet) {
            const block = new Block(this._frameId)
            block.addLine({type: pptrActions.NAVIGATION_PROMISE, value: `const navigationPromise = page.waitForNavigation();`})
            this._blocks.push(block)
            this._navigationPromiseSet = true
          }

          this._blocks.push(this._handleClick(selector, events))
          break
        case 'change':
          if (tagName === 'SELECT') {
            this._blocks.push(this._handleChange(selector, value))
          }
          break
        case 'goto*':
          this._blocks.push(this._handleGoto(href, frameId))
          break
        case 'viewport*':
          this._blocks.push((this._handleViewport(value.width, value.height)))
          break
        case 'navigation*':
          this._blocks.push(this._handleWaitForNavigation())
          break
      }
    }

    this._postProcess()

    let indent = this._options.wrapAsync ? '  ' : '';
    indent = this._options.useExistingBrowser ? `${indent}  ` : indent;
    indent = this._options.generateAssertions ? `${indent}  ` : indent;
    const newLine = `\n`

    for (let block of this._blocks) {
      const lines = block.getLines()
      for (let line of lines) {
        result += indent + line.value + newLine
      }
    }
    if (this._options.useExistingBrowser) {
      result = `${result}${indent}return page;${newLine}`
    }
    return result
  }

  _setFrames (frameId, frameUrl) {
    if (frameId && frameId !== 0) {
      this._frameId = frameId
      this._frame = `frame_${frameId}`
      this._allFrames[frameId] = frameUrl
    } else {
      this._frameId = 0
      this._frame = 'page'
    }
  }

  _postProcess () {
    // we want to create only one navigationPromise
    if (this._options.waitForNavigation && !this._navigationPromiseSet) {
      this._postProcessWaitForNavigation()
    }

    // when events are recorded from different frames, we want to add a frame setter near the code that uses that frame
    if (Object.keys(this._allFrames).length > 0) {
      this._postProcessSetFrames()
    }

    if (this._options.blankLinesBetweenBlocks && this._blocks.length > 0) {
      this._postProcessAddBlankLines()
    }
  }

  _handleKeyDown (selector, value) {
    const block = new Block(this._frameId)
    block.addLine({ type: domEvents.KEYDOWN, value: `await ${this._frame}.type('${selector}', '${value}');` })
    return block
  }

  _handleClick (selector) {
    const block = new Block(this._frameId)
    if (this._options.waitForSelectorOnClick) {
      block.addLine({ type: domEvents.CLICK, value: `await ${this._frame}.waitForSelector('${selector}');` })
    }
    block.addLine({ type: domEvents.CLICK, value: `await ${this._frame}.click('${selector}');` })
    return block
  }
  _handleChange (selector, value) {
    return new Block(this._frameId, { type: domEvents.CHANGE, value: `await ${this._frame}.select('${selector}', '${value}');` })
  }
  _handleGoto (href) {
    return new Block(this._frameId, { type: pptrActions.GOTO, value: `await ${this._frame}.goto('${href}');` })
  }

  _handleViewport (width, height) {
    return new Block(this._frameId, { type: pptrActions.VIEWPORT, value: `await ${this._frame}.setViewport({ width: ${width}, height: ${height} });` })
  }

  _handleWaitForNavigation () {
    const block = new Block(this._frameId)
    if (this._options.waitForNavigation) {
      block.addLine({type: pptrActions.NAVIGATION, value: `await navigationPromise`})
    }
    return block
  }

  _postProcessWaitForNavigation () {
    for (let [i, block] of this._blocks.entries()) {
      const lines = block.getLines()
      for (let line of lines) {
        if (line.type === pptrActions.NAVIGATION) {
          this._blocks[i].addLineToTop({type: pptrActions.NAVIGATION_PROMISE, value: `const navigationPromise = page.waitForNavigation();`})
          return
        }
      }
    }
  }

  _postProcessSetFrames () {
    for (let [i, block] of this._blocks.entries()) {
      const lines = block.getLines()
      for (let line of lines) {
        if (line.frameId && Object.keys(this._allFrames).includes(line.frameId.toString())) {
          const declaration = `const frame_${line.frameId} = frames.find(f => f.url() === '${this._allFrames[line.frameId]}');`
          this._blocks[i].addLineToTop(({ type: pptrActions.FRAME_SET, value: declaration }))
          this._blocks[i].addLineToTop({ type: pptrActions.FRAME_SET, value: 'let frames = await page.frames();' })
          delete this._allFrames[line.frameId]
          break
        }
      }
    }
  }

  _postProcessAddBlankLines () {
    let i = 0
    while (i <= this._blocks.length) {
      const blankLine = new Block()
      blankLine.addLine({ type: null, value: '' })
      this._blocks.splice(i, 0, blankLine)
      i += 2
    }
  }
}
