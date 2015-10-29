/*
 * An implementation of Spatial Navigation for jQuery.
 *
 * Copyright (c) 2015 Luke Chang.
 * https://github.com/luke-chang/jquery-spatialNavigation
 *
 * Licensed under the MPL license.
 */
;(function($) {
  'use strict';

  /************************/
  /* Global Configuration */
  /************************/
  var GlobalConfig = {
    selector: '.focusable',
    straightOnly: false,
    straightOverlapThreshold: 0.5,
    rememberSource: false,
    enterToLastFocused: false,
    restrict: 'self-first', // 'self-first', 'self-only', 'none'
    tabIndexIgnoreList:
      'a, input, select, textarea, button, iframe, [contentEditable=true]',
    navigableFilter: null
  };

  /*********************/
  /* Constant Variable */
  /*********************/
  var KEYMAPPING = {
    '37': 'left',
    '38': 'up',
    '39': 'right',
    '40': 'down'
  };

  var REVERSE = {
    'left': 'right',
    'up': 'down',
    'right': 'left',
    'down': 'up'
  };

  var EVENT_PREFIX = 'sn:';

  /********************/
  /* Private Variable */
  /********************/
  var _ready = false;
  var _pause = false;
  var _sections = {};
  var _sectionCount = 0;
  var _defaultSectionId = '';
  var _lastSectionId = '';
  var _duringFocusChange = false;

  /*****************/
  /* Core Function */
  /*****************/
  function getRect(elem) {
    var cr = elem.getBoundingClientRect();
    var rect = {
        left: cr.left,
        top: cr.top,
        width: cr.width,
        height: cr.height
    };
    rect.element = elem;
    rect.right = rect.left + rect.width;
    rect.bottom = rect.top + rect.height;
    rect.center = {
      x: rect.left + Math.floor(rect.width / 2),
      y: rect.top + Math.floor(rect.height / 2)
    };
    rect.center.left = rect.center.right = rect.center.x;
    rect.center.top = rect.center.bottom = rect.center.y;
    return rect;
  }

  function partition(rects, targetRect, straightOverlapThreshold) {
    var groups = [[], [], [], [], [], [], [], [], []];

    for (var i = 0; i < rects.length; i++) {
      var rect = rects[i];
      var center = rect.center;
      var x, y, groupId;

      if (center.x < targetRect.left) {
        x = 0;
      } else if (center.x <= targetRect.right) {
        x = 1;
      } else {
        x = 2;
      }

      if (center.y < targetRect.top) {
        y = 0;
      } else if (center.y <= targetRect.bottom) {
        y = 1;
      } else {
        y = 2;
      }

      groupId = y * 3 + x;
      groups[groupId].push(rect);

      if ([0, 2, 6, 8].indexOf(groupId) !== -1) {
        var threshold = straightOverlapThreshold;

        if (rect.left <= targetRect.right - targetRect.width * threshold) {
          if (groupId === 2) {
            groups[1].push(rect);
          } else if (groupId === 8) {
            groups[7].push(rect);
          }
        }

        if (rect.right >= targetRect.left + targetRect.width * threshold) {
          if (groupId === 0) {
            groups[1].push(rect);
          } else if (groupId === 6) {
            groups[7].push(rect);
          }
        }

        if (rect.top <= targetRect.bottom - targetRect.height * threshold) {
          if (groupId === 6) {
            groups[3].push(rect);
          } else if (groupId === 8) {
            groups[5].push(rect);
          }
        }

        if (rect.bottom >= targetRect.top + targetRect.height * threshold) {
          if (groupId === 0) {
            groups[3].push(rect);
          } else if (groupId === 2) {
            groups[5].push(rect);
          }
        }
      }
    }

    return groups;
  }

  function generateDistanceFunction(targetRect) {
    return {
      nearPlumbLineIsBetter: function(rect) {
        var d;
        if (rect.center.x < targetRect.center.x) {
          d = targetRect.center.x - rect.right;
        } else {
          d = rect.left - targetRect.center.x;
        }
        return d < 0 ? 0 : d;
      },
      nearHorizonIsBetter: function(rect) {
        var d;
        if (rect.center.y < targetRect.center.y) {
          d = targetRect.center.y - rect.bottom;
        } else {
          d = rect.top - targetRect.center.y;
        }
        return d < 0 ? 0 : d;
      },
      nearTargetLeftIsBetter: function(rect) {
        var d;
        if (rect.center.x < targetRect.center.x) {
          d = targetRect.left - rect.right;
        } else {
          d = rect.left - targetRect.left;
        }
        return d < 0 ? 0 : d;
      },
      nearTargetTopIsBetter: function(rect) {
        var d;
        if (rect.center.y < targetRect.center.y) {
          d = targetRect.top - rect.bottom;
        } else {
          d = rect.top - targetRect.top;
        }
        return d < 0 ? 0 : d;
      },
      topIsBetter: function(rect) {
        return rect.top;
      },
      bottomIsBetter: function(rect) {
        return -1 * rect.bottom;
      },
      leftIsBetter: function(rect) {
        return rect.left;
      },
      rightIsBetter: function(rect) {
        return -1 * rect.right;
      }
    };
  }

  function prioritize(priorities) {
    var destPriority = null;
    for (var i = 0; i < priorities.length; i++) {
      if (priorities[i].group.length) {
        destPriority = priorities[i];
        break;
      }
    }

    if (!destPriority) {
      return null;
    }

    var destDistance = destPriority.distance;

    destPriority.group.sort(function(a, b) {
      for (var i = 0; i < destDistance.length; i++) {
        var distance = destDistance[i];
        var delta = distance(a) - distance(b);
        if (delta) {
          return delta;
        }
      }
      return 0;
    });

    return destPriority.group;
  }

  function navigate(target, direction, candidates, config) {
    if (!target || !direction || !candidates || !candidates.length) {
      return null;
    }

    var rects = [];
    for (var i = 0; i < candidates.length; i++) {
      var rect = getRect(candidates[i]);
      if (rect) {
        rects.push(rect);
      }
    }
    if (!rects.length) {
      return null;
    }

    var targetRect = getRect(target);
    if (!targetRect) {
      return null;
    }

    var distanceFunction = generateDistanceFunction(targetRect);

    var groups = partition(
      rects,
      targetRect,
      config.straightOverlapThreshold
    );

    var internalGroups = partition(
      groups[4],
      targetRect.center,
      config.straightOverlapThreshold
    );

    var priorities;

    switch (direction) {
      case 'left':
        priorities = [
          {
            group: internalGroups[0].concat(internalGroups[3])
                                     .concat(internalGroups[6]),
            distance: [
              distanceFunction.nearPlumbLineIsBetter,
              distanceFunction.topIsBetter
            ]
          },
          {
            group: groups[3],
            distance: [
              distanceFunction.nearPlumbLineIsBetter,
              distanceFunction.topIsBetter
            ]
          },
          {
            group: groups[0].concat(groups[6]),
            distance: [
              distanceFunction.nearHorizonIsBetter,
              distanceFunction.rightIsBetter,
              distanceFunction.nearTargetTopIsBetter
            ]
          }
        ];
        break;
      case 'right':
        priorities = [
          {
            group: internalGroups[2].concat(internalGroups[5])
                                     .concat(internalGroups[8]),
            distance: [
              distanceFunction.nearPlumbLineIsBetter,
              distanceFunction.topIsBetter
            ]
          },
          {
            group: groups[5],
            distance: [
              distanceFunction.nearPlumbLineIsBetter,
              distanceFunction.topIsBetter
            ]
          },
          {
            group: groups[2].concat(groups[8]),
            distance: [
              distanceFunction.nearHorizonIsBetter,
              distanceFunction.leftIsBetter,
              distanceFunction.nearTargetTopIsBetter
            ]
          }
        ];
        break;
      case 'up':
        priorities = [
          {
            group: internalGroups[0].concat(internalGroups[1])
                                     .concat(internalGroups[2]),
            distance: [
              distanceFunction.nearHorizonIsBetter,
              distanceFunction.leftIsBetter
            ]
          },
          {
            group: groups[1],
            distance: [
              distanceFunction.nearHorizonIsBetter,
              distanceFunction.leftIsBetter
            ]
          },
          {
            group: groups[0].concat(groups[2]),
            distance: [
              distanceFunction.nearPlumbLineIsBetter,
              distanceFunction.bottomIsBetter,
              distanceFunction.nearTargetLeftIsBetter
            ]
          }
        ];
        break;
      case 'down':
        priorities = [
          {
            group: internalGroups[6].concat(internalGroups[7])
                                     .concat(internalGroups[8]),
            distance: [
              distanceFunction.nearHorizonIsBetter,
              distanceFunction.leftIsBetter
            ]
          },
          {
            group: groups[7],
            distance: [
              distanceFunction.nearHorizonIsBetter,
              distanceFunction.leftIsBetter
            ]
          },
          {
            group: groups[6].concat(groups[8]),
            distance: [
              distanceFunction.nearPlumbLineIsBetter,
              distanceFunction.topIsBetter,
              distanceFunction.nearTargetLeftIsBetter
            ]
          }
        ];
        break;
      default:
        return null;
    }

    if (config.straightOnly) {
      priorities.pop();
    }

    var destGroup = prioritize(priorities);
    if (!destGroup) {
      return null;
    }

    var dest = null;
    if (config.rememberSource &&
        config.previous &&
        config.previous.destination === target &&
        config.previous.reverse === direction) {
      for (var j = 0; j < destGroup.length; j++) {
        if (destGroup[j].element === config.previous.target) {
          dest = destGroup[j].element;
          break;
        }
      }
    }

    if (!dest) dest = destGroup[0].element;

    return dest;
  }

  /***************************/
  /* jQuery Private Function */
  /***************************/
  function isNavigable(elem, sectionId) {
    if (! elem) {
      return false;
    }
    var $elem = $(elem);
    if (!$elem.is(':visible') || $elem.prop('disabled')) {
      return false;
    }
    if (sectionId && $.isFunction(_sections[sectionId].navigableFilter)) {
      if (_sections[sectionId].navigableFilter(elem) === false) {
        return false;
      }
    } else if ($.isFunction(GlobalConfig.navigableFilter) &&
               GlobalConfig.navigableFilter(elem) === false) {
      return false;
    }
    return true;
  }

  function getSectionId(elem) {
    for (var id in _sections) {
      var $section = $(_sections[id].selector);
      if ($section.filter(elem).length) {
        return id;
      }
    }
    return undefined;
  }

  function getSectionNavigableElements$(sectionId) {
    return $(_sections[sectionId].selector).filter(function() {
      return isNavigable($(this).get(0), sectionId);
    });
  }

  function fireEvent(selector, type, details) {
    var evt = $.Event(EVENT_PREFIX + type);
    $.extend(evt, details);
    $(selector).trigger(evt);
    if (evt.isDefaultPrevented()) {
      return false;
    }
    return true;
  }

  function focusElement(elem, sectionId) {
    if (!elem) {
      return false;
    }

    _duringFocusChange = true;

    var currentFocusedElement = document.activeElement;

    var unfocusProperties = {
      next: elem,
      nextSection: sectionId
    };
    if (!fireEvent(currentFocusedElement, 'willunfocus', unfocusProperties)) {
      _duringFocusChange = false;
      return false;
    }
    currentFocusedElement.blur();
    fireEvent(currentFocusedElement, 'unfocused', unfocusProperties);

    var focusProperties = {
      from: currentFocusedElement,
      section: sectionId
    };
    if (!fireEvent(elem, 'willfocus', focusProperties)) {
      _duringFocusChange = false;
      return false;
    }
    elem.focus();
    fireEvent(elem, 'focused', focusProperties);

    _duringFocusChange = false;

    focusChanged(elem, sectionId);
    return true;
  }

  function focusChanged(elem, sectionId) {
    if (!sectionId) {
      sectionId = getSectionId(elem);
    }
    if (sectionId) {
      _sections[sectionId].lastFocusedElement = elem;
      _lastSectionId = sectionId;
    }
  }

  function focusSection(sectionId) {
    var next, nextSectionId, range;
    var elemOrder = ['defaultFocusedElement', 'lastFocusedElement'];

    if (sectionId) {
      if (_sections[sectionId]) {
        range = [sectionId];
      } else {
        throw new Error('Section "' + sectionId + '" doesn\'t exist!');
      }
    } else if (_lastSectionId == _defaultSectionId) {
      range = [_defaultSectionId];
    } else {
      range = [_lastSectionId, _defaultSectionId];
    }

    $.each(range, function(i, id) {
      if (!id || !_sections[id]) {
        return;
      }

      $.each(elemOrder, function(j, item) {
        var elem = _sections[id][item];

        if (elem instanceof $) {
          elem = elem.get(0);
        } else if ($.type(elem) === 'string') {
          elem = $(elem).get(0);
        }

        if (elem && isNavigable(elem, id)) {
          next = elem;
          nextSectionId = id;
          return false;
        }
      });

      if (next) {
        return false;
      }

      var $section = getSectionNavigableElements$(id);
      if ($section.length) {
        next = $section.get(0);
        nextSectionId = id;
        return false;
      }
    });

    focusElement(next, nextSectionId);

    return !!next;
  }

  function onKeyDown(evt) {
    var next, nextSectionId, currentFocusedElement;

    if (!_sectionCount) {
      return;
    }

    var direction = KEYMAPPING[evt.keyCode];
    if (!direction) {
      if (!_pause && evt.keyCode == 13) {
        currentFocusedElement = $(':focus').get(0);
        if (currentFocusedElement && getSectionId(currentFocusedElement)) {
          return fireEvent(currentFocusedElement, 'enter-down');
        }
      }
      return;
    }

    if (_pause) {
      return false;
    }

    currentFocusedElement = $(':focus').get(0);

    if (!currentFocusedElement) {
      if (_lastSectionId && _sections[_lastSectionId] && isNavigable(
                _sections[_lastSectionId].lastFocusedElement, _lastSectionId)) {
        currentFocusedElement = _sections[_lastSectionId].lastFocusedElement;
      } else {
        focusSection();
        return;
      }
    }

    var currentSectionId = getSectionId(currentFocusedElement);
    if (!currentSectionId) {
      focusSection();
      return;
    }

    var predefinedSelector = $(currentFocusedElement).data('sn-' + direction);
    if (predefinedSelector !== undefined) {
      if (predefinedSelector !== '') {
        if (predefinedSelector.charAt(0) == '@') {
          nextSectionId = predefinedSelector.substr(1);
          if (_sections[nextSectionId]) {
            focusSection(nextSectionId);
            return;
          }
        } else {
          next = $(predefinedSelector).get(0);
          if (next) {
            nextSectionId = getSectionId(next);
            if (isNavigable(next, nextSectionId)) {
              focusElement(next, nextSectionId);
              return;
            }
          }
        }
      }
      fireEvent(currentFocusedElement, 'navigatefailed', {
        direction: direction
      });
      return;
    }

    var $sections = {};
    var $total;
    for (var id in _sections) {
      $sections[id] = getSectionNavigableElements$(id);
      if (!$total) {
        $total = $sections[id];
      } else {
        $total = $total.add($sections[id]);
      }
    }

    var config = $.extend({}, GlobalConfig, _sections[currentSectionId]);

    if (config.restrict == 'self-only' || config.restrict == 'self-first') {
      next = navigate(
        currentFocusedElement,
        direction,
        $sections[currentSectionId].not(currentFocusedElement).get(),
        config
      );

      if (!next && config.restrict == 'self-first') {
        next = navigate(
          currentFocusedElement,
          direction,
          $total.not($sections[currentSectionId]).get(),
          config
        );
      }
    } else {
      next = navigate(
        currentFocusedElement,
        direction,
        $total.not(currentFocusedElement).get(),
        config
      );
    }

    if (next) {
      _sections[currentSectionId].previous = {
        target: currentFocusedElement,
        destination: next,
        reverse: REVERSE[direction]
      };

      nextSectionId = getSectionId(next);

      if (currentSectionId != nextSectionId) {
        var nextSection = _sections[nextSectionId];
        if (nextSection.enterToLastFocused && nextSection.lastFocusedElement &&
            isNavigable(nextSection.lastFocusedElement, nextSectionId)) {
          next = nextSection.lastFocusedElement;
        }
      }

      focusElement(next, nextSectionId);
    } else {
      fireEvent(currentFocusedElement, 'navigatefailed', {
        direction: direction
      });
    }

    return false;
  }

  function onKeyUp(evt) {
    if (!_sectionCount) {
      return;
    }
    if (!_pause && evt.keyCode == 13) {
      var currentFocusedElement = $(':focus').get(0);
      if (currentFocusedElement && getSectionId(currentFocusedElement)) {
        return fireEvent(currentFocusedElement, 'enter-up');
      }
    }
  }

  function onFocus(evt) {
    if (_sectionCount && !_duringFocusChange) {
      focusChanged(evt.target);
    }
  }

  /**************************/
  /* jQuery Public Function */
  /**************************/
  var SpatialNavigation = {
    init: function() {
      if (!_ready) {
        $(window).on('keydown', onKeyDown);
        $(window).on('keyup', onKeyUp);
        window.addEventListener('focus', onFocus, true);
        _ready = true;
      }
    },

    uninit: function() {
      window.addEventListener('focus', onFocus, true);
      $(window).off('keyup', onKeyUp);
      $(window).off('keydown', onKeyDown);
      this.clear();
      _ready = false;
    },

    clear: function() {
      _sections = {};
      _sectionCount = 0;
      _defaultSectionId = '';
      _lastSectionId = '';
      _duringFocusChange = false;
    },

    set: function() {
      var sectionId, config;
      if (arguments.length >= 1 && $.isPlainObject(arguments[0])) {
        config = arguments[0];
      } else if (arguments.length >= 2 && $.type(arguments[0]) === 'string' &&
                 $.isPlainObject(arguments[1])) {
        sectionId = arguments[0];
        config = arguments[1];

        if (!_sections[sectionId]) {
          throw new Error('Section "' + sectionId + '" doesn\'t exist!');
        }
      }

      for (var key in config) {
        if (config[key] !== undefined && GlobalConfig[key] !== undefined) {
          if (sectionId) {
            _sections[sectionId][key] = config[key];
          } else {
            GlobalConfig[key] = config[key];
          }
        }
      }
    },

    add: function(section) {
      var id = section.id;

      if (!id) {
        throw new Error('Miss the "id" property!');
      } else if (_sections[id]) {
        throw new Error('Section "' + id + '" has already existed!');
      }

      _sections[id] = $.extend({}, section);
      _sectionCount++;

      if (!_defaultSectionId) {
        this.setDefaultSection(id);
      }
    },

    remove: function(sectionId) {
      if (!_sections[sectionId]) {
        throw new Error('Section "' + sectionId + '" doesn\'t exist!');
      }
      _sections[sectionId] = undefined;
      _sections = $.extend({}, _sections);
      _sectionCount--;
    },

    pause: function() {
      _pause = true;
    },

    resume: function() {
      _pause = false;
    },

    focus: function() {
      if (!arguments[0] || $.type(arguments[0]) === 'string') {
        return focusSection(arguments[0]);
      }

      var $elem = $(arguments[0]).first();
      if (!$elem) {
        return false;
      }

      $elem.focus();
      focusChanged($elem.get(0));
      return true;
    },

    makeFocusable: function(sectionId) {
      var doMakeFocusable = function(section) {
        var tabIndexIgnoreList = section.tabIndexIgnoreList !== undefined ?
          section.tabIndexIgnoreList : GlobalConfig.tabIndexIgnoreList;
        $(section.selector).not(tabIndexIgnoreList).attr('tabindex', -1);
      };

      if (sectionId) {
        if (_sections[sectionId]) {
          doMakeFocusable(_sections[sectionId]);
        } else {
          throw new Error('Section "' + sectionId + '" doesn\'t exist!');
        }
      } else {
        for (var id in _sections) {
          doMakeFocusable(_sections[id]);
        }
      }
    },

    setDefaultSection: function(sectionId) {
      if (!_sections[sectionId]) {
        throw new Error('Section "' + sectionId + '" doesn\'t exist!');
      }
      _defaultSectionId = sectionId;
    }
  };

  /********************/
  /* jQuery Interface */
  /********************/
  $.SpatialNavigation = function() {
    SpatialNavigation.init();

    if (arguments.length > 0) {
      if ($.isPlainObject(arguments[0])) {
        SpatialNavigation.add(arguments[0]);
      } else if ($.type(arguments[0]) === 'string' &&
                 $.isFunction(SpatialNavigation[arguments[0]])) {
        SpatialNavigation[arguments[0]]
          .apply(SpatialNavigation, [].slice.call(arguments, 1));
      }
    }

    return $.extend({}, SpatialNavigation);
  };

  $.fn.SpatialNavigation = function() {
    var config;

    if ($.isPlainObject(arguments[0])) {
      config = arguments[0];
    } else {
      config = {
        id: arguments[0]
      };
    }

    if (!config.selector) {
      config.selector = this.selector;
    }

    SpatialNavigation.init();
    SpatialNavigation.add(config);

    return this;
  };
})(jQuery);
