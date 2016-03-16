;(function($) {
  'use strict';

  $.fn.ensureVisible = function(callback) {
    var $this = $(this).first();
    var $parent = $this.parent();
    var scrollTop = $parent.scrollTop();
    var scrollBottom = scrollTop + $parent.innerHeight();
    var marginTop = parseInt($this.css('margin-top'));
    var marginBottom = parseInt($this.css('margin-bottom'));
    var top = $this.position().top + scrollTop + marginTop;
    var bottom = top + $this.outerHeight();
    var newPosition = null;

    if (scrollTop > top - marginTop) {
      newPosition = {scrollTop: top - marginTop};
    } else if (scrollBottom < bottom + marginBottom) {
      newPosition = {scrollTop: bottom - $parent.innerHeight() + marginBottom};
    }

    if (newPosition) {
      $parent.animate(newPosition, {
        duration: 200,
        done: callback.bind(this)
      });
    } else {
      setTimeout(callback.bind(this));
    }

    return this;
  };
}(jQuery));
