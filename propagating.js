'use strict';

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define([], factory);
  } else if (typeof exports === 'object') {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like environments that support module.exports,
    // like Node.
    module.exports = factory();
  } else {
    // Browser globals (root is window)
    root.propagating = factory();
  }
}(this, function () {
  /**
   * Extend an Hammer.js instance with event propagation.
   *
   * Features:
   * - Events emitted by hammer will propagate in order from child to parent
   *   elements.
   * - Events are extended with a function `event.stopPropagation()` to stop
   *   propagation to parent elements.
   *
   * Usage:
   *   var hammer = propagatingHammer(new Hammer(element));
   *
   * @param {Hammer.Manager} hammer   An hammer instance.
   * @return {Hammer.Manager} Returns the same hammer instance with extended
   *                          functionality
   */
  return function (hammer) {
    // attach to DOM element
    var element = hammer.element;
    element.hammer = hammer;

    // move the original functions that we will wrap
    hammer._on = hammer.on;
    hammer._off = hammer.off;
    hammer._destroy = hammer.destroy;

    /** @type {Object.<String, Array.<{handler: function, wrapper: function}>>} */
    hammer._handlers = {};

    /**
     * Register a handler for one or multiple events
     * @param {String} events    A space separated string with events
     * @param {function} handler A callback function, called as handler(event)
     * @returns {Hammer.Manager} Returns the hammer instance
     */
    hammer.on = function (events, handler) {
      // register the handler
      split(events).forEach(function (event) {
        var _handlers = hammer._handlers[event];
        if (!_handlers) {
          hammer._handlers[event] = _handlers = [];

          // register the static, propagated handler
          hammer._on(event, propagatedHandler);
        }
        _handlers.push(handler);
      });

      return hammer;
    };

    /**
     * Unregister a handler for one or multiple events
     * @param {String} events      A space separated string with events
     * @param {function} [handler] Optional. The registered handler. If not
     *                             provided, all handlers for given events
     *                             are removed.
     * @returns {Hammer.Manager}   Returns the hammer instance
     */
    hammer.off = function (events, handler) {
      // unregister the handler
      split(events).forEach(function (event) {
        var _handlers = hammer._handlers[event];
        if (_handlers) {
          _handlers = handler ? _handlers.filter(function (h) {
            return h !== handler;
          }) : [];

          if (_handlers.length > 0) {
            hammer._handlers[event] = _handlers;
          }
          else {
            // remove static, propagated handler
            hammer._off(event, propagatedHandler);
            delete hammer._handlers[event];
          }
        }
      });

      return hammer;
    };

    hammer.destroy = function () {
      // Detach from DOM element
      var element = hammer.element;
      delete element.hammer;

      // clear all handlers
      hammer._handlers = {};

      // call original hammer destroy
      hammer._destroy();
    };

    // split a string with space separated words
    function split(events) {
      return events.match(/[^ ]+/g);
    }

    /**
     * A static event handler, applying event propagation.
     * @param {Object} event
     */
    function propagatedHandler(event) {
      // let only a single hammer instance handle this event
      if (event.srcEvent._handled) {
        return;
      }
      event.srcEvent._handled = true;

      // attach a stopPropagation function to the event
      var stopped = false;
      event.stopPropagation = function () {
        stopped = true;
      };

      // propagate over all elements (until stopped)
      var elem = event.target;
      while (elem && !stopped) {
        var _handlers = elem.hammer && elem.hammer._handlers[event.type];
        if (_handlers) {
          for (var i = 0; i < _handlers.length && !stopped; i++) {
            _handlers[i](event);
          }
        }

        elem = elem.parentNode;
      }
    }

    return hammer;
  }
}));