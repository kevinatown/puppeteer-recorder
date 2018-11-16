/**
 * Copyright 2011 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @author opensource@google.com
 * @license Apache License, Version 2.0.
 */

/**
 * This code is shameless stolen from: https://github.com/eliasdorneles/xpath_helper
 */

'use strict';

// Extension namespace.
var xh = xh || {};


////////////////////////////////////////////////////////////////////////////////
// Generic helper functions and constants

xh.SHIFT_KEYCODE = 16;
xh.X_KEYCODE = 88;

xh.bind = function(object, method) {
  return function() {
    return method.apply(object, arguments);
  };
};

xh.elementsShareFamily = function(primaryEl, siblingEl) {
  if (primaryEl.tagName === siblingEl.tagName &&
      (!primaryEl.className || primaryEl.className === siblingEl.className) &&
      (!primaryEl.id || primaryEl.id === siblingEl.id)) {
    return true;
  }
  return false;
};

xh.getElementIndex = function(el) {
  var className = el.className;
  var id = el.id;

  var index = 1;  // XPath is one-indexed
  var sib;
  for (sib = el.previousSibling; sib; sib = sib.previousSibling) {
    if (sib.nodeType === Node.ELEMENT_NODE && xh.elementsShareFamily(el, sib)) {
      index++;
    }
  }
  if (index > 1) {
    return index;
  }
  for (sib = el.nextSibling; sib; sib = sib.nextSibling) {
    if (sib.nodeType === Node.ELEMENT_NODE && xh.elementsShareFamily(el, sib)) {
      return 1;
    }
  }
  return 0;
};

xh.makeQueryForElement = function(el) {
  var query = '';
  for (; el && el.nodeType === Node.ELEMENT_NODE; el = el.parentNode) {
    var component = el.tagName.toLowerCase();
    var index = xh.getElementIndex(el);
    if (el.id) {
      component += '[@id=\'' + el.id + '\']';
    } else if (el.className) {
      component += '[@class=\'' + el.className + '\']';
    }
    if (index >= 1) {
      component += '[' + index + ']';
    }
    // If the last tag is an img, the user probably wants img/@src.
    if (query === '' && el.tagName.toLowerCase() === 'img') {
      component += '/@src';
    }
    query = '/' + component + query;
  }
  return query;
};

xh.highlightNodes = function(nodes) {
  for (var i = 0, l = nodes.length; i < l; i++) {
    nodes[i].className += ' xh-highlight';
  }
};

xh.clearHighlights = function() {
  var els = document.getElementsByClassName('xh-highlight');
  // Note: getElementsByClassName() returns a live NodeList.
  while (els.length) {
    els[0].className = els[0].className.replace(' xh-highlight', '');
  }
};

// Returns [values, nodeCount]. Highlights result nodes, if applicable. Assumes
// no nodes are currently highlighted.
xh.evaluateQuery = function(query) {
  var xpathResult = null;
  var str = '';
  var nodeCount = 0;
  var nodesToHighlight = [];

  try {
    xpathResult = document.evaluate(query, document, null,
                                    XPathResult.ANY_TYPE, null);
  } catch (e) {
    str = '[INVALID XPATH EXPRESSION]';
    nodeCount = 0;
  }

  if (!xpathResult) {
    return [str, nodeCount];
  }

  if (xpathResult.resultType === XPathResult.BOOLEAN_TYPE) {
    str = xpathResult.booleanValue ? '1' : '0';
    nodeCount = 1;
  } else if (xpathResult.resultType === XPathResult.NUMBER_TYPE) {
    str = xpathResult.numberValue.toString();
    nodeCount = 1;
  } else if (xpathResult.resultType === XPathResult.STRING_TYPE) {
    str = xpathResult.stringValue;
    nodeCount = 1;
  } else if (xpathResult.resultType ===
             XPathResult.UNORDERED_NODE_ITERATOR_TYPE) {
    for (var it = xpathResult.iterateNext(); it;
         it = xpathResult.iterateNext()) {
      nodesToHighlight.push(it);
      if (str) {
        str += '\n';
      }
      str += it.textContent;
      nodeCount++;
    }
    if (nodeCount === 0) {
      str = '';
    }
  } else {
    // Since we pass XPathResult.ANY_TYPE to document.evaluate(), we should
    // never get back a result type not handled above.
    str = '[INTERNAL ERROR]';
    nodeCount = 0;
  }

  xh.highlightNodes(nodesToHighlight);
  return [str, nodeCount];
};

module.exports = xh;
