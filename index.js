var React = require('react');
var ReactDOM = require('react-dom');
var assign = require('object-assign');

var hasConsole = typeof window !== 'undefined' && window.console;
var noop = function() {}
var swallowInvalidHeadWarning = noop;
var resetWarnings = noop;

if(hasConsole) {
  var originalError = console.error;
  // Rendering a <head> into a body is technically invalid although it
  // works. We swallow React's validateDOMNesting warning if that is the
  // message to avoid confusion
  swallowInvalidHeadWarning = function() {
    console.error = function(msg) {
      if (/<head>/.test(msg)) return;
      originalError.call(console, msg);
    };
  };
  resetWarnings = function() {
    console.error = originalError;
  };
}

var Frame = React.createClass({
  // React warns when you render directly into the body since browser extensions
  // also inject into the body and can mess up React. For this reason
  // initialContent initialContent is expected to have a div inside of the body
  // element that we render react into.
  propTypes: {
    style: React.PropTypes.object,
    head:  React.PropTypes.node,
    initialContent:  React.PropTypes.string,
    mountTarget:  React.PropTypes.string,
    contentDidMount:  React.PropTypes.func,
    contentDidUpdate:  React.PropTypes.func
  },
  getDefaultProps: function() {
    return {
      initialContent: '<!DOCTYPE html><html><head></head><body><div class="frame-root"></div></body></html>',
      contentDidMount: function() {},
      contentDidUpdate: function() {}
    };
  },
  render: function() {
    var props = assign({}, this.props);
    delete props.head;
    delete props.initialContent;
    delete props.mountTarget;
    delete props.contentDidMount;
    delete props.contentDidUpdate;
    // The iframe isn't ready so we drop children from props here. #12, #17
    return React.createElement('iframe', assign({}, props, {children: undefined}));
  },
  componentDidMount: function() {
    this._isMounted = true;
    this.renderFrameContents();
  },
  renderFrameContents: function() {
    if (!this._isMounted) {
      return;
    }

    var doc = this.getDoc();
    if(doc && doc.readyState === 'complete') {
      var contents = React.createElement('div',
        {className: 'frame-content'},
        this.props.head,
        this.props.children
      );

      var initialRender = !this._setInitialContent;
      if (!this._setInitialContent) {
        doc.open();
        doc.write(this.props.initialContent);
        doc.close();
        this._setInitialContent = true;
      }

      swallowInvalidHeadWarning();

      // unstable_renderSubtreeIntoContainer allows us to pass this component as
      // the parent, which exposes context to any child components.
      var callback = initialRender ? this.props.contentDidMount : this.props.contentDidUpdate;
      var mountTarget = this.getMountTarget();

      if(mountTarget) {
        ReactDOM.unstable_renderSubtreeIntoContainer(this, contents, mountTarget, callback);
      }

      resetWarnings();
    } else {
      setTimeout(this.renderFrameContents, 0);
    }
  },
  getMountTarget: function() {
    var doc = this.getDoc();

    if(this.props.mountTarget) {
      return doc.querySelector(this.props.mountTarget);
    }

    if(doc.body) {
      return doc.body.children[0];
    }

    return null;
  },
  getDoc: function() {
    return ReactDOM.findDOMNode(this).contentDocument;
  },
  componentDidUpdate: function() {
    this.renderFrameContents();
  },
  componentWillUnmount: function() {
    this._isMounted = false;

    var doc = this.getDoc();
    if (doc) {
      ReactDOM.unmountComponentAtNode(this.getMountTarget());
    }
  }
});

module.exports = Frame;
