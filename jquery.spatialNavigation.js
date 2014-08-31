/*
 * An implementation of Spatial Navigation for jQuery.
 *
 * Copyright (c) 2014 Luke Chang.
 * https://github.com/luke-chang/jquery-spatialNavigation
 *
 * Licensed under the MPL license.
 */
;(function($) {
    'use strict';

    var previous = {};
    var reverse = {
        'left': 'right',
        'up': 'down',
        'right': 'left',
        'down': 'up'
    };

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

    function generateDistanceFunction(target_rect) {
        return {
            nearPlumbLineIsBetter: function(rect) {
                var d;
                if(rect.center.x < target_rect.center.x) {
                    d = target_rect.center.x - rect.right;
                } else {
                    d = rect.left - target_rect.center.x;
                }
                return d < 0 ? 0 : d;
            },

            nearHorizonIsBetter: function(rect) {
                var d;
                if(rect.center.y < target_rect.center.y) {
                    d = target_rect.center.y - rect.bottom;
                } else {
                    d = rect.top - target_rect.center.y;
                }
                return d < 0 ? 0 : d;
            },

            nearTargetLeftIsBetter: function(rect) {
                var d;
                if(rect.center.x < target_rect.center.x) {
                    d = target_rect.left - rect.right;
                } else {
                    d = rect.left - target_rect.left;
                }
                return d < 0 ? 0 : d;
            },

            nearTargetTopIsBetter: function(rect) {
                var d;
                if(rect.center.y < target_rect.center.y) {
                    d = target_rect.top - rect.bottom;
                } else {
                    d = rect.top - target_rect.top;
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

    function partition(rects, target_rect) {
        var groups = [[], [], [], [], [], [], [], [], []];

        rects.forEach(function(rect) {
            var center = rect.center;
            var x, y, group_id;

            if(center.x < target_rect.left) {
                x = 0;
            } else if(center.x <= target_rect.right) {
                x = 1;
            } else {
                x = 2;
            }

            if(center.y < target_rect.top) {
                y = 0;
            } else if(center.y <= target_rect.bottom) {
                y = 1;
            } else {
                y = 2;
            }

            group_id = y * 3 + x;
            groups[group_id].push(rect);
        });

        return groups;
    }

    function prioritize(priorities) {
        var dest_group = null;
        var distance = [];

        for(var i = 0; i < priorities.length; i++) {
            var p = priorities[i];
            if(p.group.length) {
                dest_group = p.group;
                distance = p.distance;
                break;
            }
        }

        if(!dest_group) {
            return null;
        }

        dest_group.sort(function(a, b) {
            for(var i = 0; i < distance.length; i++) {
                var d = distance[i](a) - distance[i](b);
                if(d) {
                    return d;
                }
            }
            return 0;
        });

        return dest_group;
    }

    $.fn.spatialNavigate = function(start, direction, options) {
        if(!start || !direction) return null;

        start = start instanceof $ ? start.get(0) : start;
        direction = direction.toLowerCase();
        options = options || {};

        var target_rect = getRect(start);
        var rects = $.map(this.not(start), getRect);

        var distance_function = generateDistanceFunction(target_rect);
        var groups = partition(rects, target_rect);
        var internal_groups = partition(groups[4], target_rect.center);
        var priorities;

        switch(direction) {
            case 'left':
                priorities = [{
                    group: internal_groups[0].concat(internal_groups[3]).concat(internal_groups[6]),
                    distance: [
                        distance_function.nearPlumbLineIsBetter,
                        distance_function.topIsBetter
                    ]
                }, {
                    group: groups[3],
                    distance: [
                        distance_function.nearPlumbLineIsBetter,
                        distance_function.topIsBetter
                    ]
                }, {
                    group: groups[0].concat(groups[6]),
                    distance: [
                        distance_function.nearHorizonIsBetter,
                        distance_function.rightIsBetter,
                        distance_function.nearTargetTopIsBetter
                    ]
                }];
                break;
            case 'right':
                priorities = [{
                    group: internal_groups[2].concat(internal_groups[5]).concat(internal_groups[8]),
                    distance: [
                        distance_function.nearPlumbLineIsBetter,
                        distance_function.topIsBetter
                    ]
                }, {
                    group: groups[5],
                    distance: [
                        distance_function.nearPlumbLineIsBetter,
                        distance_function.topIsBetter
                    ]
                }, {
                    group: groups[2].concat(groups[8]),
                    distance: [
                        distance_function.nearHorizonIsBetter,
                        distance_function.leftIsBetter,
                        distance_function.nearTargetTopIsBetter
                    ]
                }];
                break;
            case 'up':
                priorities = [{
                    group: internal_groups[0].concat(internal_groups[1]).concat(internal_groups[2]),
                    distance: [
                        distance_function.nearHorizonIsBetter,
                        distance_function.leftIsBetter
                    ]
                }, {
                    group: groups[1],
                    distance: [
                        distance_function.nearHorizonIsBetter,
                        distance_function.leftIsBetter
                    ]
                }, {
                    group: groups[0].concat(groups[2]),
                    distance: [
                        distance_function.nearPlumbLineIsBetter,
                        distance_function.bottomIsBetter,
                        distance_function.nearTargetLeftIsBetter
                    ]
                }];
                break;
            case 'down':
                priorities = [{
                    group: internal_groups[6].concat(internal_groups[7]).concat(internal_groups[8]),
                    distance: [
                        distance_function.nearHorizonIsBetter,
                        distance_function.leftIsBetter
                    ]
                }, {
                    group: groups[7],
                    distance: [
                        distance_function.nearHorizonIsBetter,
                        distance_function.leftIsBetter
                    ]
                }, {
                    group: groups[6].concat(groups[8]),
                    distance: [
                        distance_function.nearPlumbLineIsBetter,
                        distance_function.topIsBetter,
                        distance_function.nearTargetLeftIsBetter
                    ]
                }];
                break;
            default:
                return null;
        }

        if(options.crossOnly) {
            priorities.pop();
        }

        var dest_group = prioritize(priorities);
        if(!dest_group) {
            return null;
        }

        var dest;

        if(!options.ignorePrevious && previous.destination === start && previous.reverse === direction) {
            for(var i = 0; i < dest_group.length; i++) {
                if(dest_group[i].element === previous.start) {
                    dest = dest_group[i].element;
                    break;
                }
            }
        }

        if(!dest) dest = dest_group[0].element;

        previous = {
            start: start,
            destination: dest,
            reverse: reverse[direction]
        };

        return $(dest);
    };
})(jQuery);
